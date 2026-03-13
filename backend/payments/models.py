from django.db import models
from bookings.models import Booking

class Payment(models.Model):
    booking = models.ForeignKey(Booking, on_delete=models.CASCADE)
    payment_id = models.CharField(max_length=100, unique=True) # Razorpay payment ID
    order_id = models.CharField(max_length=100, null=True, blank=True) # Razorpay order ID
    amount = models.DecimalField(max_digits=10, decimal_places=2)
    status = models.CharField(max_length=50)
    method = models.CharField(max_length=50, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.payment_id} - {self.status}"
