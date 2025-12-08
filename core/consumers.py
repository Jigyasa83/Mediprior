# core/consumers.py
import json
from channels.generic.websocket import AsyncWebsocketConsumer
from channels.db import database_sync_to_async
from asgiref.sync import async_to_sync
from .models import Conversation, Message, User, DoctorPatientConnection
from django.db.models import Count

class ChatConsumer(AsyncWebsocketConsumer):
    
    async def connect(self):
        self.user = self.scope['user']
        
        if not self.user or self.user.is_anonymous:
            await self.close()
            return
            
        self.connection_id = self.scope['url_route']['kwargs']['connection_id']
        self.room_group_name = f'chat_{self.connection_id}'

        # Check participation
        if not await self.is_user_participant(self.user, self.connection_id):
            await self.close()
            return

        await self.channel_layer.group_add(
            self.room_group_name,
            self.channel_name
        )
        
        await self.accept()
        await self.send_message_history()

    async def disconnect(self, close_code):
        await self.channel_layer.group_discard(
            self.room_group_name,
            self.channel_name
        )

    async def receive(self, text_data):
        data = json.loads(text_data)
        
        # 1. Handle Clear History Command
        if data.get('command') == 'clear_history':
            await self.soft_delete_history()
            await self.send(text_data=json.dumps({'type': 'cleared'}))
            return

        message_content = data.get('message', '').strip()
        if not message_content: return

        # 2. CHECK MESSAGE LIMIT (Blocking)
        # Only applies to patients. If they sent 5 in a row, block them.
        if self.user.user_type == 'PATIENT':
            limit_error = await self.check_message_limit()
            if limit_error:
                await self.send(text_data=json.dumps({
                    'type': 'error',
                    'code': 'limit_reached', 
                    'message': limit_error
                }))
                return 

        # 3. SAVE & BROADCAST PATIENT MESSAGE
        # (We pass self.user explicitly to say who sent it)
        new_message = await self.create_new_message(message_content, self.user)
        await self.channel_layer.group_send(
            self.room_group_name,
            {
                'type': 'chat_message',
                'message': new_message.content,
                'sender_id': self.user.id,
                'timestamp': new_message.timestamp.isoformat(),
            }
        )

        # 4. AUTO-REPLY CHECK (Non-Blocking)
        # If patient sent a message, check if doctor is Busy/Offline and send auto-reply
        if self.user.user_type == 'PATIENT':
            auto_reply_text = await self.check_auto_reply_status()
            if auto_reply_text:
                # Create a message appearing to come from the DOCTOR
                doctor_user = await self.get_doctor_user()
                if doctor_user:
                    reply_msg = await self.create_new_message(auto_reply_text, doctor_user)
                    
                    # Broadcast the auto-reply
                    await self.channel_layer.group_send(
                        self.room_group_name,
                        {
                            'type': 'chat_message',
                            'message': reply_msg.content,
                            'sender_id': doctor_user.id,
                            'timestamp': reply_msg.timestamp.isoformat(),
                        }
                    )

    async def chat_message(self, event):
        await self.send(text_data=json.dumps({
            'type': 'message',
            'message': event['message'],
            'sender_id': event['sender_id'],
            'timestamp': event['timestamp'],
        }))

    # --- Database Helpers ---

    @database_sync_to_async
    def check_message_limit(self):
        """
        Returns an error string if the patient has sent >= 5 consecutive messages.
        """
        try:
            connection = DoctorPatientConnection.objects.get(id=self.connection_id)
            conversation = self._get_conversation_sync()
            # Get last 5 messages
            last_messages = conversation.messages.exclude(deleted_by=self.user).order_by('-timestamp')[:5]
            
            consecutive = 0
            for msg in last_messages:
                if msg.sender == self.user:
                    consecutive += 1
                else:
                    break # Doctor replied (or auto-replied), reset count
            
            if consecutive >= 5:
                # Fetch emergency contact to show in the error
                contact = connection.doctor.doctor_profile.emergency_contact_number or "N/A"
                return f"Please wait for the doctor to respond.\nIn case of emergency, contact: {contact}"
            
            return None
        except: return None

    @database_sync_to_async
    def check_auto_reply_status(self):
        """
        Returns the Auto-Reply text if the doctor is Busy or Offline.
        """
        try:
            connection = DoctorPatientConnection.objects.get(id=self.connection_id)
            profile = connection.doctor.doctor_profile
            status = str(profile.chat_status).upper()
            contact = profile.emergency_contact_number or "N/A"
            
            if status == 'BUSY':
                return f"Currently doctor is busy, in case of emergency contact {contact}."
            elif status == 'OFFLINE':
                return f"Currently doctor is offline, in case of emergency contact {contact}."
            
            return None # Available
        except: return None

    @database_sync_to_async
    def get_doctor_user(self):
        try:
            connection = DoctorPatientConnection.objects.get(id=self.connection_id)
            return connection.doctor
        except: return None

    def _get_conversation_sync(self):
        connection = DoctorPatientConnection.objects.get(id=self.connection_id)
        conversation = Conversation.objects.annotate(count=Count('participants')).filter(count=2, participants=connection.patient).filter(participants=connection.doctor).first()
        if not conversation:
            conversation = Conversation.objects.create()
            conversation.participants.set([connection.patient, connection.doctor])
            conversation.save()
        return conversation

    @database_sync_to_async
    def get_conversation(self): return self._get_conversation_sync()

    @database_sync_to_async
    def is_user_participant(self, user, connection_id):
        try:
            connection = DoctorPatientConnection.objects.get(id=connection_id)
            return user == connection.patient or user == connection.doctor
        except: return False

    @database_sync_to_async
    def send_message_history(self):
        conversation = async_to_sync(self.get_conversation)()
        if not conversation: return
        messages = conversation.messages.exclude(deleted_by=self.user).order_by('timestamp')
        message_list = []
        for msg in messages:
            message_list.append({'type': 'message', 'message': msg.content, 'sender_id': msg.sender.id, 'timestamp': msg.timestamp.isoformat()})
        async_to_sync(self.send)(text_data=json.dumps({'type': 'history', 'messages': message_list}))

    @database_sync_to_async
    def create_new_message(self, content, sender):
        conversation = async_to_sync(self.get_conversation)()
        return Message.objects.create(conversation=conversation, sender=sender, content=content)

    @database_sync_to_async
    def soft_delete_history(self):
        conversation = async_to_sync(self.get_conversation)()
        if conversation:
            for msg in conversation.messages.all():
                msg.deleted_by.add(self.user)