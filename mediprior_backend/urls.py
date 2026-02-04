
from django.contrib import admin
from django.urls import path,include
from django.conf import settings             # <-- 1. Import settings
from django.conf.urls.static import static # <-- 2. Import static

from core.views import MyTokenObtainPairView, RequestPasswordResetEmail, SetNewPasswordAPIView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path("admin/", admin.site.urls),
    
    # Registration URL
    path("api/",include("core.urls")),
    
    # Login URL
    #path('api/token/', TokenObtainPairView.as_view(), name='token_obtain_pair'),

    # 4. TO THIS (to use our new view)
    path('api/token/', MyTokenObtainPairView.as_view(), name='token_obtain_pair'),
    # Refresh Token URL
    path('api/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/request-reset-email/', RequestPasswordResetEmail.as_view(), name="request-reset-email"),
    path('api/password-reset-complete/', SetNewPasswordAPIView.as_view(), name="password-reset-complete"),
]

urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)