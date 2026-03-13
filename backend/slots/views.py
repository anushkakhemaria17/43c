from rest_framework import generics, permissions, status
from rest_framework.response import Response
from .models import Screen, Slot, PricingRule
from .serializers import ScreenSerializer, SlotSerializer, PricingRuleSerializer
from datetime import datetime, timedelta

class SlotListView(generics.ListAPIView):
    serializer_class = SlotSerializer
    permission_classes = (permissions.AllowAny,)

    def get_queryset(self):
        date = self.request.query_params.get('date')
        screen_id = self.request.query_params.get('screen_id')
        queryset = Slot.objects.filter(status='available')
        if date:
            queryset = queryset.filter(date=date)
        if screen_id:
            queryset = queryset.filter(screen_id=screen_id)
        return queryset

class GenerateSlotsView(generics.GenericAPIView):
    permission_classes = (permissions.IsAdminUser,)
    
    def post(self, request):
        date_str = request.data.get('date') # YYYY-MM-DD
        opening_time_str = request.data.get('opening_time', '12:00')
        closing_time_str = request.data.get('closing_time', '00:00')
        duration_hours = int(request.data.get('duration', 1))
        
        if not date_str:
            return Response({"error": "Date is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        date = datetime.strptime(date_str, '%Y-%m-%d').date()
        screens = Screen.objects.all()
        
        if not screens.exists():
            return Response({"error": "No screens found. Please create screens first."}, status=status.HTTP_400_BAD_REQUEST)

        start_time = datetime.strptime(opening_time_str, '%H:%M').time()
        end_time = datetime.strptime(closing_time_str, '%H:%M').time()
        
        current_dt = datetime.combine(date, start_time)
        end_dt = datetime.combine(date, end_time)
        if end_time <= start_time:
             end_dt += timedelta(days=1)
        
        created_count = 0
        while current_dt < end_dt:
            slot_start = current_dt.time()
            current_dt += timedelta(hours=duration_hours)
            slot_end = current_dt.time()
            
            for screen in screens:
                # Find applicable pricing rule
                day_of_week = date.weekday()
                hour = slot_start.hour
                
                rule = PricingRule.objects.filter(
                    is_active=True
                ).filter(
                    models.Q(day_of_week=day_of_week) | models.Q(day_of_week__isnull=True)
                ).filter(
                    start_hour__lte=hour,
                    end_hour__gte=hour
                ).order_by('-day_of_week').first() # Day-specific rules take precedence over general ones

                price = rule.base_price if rule else 300.00
                
                Slot.objects.get_or_create(
                    screen=screen,
                    date=date,
                    start_time=slot_start,
                    end_time=slot_end,
                    defaults={'status': 'available', 'price': price}
                )
                created_count += 1
                
        return Response({"message": f"Successfully generated {created_count} slots for {date_str}"})

class PricingRuleListCreateView(generics.ListCreateAPIView):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer
    permission_classes = (permissions.IsAdminUser,)

class PricingRuleDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PricingRule.objects.all()
    serializer_class = PricingRuleSerializer
    permission_classes = (permissions.IsAdminUser,)
