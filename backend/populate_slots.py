import os
import django
from datetime import datetime, time, timedelta

# Setup Django environment
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'core.settings')
django.setup()

from slots.models import Screen, Slot, PricingRule

def populate_dummy_data():
    # 1. Create a default screen if none exists
    screen, created = Screen.objects.get_or_create(
        screen_name="Premium Screen 1",
        defaults={'capacity': 6}
    )
    if created:
        print(f"Created Screen: {screen.screen_name}")
    else:
        print(f"Using existing Screen: {screen.screen_name}")

    # 2. Create a default pricing rule if none exists
    rule, created = PricingRule.objects.get_or_create(
        rule_name="Standard Rate",
        defaults={'base_price': 300.00, 'is_active': True}
    )
    if created:
        print(f"Created Pricing Rule: {rule.rule_name}")

    # 3. Generate slots for today
    today = datetime.now().date()
    start_hour = 12 # 12 PM
    end_hour = 23   # 11 PM
    
    created_slots = 0
    for hour in range(start_hour, end_hour):
        slot_start = time(hour, 0)
        slot_end = time(hour + 1, 0)
        
        slot, created = Slot.objects.get_or_create(
            screen=screen,
            date=today,
            start_time=slot_start,
            end_time=slot_end,
            defaults={'status': 'available', 'price': 300.00}
        )
        if created:
            created_slots += 1
    
    print(f"Generated {created_slots} slots for {today}")

if __name__ == "__main__":
    populate_dummy_data()
