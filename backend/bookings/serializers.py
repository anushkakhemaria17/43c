from rest_framework import serializers
from .models import Booking, Expense

class BookingSerializer(serializers.ModelSerializer):
    customer_name = serializers.SerializerMethodField()
    slot_info = serializers.SerializerMethodField()

    class Meta:
        model = Booking
        fields = '__all__'

    def get_customer_name(self, obj):
        if obj.customer:
            return obj.customer.name
        return 'Walk-in Guest'

    def get_slot_info(self, obj):
        try:
            return f"{obj.screen.screen_name} | {obj.date} | {obj.slot.start_time}-{obj.slot.end_time}"
        except Exception:
            return f"Manual Booking | {obj.date}"

class ExpenseSerializer(serializers.ModelSerializer):
    class Meta:
        model = Expense
        fields = '__all__'
