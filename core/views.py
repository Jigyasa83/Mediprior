# core/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from .ai_utils import analyze_message, COPING_TOOLS
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import Http404
from django.utils import timezone
from django.contrib.auth.tokens import PasswordResetTokenGenerator
from django.utils.encoding import smart_str, force_str, smart_bytes, DjangoUnicodeDecodeError
from django.utils.http import urlsafe_base64_decode, urlsafe_base64_encode
from django.contrib.sites.shortcuts import get_current_site
from django.urls import reverse
from django.core.mail import send_mail
from django.conf import settings
import os
import json
import random
import numpy as np
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import LinearSVC

# Import all models
from .models import (
    PatientProfile, 
    DoctorProfile,
    MedicalReport, 
    User,
    DoctorPatientConnection,
    PatientHealthMetric,
    Appointment
)

# Import all serializers
from .serializers import (
    UserRegistrationSerializer, 
    PatientProfileSerializer, 
    DoctorProfileSerializer, 
    MyTokenObtainPairSerializer,
    MedicalReportSerializer,
    DoctorPublicProfileSerializer, 
    ConnectionRequestSerializer,
    ConnectionListSerializer,
    PatientHealthMetricSerializer,
    AppointmentSerializer,
    AppointmentCreateSerializer
)

class UserRegistrationView(APIView):
    permission_classes = [permissions.AllowAny]
    def post(self, request):
        serializer = UserRegistrationSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save()
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class RequestPasswordResetEmail(APIView):
    def post(self, request):
        email = request.data.get('email', '')
        if User.objects.filter(email=email).exists():
            user = User.objects.get(email=email)
            uidb64 = urlsafe_base64_encode(smart_bytes(user.id))
            token = PasswordResetTokenGenerator().make_token(user)
            
            # Link points to REACT Frontend
            absurl = f"http://localhost:3000/password-reset-confirm/{uidb64}/{token}/"
            
            email_body = f'Hello, \n Use the link below to reset your password. \n {absurl}'
            data = {'email_body': email_body, 'to_email': user.email, 'email_subject': 'Reset your Password'}
            
            # Send Email
            send_mail(
                data['email_subject'],
                data['email_body'],
                settings.EMAIL_HOST_USER,
                [data['to_email']],
                fail_silently=False,
            )
        
        # We return 200 regardless to prevent email enumeration (security practice)
        return Response({'success': 'We have sent you a link to reset your password'}, status=status.HTTP_200_OK)

# --- 2. Set New Password (Verifies Token) ---
class SetNewPasswordAPIView(APIView):
    def patch(self, request):
        try:
            password = request.data.get('password')
            token = request.data.get('token')
            uidb64 = request.data.get('uidb64')

            id = force_str(urlsafe_base64_decode(uidb64))
            user = User.objects.get(id=id)

            if not PasswordResetTokenGenerator().check_token(user, token):
                return Response({'error': 'Token is invalid or expired'}, status=status.HTTP_401_UNAUTHORIZED)

            user.set_password(password)
            user.save()
            return Response({'success': 'Password reset successful'}, status=status.HTTP_200_OK)

        except Exception as e:
            return Response({'error': 'Something went wrong'}, status=status.HTTP_401_UNAUTHORIZED)
        
class ProfileView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser, JSONParser) 
    def get(self, request):
        user = request.user
        try:
            if user.user_type == 'PATIENT':
                profile = PatientProfile.objects.get(user=user)
                serializer = PatientProfileSerializer(profile)
            elif user.user_type == 'DOCTOR':
                profile = DoctorProfile.objects.get(user=user)
                serializer = DoctorProfileSerializer(profile)
            else:
                return Response({"error": "No profile found for this user type"}, status=status.HTTP_404_NOT_FOUND)
            return Response(serializer.data, status=status.HTTP_200_OK)
        except (PatientProfile.DoesNotExist, DoctorProfile.DoesNotExist):
            return Response({"message": "Profile not yet created"}, status=status.HTTP_404_NOT_FOUND)
    def post(self, request):
        user = request.user
        if user.user_type == 'PATIENT':
            profile, created = PatientProfile.objects.get_or_create(user=user)
            serializer = PatientProfileSerializer(instance=profile, data=request.data, partial=True)
        elif user.user_type == 'DOCTOR':
            profile, created = DoctorProfile.objects.get_or_create(user=user)
            serializer = DoctorProfileSerializer(instance=profile, data=request.data, partial=True)
        else:
            return Response({"error": "Invalid user type"}, status=status.HTTP_400_BAD_REQUEST)
        if serializer.is_valid():
            serializer.save(user=user) 
            return Response(serializer.data, status=status.HTTP_200_OK if not created else status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MedicalReportView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    parser_classes = (MultiPartParser, FormParser) 
    def get(self, request):
        reports = MedicalReport.objects.filter(patient=request.user)
        serializer = MedicalReportSerializer(reports, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)
    def post(self, request):
        serializer = MedicalReportSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(patient=request.user)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class MedicalReportDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get_object(self, pk, user):
        try:
            return MedicalReport.objects.get(pk=pk, patient=user)
        except MedicalReport.DoesNotExist:
            raise Http404
    def delete(self, request, pk, format=None):
        report = self.get_object(pk, request.user)
        report.file.delete(save=False) 
        report.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)

