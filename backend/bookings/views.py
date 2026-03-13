from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Booking
from .serializers import BookingSerializer
from slots.models import Slot
from customers.models import Customer
import razorpay
from django.conf import settings
import uuid

# Initialize Razorpay Client (using dummy keys for now)
RAZORPAY_KEY_ID = 'rzp_test_dummy'
RAZORPAY_KEY_SECRET = 'dummy_secret'
client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

class CreateBookingView(generics.CreateAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    serializer_class = BookingSerializer

    def post(self, request, *args, **kwargs):
        customer = Customer.objects.get(user=request.user)
        slot_id = request.data.get('slot_id')
        guest_count = request.data.get('guest_count')
        
        try:
            slot = Slot.objects.get(id=slot_id, status='available')
        except Slot.DoesNotExist:
            return Response({"error": "Slot not available"}, status=status.HTTP_400_BAD_REQUEST)
        
        booking_id = f"BK-{uuid.uuid4().hex[:8].upper()}"
        
        # Apply Member Pricing
        if customer.is_member and slot.member_price:
            price = slot.member_price
        else:
            price = slot.price 
        
        # Create Razorpay Order
        order_data = {
            'amount': int(price * 100), # amount in paise
            'currency': 'INR',
            'receipt': booking_id,
            'payment_capture': 1
        }
        # razorpay_order = client.order.create(data=order_data)
        razorpay_order = {'id': f"order_{uuid.uuid4().hex[:12]}"} # Mock for now
        
        booking = Booking.objects.create(
            booking_id=booking_id,
            customer=customer,
            date=slot.date,
            slot=slot,
            screen=slot.screen,
            guest_count=guest_count,
            price=price,
            payment_status='pending'
        )
        
        return Response({
            "booking": BookingSerializer(booking).data,
            "razorpay_order_id": razorpay_order['id'],
            "razorpay_key_id": RAZORPAY_KEY_ID
        }, status=status.HTTP_201_CREATED)

class VerifyPaymentView(generics.GenericAPIView):
    permission_classes = (permissions.IsAuthenticated,)
    
    def post(self, request):
        booking_id = request.data.get('booking_id')
        payment_id = request.data.get('razorpay_payment_id')
        signature = request.data.get('razorpay_signature')
        
        # In real scenario: verify signature using client.utility.verify_payment_signature
        
        try:
            booking = Booking.objects.get(booking_id=booking_id)
            booking.payment_status = 'confirmed'
            booking.slot.status = 'booked'
            booking.slot.save()
            booking.save()
            
            from core.sms_utils import notify_booking_confirmation, notify_admin_new_booking
            notify_booking_confirmation(booking)
            notify_admin_new_booking(booking)
            
            return Response({"message": "Booking confirmed successfully", "booking": BookingSerializer(booking).data})
        except Booking.DoesNotExist:
            return Response({"error": "Booking not found"}, status=status.HTTP_404_NOT_FOUND)

class ManualBlockSlotView(generics.GenericAPIView):
    permission_classes = (permissions.IsAdminUser,)

    def post(self, request):
        slot_id = request.data.get('slot_id')
        name = request.data.get('name')
        mobile = request.data.get('mobile')
        
        try:
            slot = Slot.objects.get(id=slot_id)
            slot.status = 'booked'
            slot.save()
            
            # Optionally create a booking record with 'manual' status
            booking = Booking.objects.create(
                booking_id=f"MAN-{uuid.uuid4().hex[:6].upper()}",
                customer=None, # Or create a placeholder customer
                date=slot.date,
                slot=slot,
                screen=slot.screen,
                payment_status='confirmed', # Manually confirmed
                price=slot.price # Default price
            )
            return Response({"message": "Slot blocked manually", "booking_id": booking.booking_id})
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)

class MyBookingsView(generics.ListAPIView):
    serializer_class = BookingSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_queryset(self):
        customer = Customer.objects.get(user=self.request.user)
        return Booking.objects.filter(customer=customer)

class ExpenseListView(generics.ListCreateAPIView):
    queryset = Booking.objects.all() # Placeholder for generic query
    from .models import Expense
    queryset = Expense.objects.all()
    from .serializers import ExpenseSerializer
    serializer_class = ExpenseSerializer
    permission_classes = (permissions.IsAdminUser,)

class AnalyticsView(generics.GenericAPIView):
    permission_classes = (permissions.IsAdminUser,)

    def get(self, request):
        from django.db.models import Sum, Count
        from .models import Expense
        import datetime
        
        now = datetime.datetime.now()
        first_day_of_month = now.replace(day=1)
        
        # Monthly Sales
        sales = Booking.objects.filter(payment_status='confirmed', date__gte=first_day_of_month).aggregate(total=Sum('price'))['total'] or 0
        
        # Monthly Expenses
        expenses = Expense.objects.filter(date__gte=first_day_of_month).aggregate(total=Sum('amount'))['total'] or 0
        
        # Today's Stats
        today = datetime.date.today()
        today_bookings = Booking.objects.filter(date=today, payment_status='confirmed').count()
        today_revenue = Booking.objects.filter(date=today, payment_status='confirmed').aggregate(total=Sum('price'))['total'] or 0

        # Popular Slots
        popular_slots = Booking.objects.values('slot__screen__screen_name', 'slot__start_time').annotate(count=Count('id')).order_by('-count')[:5]
        
        # Top Customers
        top_customers = Booking.objects.filter(payment_status='confirmed').values('customer__name', 'customer__mobile').annotate(total_spent=Sum('price'), count=Count('id')).order_by('-total_spent')[:5]
        
        return Response({
            "monthly_sales": sales,
            "monthly_expenses": expenses,
            "net_profit": sales - expenses,
            "today_bookings": today_bookings,
            "today_revenue": today_revenue,
            "popular_slots": popular_slots,
            "top_customers": top_customers
        })
