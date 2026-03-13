from django.db import models

class Screen(models.Model):
    screen_name = models.CharField(max_length=50)
    capacity = models.IntegerField()

    def __str__(self):
        return self.screen_name

class Slot(models.Model):
    STATUS_CHOICES = (
        ('available', 'Available'),
        ('booked', 'Booked'),
        ('blocked', 'Blocked'),
    )
    screen = models.ForeignKey(Screen, on_delete=models.CASCADE, related_name='slots')
    date = models.DateField()
    start_time = models.TimeField()
    end_time = models.TimeField()
    status = models.CharField(max_length=20, choices=STATUS_CHOICES, default='available')
    price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00) # Default price
    member_price = models.DecimalField(max_digits=10, decimal_places=2, default=0.00)

    class Meta:
        unique_together = ('screen', 'date', 'start_time')

    def __str__(self):
        return f"{self.screen.screen_name} | {self.date} | {self.start_time}-{self.end_time}"

class PricingRule(models.Model):
    DAY_CHOICES = (
        (0, 'Monday'), (1, 'Tuesday'), (2, 'Wednesday'), (3, 'Thursday'),
        (4, 'Friday'), (5, 'Saturday'), (6, 'Sunday'),
    )
    rule_name = models.CharField(max_length=100)
    day_of_week = models.IntegerField(choices=DAY_CHOICES, null=True, blank=True) # If null, applies to all days
    start_hour = models.IntegerField(default=0)
    end_hour = models.IntegerField(default=23)
    base_price = models.DecimalField(max_digits=10, decimal_places=2) # Non-member price
    member_price = models.DecimalField(max_digits=10, decimal_places=2, null=True, blank=True)
    is_active = models.BooleanField(default=True)

    def __str__(self):
        return self.rule_name
