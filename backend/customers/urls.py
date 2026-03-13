from django.urls import path
from .views import RegisterView, CustomerLoginView, CustomerCheckView, CustomerProfileView, PurchaseMembershipView, CustomerListView

urlpatterns = [
    path('register/', RegisterView.as_view(), name='register'),
    path('login/', CustomerLoginView.as_view(), name='login'),
    path('check/', CustomerCheckView.as_view(), name='check-mobile'),
    path('profile/', CustomerProfileView.as_view(), name='profile'),
    path('purchase-membership/', PurchaseMembershipView.as_view(), name='purchase-membership'),
    path('admin/customers/', CustomerListView.as_view(), name='admin-customers'),
]
