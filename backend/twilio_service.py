"""
Twilio WhatsApp and SMS Service
Handles OTP sending and booking notifications via WhatsApp
"""
from twilio.rest import Client
import os
import logging
from pathlib import Path
from dotenv import load_dotenv

# Load environment variables
ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

logger = logging.getLogger(__name__)

# Twilio Configuration
ACCOUNT_SID = os.environ.get('TWILIO_ACCOUNT_SID')
AUTH_TOKEN = os.environ.get('TWILIO_AUTH_TOKEN')
WHATSAPP_NUMBER = os.environ.get('TWILIO_WHATSAPP_NUMBER', 'whatsapp:+14155238886')

# Initialize Twilio client
twilio_client = None

def get_twilio_client():
    """Get or create Twilio client instance"""
    global twilio_client
    if twilio_client is None:
        logger.info(f"Initializing Twilio client...")
        logger.info(f"ACCOUNT_SID: {ACCOUNT_SID[:10] if ACCOUNT_SID else 'None'}...")
        logger.info(f"AUTH_TOKEN: {'*' * 10 if AUTH_TOKEN else 'None'}")
        
        if not all([ACCOUNT_SID, AUTH_TOKEN]):
            logger.warning("Twilio credentials not configured. Using mock mode.")
            return None
        try:
            # Use Account SID and Auth Token for authentication
            twilio_client = Client(ACCOUNT_SID, AUTH_TOKEN)
            logger.info("Twilio client initialized successfully with Auth Token authentication")
        except Exception as e:
            logger.error(f"Failed to initialize Twilio client: {e}")
            return None
    return twilio_client


async def send_whatsapp_otp(phone_number: str, otp: str) -> dict:
    """
    Send OTP via WhatsApp
    
    Args:
        phone_number: Recipient's phone number in E.164 format (e.g., +919876543210)
        otp: The OTP code to send
        
    Returns:
        dict with status and message_sid or error
    """
    client = get_twilio_client()
    
    if client is None:
        logger.warning(f"Twilio not configured. Mock OTP sent to {phone_number}: {otp}")
        return {
            "status": "mock",
            "message": f"Mock OTP: {otp} (Twilio not configured)",
            "otp": otp  # For testing only
        }
    
    try:
        # Format phone number for WhatsApp
        to_whatsapp = f"whatsapp:{phone_number}"
        
        # Create message body
        message_body = f"""
🔐 *The Looks Salon - OTP Verification*

Your OTP for salon login is: *{otp}*

This code is valid for 10 minutes.
Please do not share this code with anyone.

Thank you for using The Looks Salon! 💈
        """.strip()
        
        # Send WhatsApp message
        message = client.messages.create(
            body=message_body,
            from_=WHATSAPP_NUMBER,
            to=to_whatsapp
        )
        
        logger.info(f"WhatsApp OTP sent successfully to {phone_number}. SID: {message.sid}")
        
        return {
            "status": "sent",
            "message_sid": message.sid,
            "to": phone_number
        }
        
    except Exception as e:
        logger.error(f"Failed to send WhatsApp OTP to {phone_number}: {str(e)}")
        return {
            "status": "failed",
            "error": str(e),
            "otp": otp  # Return OTP for fallback/testing
        }


async def send_whatsapp_notification(phone_number: str, message: str, template_name: str = None) -> dict:
    """
    Send WhatsApp notification message
    
    Args:
        phone_number: Recipient's phone number in E.164 format
        message: Message content to send
        template_name: Optional template identifier for logging
        
    Returns:
        dict with status and message_sid or error
    """
    client = get_twilio_client()
    
    if client is None:
        logger.warning(f"Twilio not configured. Mock notification to {phone_number}")
        return {
            "status": "mock",
            "message": message
        }
    
    try:
        # Format phone number for WhatsApp
        to_whatsapp = f"whatsapp:{phone_number}"
        
        # Send WhatsApp message
        whatsapp_message = client.messages.create(
            body=message,
            from_=WHATSAPP_NUMBER,
            to=to_whatsapp
        )
        
        logger.info(f"WhatsApp notification sent to {phone_number}. Template: {template_name}, SID: {whatsapp_message.sid}")
        
        return {
            "status": "sent",
            "message_sid": whatsapp_message.sid,
            "to": phone_number,
            "template": template_name
        }
        
    except Exception as e:
        logger.error(f"Failed to send WhatsApp notification to {phone_number}: {str(e)}")
        return {
            "status": "failed",
            "error": str(e)
        }


