from rest_framework import generics, permissions
from rest_framework.response import Response
from bookings.models import Booking
from bookings.serializers import BookingSerializer

class AdminBookingListView(generics.ListAPIView):
    queryset = Booking.objects.all().order_by('-created_at')
    serializer_class = BookingSerializer
    permission_classes = (permissions.IsAdminUser,)

class AdminBookingStatsView(generics.GenericAPIView):
    permission_classes = (permissions.IsAdminUser,)
    
    def get(self, request):
        from django.db.models import Sum
        from datetime import date
        today_bookings = Booking.objects.filter(date=date.today()).count()
        total_revenue = Booking.objects.filter(payment_status='confirmed').aggregate(Sum('price'))['price__sum'] or 0
        return Response({
            "today_bookings": today_bookings,
            "total_revenue": total_revenue
        })
