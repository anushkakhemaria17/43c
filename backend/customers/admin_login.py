from rest_framework import generics, permissions, status
from rest_framework.response import Response
from rest_framework_simplejwt.tokens import RefreshToken
from django.contrib.auth import authenticate
from django.contrib.auth.models import User
from customers.models import Customer
from customers.serializers import CustomerSerializer


class AdminLoginView(generics.GenericAPIView):
    """Admin login using username + password (not mobile OTP)."""
    permission_classes = (permissions.AllowAny,)

    def post(self, request):
        username = request.data.get('username')
        password = request.data.get('password')

        if not username or not password:
            return Response({"error": "Username and password required."}, status=status.HTTP_400_BAD_REQUEST)

        user = authenticate(request, username=username, password=password)

        if user is None:
            return Response({"error": "Invalid credentials."}, status=status.HTTP_401_UNAUTHORIZED)

        if not user.is_staff:
            return Response({"error": "Access denied. Admin privileges required."}, status=status.HTTP_403_FORBIDDEN)

        try:
            customer = Customer.objects.get(user=user)
        except Customer.DoesNotExist:
            return Response({"error": "No linked customer profile for this admin. Contact system admin."}, status=status.HTTP_404_NOT_FOUND)

        refresh = RefreshToken.for_user(user)
        return Response({
            "customer": CustomerSerializer(customer).data,
            "access": str(refresh.access_token),
            "refresh": str(refresh),
        })
