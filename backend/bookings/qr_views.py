from rest_framework import generics, permissions, status
from rest_framework.response import Response
from bookings.models import Booking
from bookings.serializers import BookingSerializer

class VerifyBookingQRView(generics.RetrieveAPIView):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    lookup_field = 'booking_id'
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request, *args, **kwargs):
        instance = self.get_object()
        serializer = self.get_serializer(instance)
        return Response(serializer.data)

class UpdateCheckinStatusView(generics.UpdateAPIView):
    queryset = Booking.objects.all()
    serializer_class = BookingSerializer
    lookup_field = 'booking_id'
    permission_classes = (permissions.IsAdminUser,)

    def patch(self, request, *args, **kwargs):
        booking = self.get_object()
        checkin_status = request.data.get('checkin_status')
        if checkin_status in dict(Booking.CHECKIN_CHOICES):
            booking.checkin_status = checkin_status
            booking.save()
            return Response(BookingSerializer(booking).data)
        return Response({"error": "Invalid status"}, status=status.HTTP_400_BAD_REQUEST)