class MyTokenObtainPairView(TokenObtainPairView):
    serializer_class = MyTokenObtainPairSerializer

class VerifiedDoctorListView(APIView):
    permission_classes = [permissions.IsAuthenticated] 
    def get(self, request):
        verified_profiles = DoctorProfile.objects.filter(
            verification_status=DoctorProfile.VerificationStatus.VERIFIED
        ).exclude(user=request.user) # Exclude self
        
        serializer = DoctorPublicProfileSerializer(
            verified_profiles, 
            many=True,
            context={'request': request} 
        )
        return Response(serializer.data, status=status.HTTP_200_OK)

class ConnectionRequestView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def post(self, request):
        if request.user.user_type != User.UserType.PATIENT:
            return Response({"error": "Only patients can send connection requests."}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = ConnectionRequestSerializer(data=request.data, context={'request': request})
        
        if serializer.is_valid():
            serializer.save()
            return Response({"message": "Connection request sent successfully."}, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class DoctorConnectionView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    def get(self, request):
        if request.user.user_type == User.UserType.DOCTOR:
            connections = DoctorPatientConnection.objects.filter(doctor=request.user)
        elif request.user.user_type == User.UserType.PATIENT:
            connections = DoctorPatientConnection.objects.filter(patient=request.user)
        else:
            return Response({"error": "Invalid user type."}, status=403)
            
        serializer = ConnectionListSerializer(connections, many=True, context={'request': request})
        return Response(serializer.data)

    def post(self, request): # This is for doctors to ACCEPT/REJECT
        if request.user.user_type != User.UserType.DOCTOR:
            return Response({"error": "Only doctors can manage connections."}, status=status.HTTP_403_FORBIDDEN)
        
        connection_id = request.data.get('connection_id')
        action = request.data.get('action', '').upper()
        
        try:
            connection = DoctorPatientConnection.objects.get(id=connection_id, doctor=request.user)
        except DoctorPatientConnection.DoesNotExist:
            return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)
            
        if action == 'ACCEPT':
            connection.status = DoctorPatientConnection.ConnectionStatus.ACCEPTED
            connection.save()
            return Response({"message": "Connection accepted."}, status=status.HTTP_200_OK)
        elif action == 'REJECT':
            connection.status = DoctorPatientConnection.ConnectionStatus.REJECTED
            connection.save()
            return Response({"message": "Connection rejected."}, status=status.HTTP_200_OK)
        else:
            return Response({"error": "Invalid action."}, status=status.HTTP_400_BAD_REQUEST)

class PatientConnectionDetailView(APIView):
    permission_classes = [permissions.IsAuthenticated]
    # Change 'doctor_id' to 'target_user_id' for clarity in future, but keep variable name for now
    def delete(self, request, doctor_id, format=None): 
        user = request.user
        try:
            target_user = User.objects.get(id=doctor_id)
            # Find connection where user is either patient OR doctor
            if user.user_type == 'PATIENT':
                 connection = DoctorPatientConnection.objects.get(patient=user, doctor=target_user)
            else:
                 connection = DoctorPatientConnection.objects.get(doctor=user, patient=target_user)
            
            connection.delete()
            return Response(status=status.HTTP_204_NO_CONTENT)
        except (User.DoesNotExist, DoctorPatientConnection.DoesNotExist):
            return Response({"error": "Connection not found."}, status=status.HTTP_404_NOT_FOUND)
            
class PatientHealthMetricView(APIView):
    permission_classes = [permissions.IsAuthenticated]

    def get(self, request):
        if not hasattr(request.user, 'patient_profile'):
            return Response({"error": "Patient profile not found."}, status=status.HTTP_404_NOT_FOUND)
            
        metrics = PatientHealthMetric.objects.filter(patient=request.user.patient_profile)
        serializer = PatientHealthMetricSerializer(metrics, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        if not hasattr(request.user, 'patient_profile'):
            return Response({"error": "Patient profile not found."}, status=status.HTTP_404_NOT_FOUND)

        serializer = PatientHealthMetricSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(patient=request.user.patient_profile)
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)

class AppointmentListView(APIView):
    """
    Handles Listing and Creating Appointments.
    Auto-cleans up old slots when accessed.
    """
    permission_classes = [permissions.IsAuthenticated]
    
    def get(self, request):
        user = request.user
        doctor_id = self.request.query_params.get('doctor_id')
        now = timezone.now()

        # --- SMART CLEANUP LOGIC ---
        # 1. If a BOOKED appointment is in the past, mark it COMPLETED
        Appointment.objects.filter(
            status=Appointment.AppointmentStatus.BOOKED,
            end_time__lt=now
        ).update(status=Appointment.AppointmentStatus.COMPLETED)

        # 2. If an AVAILABLE slot is in the past, DELETE it (remove clutter)
        Appointment.objects.filter(
            status=Appointment.AppointmentStatus.AVAILABLE,
            end_time__lt=now
        ).delete()
        # ---------------------------
        
        queryset = Appointment.objects.none()

        if user.user_type == 'PATIENT':
            if doctor_id:
                # Patient viewing a specific doctor's AVAILABLE slots
                queryset = Appointment.objects.filter(
                    doctor_id=doctor_id,
                    status=Appointment.AppointmentStatus.AVAILABLE,
                    start_time__gte=now # Only show future slots
                )
            else:
                # Patient viewing their OWN booked/completed schedule
                queryset = Appointment.objects.filter(patient=user)
        
        elif user.user_type == 'DOCTOR':
            # Doctor sees EVERYTHING (Available, Booked, Completed)
            queryset = Appointment.objects.filter(doctor=user)
        
        serializer = AppointmentSerializer(queryset, many=True)
        return Response(serializer.data, status=status.HTTP_200_OK)

    def post(self, request):
        if request.user.user_type != User.UserType.DOCTOR:
            return Response({"error": "Only doctors can create slots."}, status=status.HTTP_403_FORBIDDEN)
            
        serializer = AppointmentCreateSerializer(data=request.data)
        if serializer.is_valid():
            serializer.save(
                doctor=request.user,
                status=Appointment.AppointmentStatus.AVAILABLE
            )
            return Response(serializer.data, status=status.HTTP_201_CREATED)
        
        return Response(serializer.errors, status=status.HTTP_400_BAD_REQUEST)


class AppointmentDetailView(APIView):
    """
    Handles a single appointment.
    """
    permission_classes = [permissions.IsAuthenticated]

    def patch(self, request, pk):
        # This is for a PATIENT to book an available slot
        if request.user.user_type != User.UserType.PATIENT:
            raise permissions.PermissionDenied("Only patients can book appointments.")
            
        try:
            appointment = Appointment.objects.get(
                pk=pk, 
                status=Appointment.AppointmentStatus.AVAILABLE
            )
        except Appointment.DoesNotExist:
            return Response(
                {"error": "This appointment slot is no longer available."},
                status=status.HTTP_404_NOT_FOUND
            )
            
        # Book the appointment
        appointment.patient = request.user
        appointment.status = Appointment.AppointmentStatus.BOOKED
        appointment.save()
        
        serializer = AppointmentSerializer(appointment)
        return Response(serializer.data, status=status.HTTP_200_OK)

# --- AI TRAINING SECTION ---
INTENTS_PATH = os.path.join(settings.BASE_DIR, 'core', 'intents.json')
TRAINING_DATA = {"intents": []}

try:
    with open(INTENTS_PATH, 'r', encoding='utf-8') as f:
        TRAINING_DATA = json.load(f)
        print(f"✅ Loaded {len(TRAINING_DATA['intents'])} intents.")
except FileNotFoundError:
    print(f"❌ Error: intents.json not found at {INTENTS_PATH}")

# Train the Model (Runs once when server starts)
print("Training AI Model...")
patterns = []
tags = []

for intent in TRAINING_DATA['intents']:
    for pattern in intent['patterns']:
        patterns.append(pattern)
        tags.append(intent['tag'])

# Initialize Vectorizer and Classifier
vectorizer = TfidfVectorizer(ngram_range=(1, 2), stop_words='english', min_df=1)
clf = LinearSVC()

if patterns:
    X = vectorizer.fit_transform(patterns)
    clf.fit(X, tags)
    print("✅ AI Model Trained Successfully!")
else:
    print("⚠️ No patterns found. Model not trained.")

# --- CONTEXT FLOW LOGIC (The "Memory" Brain) ---
FLOW_LOGIC = {
    "career_confusion": {
        "no": "career_planning_advice",    # If you say "no", it gives advice
        "nah": "career_planning_advice",
        "yes": "career_encouragement",     # If you say "yes", it encourages you
        "maybe": "career_planning_advice"
    },
    # --------------------------------------------------
    "problem": { 
        "no": "no-approach",
        "not": "no-approach",
        "yes": "user-agree"
    },
    "no-approach": { 
        "yes": "learn-more",
        "sure": "learn-more",
        "ok": "learn-more"
    },
    "user-agree": { 
        "yes": "meditation",
        "ok": "meditation",
        "right": "meditation"
    },
    "problem": { 
        "no": "no-approach",
        "not": "no-approach",
        "yes": "user-agree"
    },
    "no-approach": { 
        "yes": "learn-more",
        "sure": "learn-more",
        "ok": "learn-more"
    },
    "user-agree": { 
        "yes": "meditation",
        "ok": "meditation",
        "right": "meditation"
    },
    "meditation": { 
        "thanks": "user-meditation",
        "done": "user-meditation",
        "better": "user-meditation"
    },
    "sad": {
        "yes": "sad", 
        "why": "sad"
    }
}

class AIChatView(APIView):
    """
    Context-Aware AI Chatbot Endpoint
    Uses TF-IDF + LinearSVC for intent classification
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_message = request.data.get('message', '').lower()
        tool_request = request.data.get('tool', None)
        
        # 1. Handle UI Tool Buttons (Breathing, etc.)
        if tool_request:
             if tool_request in COPING_TOOLS:
                return Response({
                    "response": COPING_TOOLS[tool_request],
                    "tag": "tool_usage",
                    "previous_context": None
                })

        if not user_message:
            return Response({"error": "Message is required"}, status=400)

        # 2. Handle Reset Commands
        if user_message in ['reset', 'clear', 'restart', 'hi', 'hello']:
            if user_message not in ['hi', 'hello']:
                return Response({
                    "response": "Memory cleared. How can I help?", 
                    "tag": "reset",
                    "previous_context": None
                })

        # 3. Predict Intent (Machine Learning)
        user_vec = vectorizer.transform([user_message])
        try:
            predicted_tag = clf.predict(user_vec)[0]
        except:
            predicted_tag = "default"
        
        # 4. Context Logic (Memory)
        last_tag = request.data.get('previous_context', None) 
        final_tag = predicted_tag
        
        if last_tag in FLOW_LOGIC:
            transitions = FLOW_LOGIC[last_tag]
            for keyword, next_tag in transitions.items():
                if keyword in user_message:
                    final_tag = next_tag
                    break
        
        # 5. Fetch Response (SAFE MODE)
        response_text = "I'm not sure I understand. Could you rephrase that?"
        
        # --- CRITICAL FIX: Handle Suicide Logic FIRST to prevent crashes ---
        if final_tag == "suicide":
             response_text = "CRISIS_DETECTED"
        else:
            # Only try to get JSON responses if it's NOT a crisis
            intent_data = next((item for item in TRAINING_DATA['intents'] if item["tag"] == final_tag), None)
            if intent_data and 'responses' in intent_data:
                response_text = random.choice(intent_data['responses'])

        # 6. Return Response
        return Response({
            "response": response_text,
            "tag": final_tag,
            "previous_context": final_tag 
        })