# Notification Templates
def format_booking_confirmation(customer_name: str, token_number: int, date: str, time_slot: str, barber_name: str, salon_name: str) -> str:
    """Format booking confirmation message"""
    return f"""
✅ *Booking Confirmed!*

Hello {customer_name}! 👋

Your appointment at *{salon_name}* has been confirmed.

📋 *Booking Details:*
🎫 Token Number: *#{token_number}*
📅 Date: {date}
🕐 Time Slot: {time_slot}
💈 Barber: {barber_name}

We look forward to serving you!

_The Looks Salon_
    """.strip()


def format_queue_status(customer_name: str, current_token: int, user_token: int, tokens_away: int, estimated_time: str) -> str:
    """Format queue status notification"""
    return f"""
⏰ *Queue Update*

Hello {customer_name}! 

📊 *Current Status:*
▶️ Now Serving: Token #{current_token}
🎫 Your Token: *#{user_token}*
📍 You are *{tokens_away} tokens away*
⏱️ Estimated wait: ~{estimated_time}

Please be ready! We'll notify you when your turn is near.

_The Looks Salon_
    """.strip()


def format_token_near(customer_name: str, user_token: int, tokens_away: int) -> str:
    """Format notification when user is near (3 or 1 token away)"""
    if tokens_away == 1:
        urgency = "🔔 *GET READY!*"
        message = "You're next! Please be ready."
    else:
        urgency = "⚠️ *Almost Your Turn!*"
        message = f"Only {tokens_away} customers ahead of you."
    
    return f"""
{urgency}

Hello {customer_name}!

🎫 Your Token: *#{user_token}*
{message}

Please arrive at the salon if you haven't already.

_The Looks Salon_
    """.strip()


def format_token_called(customer_name: str, token_number: int, barber_name: str) -> str:
    """Format notification when token is called"""
    return f"""
🎉 *YOUR TURN!*

Hello {customer_name}!

🎫 Token #{token_number} is now being called!
💈 Please proceed to {barber_name}'s chair.

_The Looks Salon_
    """.strip()


def format_salon_calling(customer_name: str, salon_name: str, barber_name: str) -> str:
    """
    Format the message sent when the salon explicitly clicks
    "Send Notification to Customer" on the token management screen.
    Per product spec — must be a clear, friendly call to come in.
    Reschedule / Cancel action links are appended by send_booking_notification.
    """
    cust = customer_name or "Customer"
    salon = salon_name or "The salon"
    barber = barber_name or "your barber"
    return f"""
🔔 *{salon} is calling you*

Hello {cust}!

{salon} is calling you. Please proceed to *{barber}*'s chair.
If you have other plans, please inform the salon.

ℹ️ _Note: Rescheduling will assign you the next available token._
    """.strip()


def format_token_cancelled(customer_name: str, token_number: int, reason: str = None) -> str:
    """Format cancellation notification"""
    reason_text = f"\nReason: {reason}" if reason else ""
    
    return f"""
❌ *Booking Cancelled*

Hello {customer_name},

Your booking (Token #{token_number}) has been cancelled.{reason_text}

Please contact us if you have any questions or would like to reschedule.

_The Looks Salon_
    """.strip()


def format_token_rescheduled(customer_name: str, old_date: str, new_date: str, new_slot: str, token_number: int) -> str:
    """Format reschedule notification"""
    return f"""
📅 *Booking Rescheduled*

Hello {customer_name},

Your booking has been rescheduled:

🎫 Token: #{token_number}
❌ Old Date: {old_date}
✅ New Date: {new_date}
🕐 New Time: {new_slot}

See you then!

_The Looks Salon_
    """.strip()
