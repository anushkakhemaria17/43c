from rest_framework import serializers
from .models import Screen, Slot, PricingRule

class ScreenSerializer(serializers.ModelSerializer):
    class Meta:
        model = Screen
        fields = '__all__'

class SlotSerializer(serializers.ModelSerializer):
    screen_name = serializers.ReadOnlyField(source='screen.screen_name')
    class Meta:
        model = Slot
        fields = '__all__'

class PricingRuleSerializer(serializers.ModelSerializer):
    class Meta:
        model = PricingRule
        fields = '__all__'
