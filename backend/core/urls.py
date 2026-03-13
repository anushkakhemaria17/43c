from django.contrib import admin
from django.urls import path, include
from django.conf import settings
from django.conf.urls.static import static
from customers.admin_login import AdminLoginView

urlpatterns = [
    path('admin/', admin.as_view() if hasattr(admin, 'as_view') else admin.site.urls), # standard admin.site.urls
    path('api/customers/', include('customers.urls')),
    path('api/customer/', include('customers.urls')), # Backward compatibility redirect/support
    path('api/slots/', include('slots.urls')),
    path('api/bookings/', include('bookings.urls')),
    path('api/admin-login/', AdminLoginView.as_view(), name='admin-login'),
] + static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
