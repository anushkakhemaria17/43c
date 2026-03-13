from django.urls import path
from .views import SlotListView, GenerateSlotsView, PricingRuleListCreateView, PricingRuleDetailView

urlpatterns = [
    path('available/', SlotListView.as_view(), name='available-slots'),
    path('admin/generate/', GenerateSlotsView.as_view(), name='generate-slots'),
    path('admin/pricing-rules/', PricingRuleListCreateView.as_view(), name='pricing-rules'),
    path('admin/pricing-rules/<int:pk>/', PricingRuleDetailView.as_view(), name='pricing-rule-detail'),
]
