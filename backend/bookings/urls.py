from django.urls import path
from .views import CreateBookingView, VerifyPaymentView, MyBookingsView, ExpenseListView, AnalyticsView, ManualBlockSlotView
from .admin_views import AdminBookingListView, AdminBookingStatsView
from .qr_views import VerifyBookingQRView, UpdateCheckinStatusView

urlpatterns = [
    path('book/', CreateBookingView.as_view(), name='create-booking'),
    path('verify-payment/', VerifyPaymentView.as_view(), name='verify-payment'),
    path('my-bookings/', MyBookingsView.as_view(), name='my-bookings'),
    path('expenses/', ExpenseListView.as_view(), name='expenses'),
    path('analytics/', AnalyticsView.as_view(), name='analytics'),
    path('manual-block/', ManualBlockSlotView.as_view(), name='manual-block'),
    path('admin/bookings/', AdminBookingListView.as_view(), name='admin-bookings'),
    path('admin/stats/', AdminBookingStatsView.as_view(), name='admin-stats'),
    path('admin/verify-qr/<str:booking_id>/', VerifyBookingQRView.as_view(), name='verify-qr'),
    path('admin/update-checkin/<str:booking_id>/', UpdateCheckinStatusView.as_view(), name='update-checkin'),
]
