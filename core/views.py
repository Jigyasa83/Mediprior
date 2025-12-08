# core/views.py
from rest_framework.views import APIView
from rest_framework.response import Response
from rest_framework import status, permissions, viewsets
from .ai_utils import analyze_message, COPING_TOOLS
from rest_framework_simplejwt.views import TokenObtainPairView
from rest_framework.parsers import MultiPartParser, FormParser, JSONParser
from django.http import Http404
from django.utils import timezone

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

# --- THIS IS THE MISSING VIEW ---
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

# --- THIS IS THE OTHER MISSING VIEW ---
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

# core/views.py

# ... (imports remain the same) ...
from django.utils import timezone # Make sure this is imported at the top

# ... (other views) ...

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
    - PATCH:
        - Patient: Books an available slot.
        - Doctor: (Future) Adds notes/prescription.
    - DELETE:
        - Patient/Doctor: Cancels an appointment.
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
    
class AIChatView(APIView):
    """
    Simple API for the AI Health Assistant.
    """
    permission_classes = [permissions.IsAuthenticated]

    def post(self, request):
        user_message = request.data.get('message', '')
        tool_request = request.data.get('tool', None)

        # If user clicked a tool button
        if tool_request and tool_request in COPING_TOOLS:
            return Response({
                "response": COPING_TOOLS[tool_request],
                "mood_score": 5,
                "emotion": "Calm",
                "action": "TOOL"
            })

        if not user_message:
            return Response({"error": "Message is required"}, status=400)

        # Analyze the text
        result = analyze_message(user_message)
        
        return Response(result)