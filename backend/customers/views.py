from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth.models import User
from .serializers import RegisterSerializer, CustomerSerializer
from .models import Customer

class RegisterView(generics.CreateAPIView):
    queryset = User.objects.all()
    permission_classes = (permissions.AllowAny,)
    serializer_class = RegisterSerializer

    def post(self, request, *args, **kwargs):
        serializer = self.get_serializer(data=request.data)
        serializer.is_valid(raise_exception=True)
        user = serializer.save()
        customer = Customer.objects.get(user=user)
        refresh = RefreshToken.for_user(user)
        return Response({
            "user": RegisterSerializer(user).data,
            "customer": CustomerSerializer(customer).data,
            "refresh": str(refresh),
            "access": str(refresh.access_token),
        }, status=status.HTTP_201_CREATED)

class CustomerCheckView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    
    def post(self, request):
        mobile = request.data.get('mobile')
        try:
            customer = Customer.objects.get(mobile=mobile)
            return Response({
                "exists": True,
                "customer": {
                    "name": customer.name,
                    "email": customer.email,
                    "mobile": customer.mobile
                }
            })
        except Customer.DoesNotExist:
            return Response({"exists": False})

class CustomerLoginView(generics.GenericAPIView):
    permission_classes = (permissions.AllowAny,)
    
    def post(self, request):
        mobile = request.data.get('mobile')
        if not mobile:
            return Response({"error": "Mobile number is required"}, status=status.HTTP_400_BAD_REQUEST)
        
        try:
            customer = Customer.objects.get(mobile=mobile)
            user = customer.user
            refresh = RefreshToken.for_user(user)
            return Response({
                "customer": CustomerSerializer(customer).data,
                "refresh": str(refresh),
                "access": str(refresh.access_token),
            })
        except Customer.DoesNotExist:
            return Response({"error": "Customer not found"}, status=status.HTTP_404_NOT_FOUND)

class CustomerListView(generics.ListAPIView):
    queryset = Customer.objects.all()
    serializer_class = CustomerSerializer
    permission_classes = (permissions.IsAdminUser,)

class CustomerProfileView(generics.RetrieveAPIView):
    serializer_class = CustomerSerializer
    permission_classes = (permissions.IsAuthenticated,)

    def get_object(self):
        return Customer.objects.get(user=self.request.user)

class PurchaseMembershipView(generics.GenericAPIView):
    permission_classes = (permissions.IsAuthenticated,)

    def post(self, request):
        plan_id = request.data.get('plan_id')
        customer = Customer.objects.get(user=request.user)
        try:
            from .models import MembershipPlan, CustomerMembership
            import datetime
            plan = MembershipPlan.objects.get(id=plan_id)
            
            # Logic for start/end date
            start_date = datetime.date.today()
            end_date = start_date + datetime.timedelta(days=plan.validity_days)
            
            membership = CustomerMembership.objects.create(
                customer=customer,
                plan=plan,
                end_date=end_date
            )
            
            customer.is_member = True
            customer.save()
            
            return Response({
                "message": "Membership activated",
                "customer": CustomerSerializer(customer).data
            })
        except Exception as e:
            return Response({"error": str(e)}, status=status.HTTP_400_BAD_REQUEST)
