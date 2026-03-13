import logging

logger = logging.getLogger(__name__)

def send_sms(mobile, message):
    """
    Sends an SMS notification.
    Currently mocked to log to console.
    Can be extended to integrate with Twilio, Msg91, etc.
    """
    # Mock SMS sending
    print(f"\n--- SMS SENT TO {mobile} ---\n{message}\n---------------------------\n")
    logger.info(f"SMS Sent to {mobile}: {message}")
    return True

def notify_booking_confirmation(booking):
    message = (
        f"Hi {booking.customer.name}, your booking {booking.booking_id} at 43C is CONFIRMED! "
        f"Date: {booking.date}, Slot: {booking.slot.start_time}. "
        f"Guests: {booking.guest_count}. Show your QR code at entry."
    )
    send_sms(booking.customer.mobile, message)

def notify_admin_new_booking(booking):
    admin_mobile = "9999999999" # Placeholder
    message = (
        f"New Booking at 43C: {booking.booking_id} by {booking.customer.name}. "
        f"Mobile: {booking.customer.mobile}, Slot: {booking.slot.start_time}, Guests: {booking.guest_count}."
    )
    send_sms(admin_mobile, message)
