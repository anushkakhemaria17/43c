from rest_framework import serializers
from django.contrib.auth.models import User
from .models import Customer
import random

class UserSerializer(serializers.ModelSerializer):
    class Meta:
        model = User
        fields = ('id', 'username', 'email')

class RegisterSerializer(serializers.ModelSerializer):
    mobile = serializers.CharField(write_only=True)
    name = serializers.CharField(write_only=True)

    class Meta:
        model = User
        fields = ('id', 'username', 'email', 'mobile', 'name')

    def create(self, validated_data):
        name = validated_data.pop('name')
        mobile = validated_data.pop('mobile')

        # Check if a User with this username (mobile) already exists
        existing_user = User.objects.filter(username=validated_data['username']).first()
        if existing_user:
            # If a Customer record already exists for this user, they should log in
            if hasattr(existing_user, 'customer'):
                raise serializers.ValidationError(
                    {"detail": "This mobile number is already registered. Please log in."}
                )
            # User exists but no customer — reuse the user
            user = existing_user
        else:
            user = User.objects.create_user(
                username=validated_data['username'],
                email=validated_data.get('email', ''),
                password=None
            )

        # Generate a unique customer_id
        last_4 = mobile[-4:] if len(mobile) >= 4 else mobile
        rand_4 = f"{random.randint(0, 9999):04d}"
        customer_id = f"CUS{last_4}{rand_4}"

        Customer.objects.create(
            user=user,
            customer_id=customer_id,
            name=name,
            mobile=mobile,
            email=validated_data.get('email', '')
        )
        return user


class CustomerSerializer(serializers.ModelSerializer):
    is_staff = serializers.SerializerMethodField()
    username = serializers.ReadOnlyField(source='user.username')

    class Meta:
        model = Customer
        fields = ('id', 'customer_id', 'name', 'mobile', 'email', 'is_member', 'is_staff', 'username', 'created_at')

    def get_is_staff(self, obj):
        return obj.user.is_staff if obj.user else False
