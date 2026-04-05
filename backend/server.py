from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional
import uuid
from datetime import datetime, timezone, time, timedelta
from apscheduler.schedulers.asyncio import AsyncIOScheduler
import io
import base64
import qrcode
import jwt
from passlib.context import CryptContext
import random
import math

# Import Twilio service
from twilio_service import (
    send_whatsapp_otp, 
    send_whatsapp_notification,
    format_booking_confirmation,
    format_queue_status,
    format_token_near,
    format_token_called,
    format_token_cancelled,
    format_token_rescheduled
)

# Import invoice service
from invoice_service import generate_invoice_pdf, save_invoice_pdf

ROOT_DIR = Path(__file__).parent
load_dotenv(ROOT_DIR / '.env')

# MongoDB connection
mongo_url = os.environ['MONGO_URL']
client = AsyncIOMotorClient(mongo_url)
db = client[os.environ['DB_NAME']]

# JWT Configuration
SECRET_KEY = os.environ.get('JWT_SECRET_KEY', 'your-secret-key-change-in-production')
ALGORITHM = "HS256"
pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")
security = HTTPBearer()

# Socket.IO setup
sio = socketio.AsyncServer(async_mode='asgi', cors_allowed_origins='*')

# Create the main app
app = FastAPI()
api_router = APIRouter(prefix="/api")

# Socket.IO app
socket_app = socketio.ASGIApp(sio, app)

# ============ MODELS ============

# Salon Models
class SalonCreate(BaseModel):
    salon_name: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    address: str
    latitude: float
    longitude: float
    upi_id: Optional[str] = None
    payment_timing: str = "after"  # before/after
    password: Optional[str] = None  # Optional password for login

class SalonUpdate(BaseModel):
    salon_name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    upi_id: Optional[str] = None
    payment_timing: Optional[str] = None
    is_gst_registered: Optional[bool] = None
    gstin: Optional[str] = None
    logo_url: Optional[str] = None
    photo_gallery: Optional[List[str]] = None
    tax_rate: Optional[float] = None
    invoice_prefix: Optional[str] = None
    invoice_start_number: Optional[int] = None
    password: Optional[str] = None  # To update password

class SalonPasswordLogin(BaseModel):
    phone: str
    password: str

class Salon(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_name: str
    owner_name: str
    phone: str
    email: Optional[str] = None
    address: str
    city: Optional[str] = None  # City for filtering
    latitude: float
    longitude: float
    upi_id: Optional[str] = None
    payment_timing: str
    is_active: bool = True
    is_gst_registered: bool = False
    gstin: Optional[str] = None
    logo_url: Optional[str] = None
    photo_gallery: List[str] = []  # Array of image URLs
    rating: float = 4.5  # Average rating out of 5
    gender_tag: Optional[str] = "Unisex"  # Unisex/Men/Women
    tax_rate: float = 2.5  # Default GST rate (CGST + SGST = 5%)
    invoice_prefix: str = "INV"  # Invoice number prefix
    invoice_start_number: int = 1  # Starting invoice number
    current_invoice_number: int = 1  # Current invoice counter
    created_at: str

# Service Models
class ServiceCreate(BaseModel):
    service_name: str
    description: Optional[str] = None
    category: str = "General"  # Category for grouping
    gender_tag: str = "Unisex"  # Men/Women/Unisex
    default_duration: int = 30  # minutes
    base_price: float = 0
    price_type: str = "fixed"  # fixed/onwards
    images: List[str] = []  # List of image URLs
    is_favorite: bool = False
    is_enabled: bool = True  # Salon can enable/disable
    available_at_home: bool = False  # Can be delivered at home

class ServiceUpdate(BaseModel):
    service_name: Optional[str] = None
    description: Optional[str] = None
    category: Optional[str] = None
    gender_tag: Optional[str] = None
    default_duration: Optional[int] = None
    base_price: Optional[float] = None
    price_type: Optional[str] = None
    images: Optional[List[str]] = None
    is_favorite: Optional[bool] = None
    favorite_order: Optional[int] = None
    is_enabled: Optional[bool] = None
    available_at_home: Optional[bool] = None

class Service(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    service_name: str
    description: Optional[str] = None
    category: str = "General"
    gender_tag: str = "Unisex"
    default_duration: int
    base_price: float
    price_type: str = "fixed"
    images: List[str] = []
    is_favorite: bool = False
    favorite_order: Optional[int] = None
    is_active: bool = True
    is_enabled: bool = True
    available_at_home: bool = False

# Package Models
class PackageService(BaseModel):
    service_id: str
    service_name: str

class PackageCreate(BaseModel):
    package_name: str
    description: Optional[str] = None
    service_ids: List[str]
    total_price: float
    image_url: Optional[str] = None
    gender_tag: str = "Unisex"

class Package(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    package_name: str
    description: Optional[str] = None
    service_ids: List[str]
    total_price: float
    image_url: Optional[str] = None
    gender_tag: str = "Unisex"
    is_active: bool = True
    created_at: str

# Salon-Specific Package Models (for customized packages per salon)
class SalonPackageCreate(BaseModel):
    salon_id: str
    package_name: str
    description: Optional[str] = None
    service_ids: List[str]
    total_price: float
    image_url: Optional[str] = None
    gender_tag: str = "Unisex"

class SalonPackageUpdate(BaseModel):
    package_name: Optional[str] = None
    description: Optional[str] = None
    service_ids: Optional[List[str]] = None
    total_price: Optional[float] = None
    image_url: Optional[str] = None
    gender_tag: Optional[str] = None
    is_active: Optional[bool] = None

class SalonPackage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    package_name: str
    description: Optional[str] = None
    service_ids: List[str]
    total_price: float
    image_url: Optional[str] = None
    gender_tag: str = "Unisex"
    is_active: bool = True
    created_at: str

# Barber Models
class BarberCreate(BaseModel):
    name: str
    salon_id: str
    experience: int
    category: str
    specialization: Optional[str] = None
    mobile: str
    profile_image: Optional[str] = None

class BarberUpdate(BaseModel):
    name: Optional[str] = None
    experience: Optional[int] = None
    category: Optional[str] = None
    specialization: Optional[str] = None
    mobile: Optional[str] = None
    queue_status: Optional[str] = None
    profile_image: Optional[str] = None
    on_leave: Optional[bool] = None

class Barber(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    salon_id: str
    experience: int
    category: str
    specialization: Optional[str] = None
    mobile: str
    profile_image: Optional[str] = None
    queue_status: str = "available"  # available/busy/offline
    on_leave: bool = False  # True if barber is on leave
    is_active: bool = True

class BarberServicePrice(BaseModel):
    barber_id: str
    service_id: str
    price: float
    is_available: bool = True

class BarberServiceAssignment(BaseModel):
    service_id: str
    price: float
    is_available: bool = True

# Auth Models
class SalonOTPRequest(BaseModel):
    phone: str

class SalonOTPVerify(BaseModel):
    phone: str
    otp: str

class SalonLogin(BaseModel):
    phone: str
    password: Optional[str] = None

class SalonToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    salon_id: str

# User Models
class UserLogin(BaseModel):
    name: str
    phone: str
    gender: Optional[str] = None  # Men/Women

class User(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    name: str
    phone: str
    gender: Optional[str] = None  # Men/Women
    created_at: str

# Token/Booking Models
class BookingCreate(BaseModel):
    salon_id: str
    user_id: str
    customer_name: str
    phone: str
    date: str
    shift: str  # Morning/Noon/Evening
    time_slot: Optional[str] = None  # Keep for backward compatibility
    barber_id: str  # can be "any"
    selected_services: List[str]
    source: str = "online"
    booking_type: str = "instant"  # instant/future
    booking_for_self: bool = True  # True = self, False = others

class TokenModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    token_number: str  # Now string format: M001, N001, E001
    customer_name: str
    phone: str
    user_id: Optional[str] = None
    date: str
    shift: str  # Morning/Noon/Evening
    time_slot: Optional[str] = None  # Keep for backward compatibility
    barber_id: str
    barber_name: str
    selected_services: List[str]
    total_amount: float
    status: str = "waiting"  # waiting | called | completed | skipped
    payment_status: str = "pending"
    payment_mode: Optional[str] = None
    upi_transaction_id: Optional[str] = None
    source: str
    booking_type: str
    booking_for_self: bool = True
    allocated_at: Optional[str] = None
    called_at: Optional[str] = None
    completed_at: Optional[str] = None
    recall_count: int = 0
    invoice_id: Optional[str] = None  # Link to invoice
    created_at: str

class AddServicesRequest(BaseModel):
    service_ids: List[str]  # List of new service IDs to add

# Invoice Model
class Invoice(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    token_id: str
    salon_id: str
    invoice_number: str
    customer_name: str
    customer_phone: str
    invoice_data: dict  # Complete invoice data including services, amounts, etc.
    pdf_base64: Optional[str] = None  # Base64 encoded PDF
    created_at: str

# ============ AUTH HELPERS ============

def create_access_token(data: dict):
    to_encode = data.copy()
    encoded_jwt = jwt.encode(to_encode, SECRET_KEY, algorithm=ALGORITHM)
    return encoded_jwt

def verify_token(token: str):
    try:
        payload = jwt.decode(token, SECRET_KEY, algorithms=[ALGORITHM])
        return payload
    except jwt.InvalidTokenError:
        return None

async def get_current_salon(credentials: HTTPAuthorizationCredentials = Depends(security)):
    token = credentials.credentials
    payload = verify_token(token)
    if not payload or payload.get("role") != "salon":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return payload

# ============ HELPER FUNCTIONS ============

def generate_otp():
    """Generate a random 6-digit OTP"""
    return str(random.randint(100000, 999999))

def calculate_distance(lat1, lon1, lat2, lon2):
    """Calculate distance between two coordinates in km"""
    R = 6371  # Earth's radius in km
    
    dlat = math.radians(lat2 - lat1)
    dlon = math.radians(lon2 - lon1)
    
    a = (math.sin(dlat / 2) * math.sin(dlat / 2) +
         math.cos(math.radians(lat1)) * math.cos(math.radians(lat2)) *
         math.sin(dlon / 2) * math.sin(dlon / 2))
    c = 2 * math.atan2(math.sqrt(a), math.sqrt(1 - a))
    
    return R * c

def get_shifts():
    """Get available shifts with timings"""
    return [
        {"id": "Morning", "name": "Morning", "time": "7 AM - 11 AM"},
        {"id": "Noon", "name": "Noon", "time": "11 AM - 4 PM"},
        {"id": "Evening", "name": "Evening", "time": "4 PM - 9 PM"}
    ]

def get_shift_prefix(shift: str) -> str:
    """Get token prefix for shift"""
    prefixes = {
        "Morning": "M",
        "Noon": "N",
        "Evening": "E"
    }
    return prefixes.get(shift, "M")

def extract_token_sequence(token_number: str) -> int:
    """Extract numeric sequence from token (e.g., M001 -> 1)"""
    try:
        return int(token_number[1:])  # Skip first character (prefix)
    except:
        return 0

async def get_next_token_number(salon_id: str, barber_id: str, date: str, shift: str) -> str:
    """Get next token number for specific salon/barber/date/shift"""
    prefix = get_shift_prefix(shift)
    
    # Find all tokens for this shift (tokens starting with the shift prefix)
    tokens = await db.tokens.find(
        {"salon_id": salon_id, "barber_id": barber_id, "date": date},
        {"_id": 0, "token_number": 1}
    ).to_list(1000)
    
    # Filter tokens for this shift and get max sequence
    shift_tokens = [t for t in tokens if t.get("token_number", "").startswith(prefix)]
    
    if shift_tokens:
        max_seq = max([extract_token_sequence(t["token_number"]) for t in shift_tokens])
        next_seq = max_seq + 1
    else:
        next_seq = 1
    
    # Format as prefix + 3-digit number (e.g., M001, N042)
    return f"{prefix}{next_seq:03d}"

def generate_2hour_slots():
    """DEPRECATED: Generate 2-hour time slots (kept for backward compatibility)"""
    slots = []
    start_times = list(range(8, 22, 2))  # 8AM to 10PM, every 2 hours
    
    for start in start_times:
        end = start + 2
        slot = f"{start:02d}:00-{end:02d}:00"
        slots.append(slot)
    
    return slots

async def calculate_booking_total(service_ids: List[str], barber_id: str) -> float:
    """Calculate total amount for selected services"""
    total = 0.0
    for service_id in service_ids:
        pricing = await db.barber_services.find_one({
            "barber_id": barber_id,
            "service_id": service_id
        })
        if pricing:
            total += pricing.get("price", 0)
    return total

async def broadcast_update(event_type: str, data: dict):
    """Broadcast updates via WebSocket"""
    await sio.emit(event_type, data)

async def send_booking_notification(token_data: dict, notification_type: str):
    """Send WhatsApp notification for booking events"""
    try:
        phone = token_data.get('phone')
        customer_name = token_data.get('customer_name')
        
        if not phone:
            logger.warning(f"No phone number for notification type: {notification_type}")
            return
        
        # Get salon details
        salon = await db.salons.find_one({"id": token_data.get('salon_id')}, {"_id": 0})
        salon_name = salon.get('salon_name', 'The Looks Salon') if salon else 'The Looks Salon'
        
        message = None
        
        if notification_type == 'booking_confirmation':
            message = format_booking_confirmation(
                customer_name=customer_name,
                token_number=token_data.get('token_number', 0),
                date=token_data.get('date'),
                time_slot=token_data.get('time_slot'),
                barber_name=token_data.get('barber_name'),
                salon_name=salon_name
            )
        elif notification_type == 'token_called':
            message = format_token_called(
                customer_name=customer_name,
                token_number=token_data.get('token_number'),
                barber_name=token_data.get('barber_name')
            )
        elif notification_type == 'token_cancelled':
            message = format_token_cancelled(
                customer_name=customer_name,
                token_number=token_data.get('token_number'),
                reason=token_data.get('cancellation_reason')
            )
        
        if message:
            result = await send_whatsapp_notification(phone, message, notification_type)
            logger.info(f"Notification sent: {notification_type} to {phone}, status: {result.get('status')}")
            
    except Exception as e:
        logger.error(f"Failed to send notification {notification_type}: {str(e)}")

async def check_and_notify_nearby_tokens(salon_id: str, barber_id: str, date: str, current_token_number: str):
    """Check and notify customers who are 3 or 1 token away"""
    try:
        # Get all waiting tokens for this barber
        waiting_tokens = await db.tokens.find(
            {"salon_id": salon_id, "barber_id": barber_id, "date": date, "status": "waiting"},
            {"_id": 0}
        ).sort("token_number", 1).to_list(100)
        
        current_seq = extract_token_sequence(current_token_number)
        
        for token in waiting_tokens:
            token_number = token.get('token_number')
            token_seq = extract_token_sequence(token_number)
            tokens_away = token_seq - current_seq
            
            # Notify if 3 tokens away or 1 token away
            if tokens_away == 3 or tokens_away == 1:
                message = format_token_near(
                    customer_name=token.get('customer_name'),
                    user_token=token_number,
                    tokens_away=tokens_away
                )
                
                await send_whatsapp_notification(
                    token.get('phone'), 
                    message, 
                    f'token_{tokens_away}_away'
                )
                
                logger.info(f"Notified token #{token_number} ({tokens_away} away)")
                
    except Exception as e:
        logger.error(f"Failed to check nearby tokens: {str(e)}")

async def generate_and_send_invoice(token_id: str):
    """Generate invoice PDF and send via WhatsApp"""
    try:
        # Get token details
        token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
        if not token:
            raise Exception("Token not found")
        
        # Get salon details
        salon = await db.salons.find_one({"id": token['salon_id']}, {"_id": 0})
        if not salon:
            raise Exception("Salon not found")
        
        # Get services details
        services_data = []
        total_amount = 0
        
        for service_id in token.get('selected_services', []):
            service = await db.services.find_one({"id": service_id}, {"_id": 0})
            if service:
                # For simplicity, no discount here - can be added later
                price = service.get('base_price', 0)
                services_data.append({
                    "name": service.get('service_name'),
                    "price": price,
                    "discount": 0,
                    "amount": price
                })
                total_amount += price
        
        # Calculate tax if GST registered
        is_tax_invoice = salon.get('is_gst_registered', False)
        tax_rate = salon.get('tax_rate', 9.0)
        
        if is_tax_invoice:
            subtotal = total_amount
            cgst = subtotal * (tax_rate / 100)
            sgst = subtotal * (tax_rate / 100)
            total = subtotal + cgst + sgst
        else:
            subtotal = total_amount
            cgst = 0
            sgst = 0
            total = subtotal
        
        # Generate invoice number using salon's prefix and counter
        invoice_prefix = salon.get('invoice_prefix', 'INV')
        current_number = salon.get('current_invoice_number')
        
        # If current_invoice_number not set, initialize from invoice_start_number
        if current_number is None:
            current_number = salon.get('invoice_start_number', 1)
            # Set it in database
            await db.salons.update_one(
                {"id": salon['id']},
                {"$set": {"current_invoice_number": current_number}}
            )
        
        # Calculate padding based on number size (minimum 4 digits)
        padding = max(4, len(str(current_number)))
        invoice_no = f"{invoice_prefix}{str(current_number).zfill(padding)}"
        
        # Increment invoice counter for next time
        await db.salons.update_one(
            {"id": salon['id']},
            {"$inc": {"current_invoice_number": 1}}
        )        
        # Prepare invoice data
        invoice_data = {
            "salon": {
                "salon_name": salon.get('salon_name', 'Salon'),
                "address": salon.get('address', ''),
                "gstin": salon.get('gstin'),
                "logo_url": salon.get('logo_url')
            },
            "customer": {
                "name": token.get('customer_name', 'Customer'),
                "phone": token.get('phone', '')
            },
            "invoice_no": invoice_no,
            "date": datetime.now().strftime('%d/%m/%Y'),
            "services": services_data,
            "subtotal": subtotal,
            "cgst": cgst,
            "sgst": sgst,
            "tax_rate": tax_rate,
            "total": total,
            "payment_method": "UPI",
            "is_tax_invoice": is_tax_invoice
        }
        
        # Generate PDF
        pdf_data = generate_invoice_pdf(invoice_data)
        
        # Convert PDF to base64 for storage
        import base64
        pdf_base64 = base64.b64encode(pdf_data).decode('utf-8')
        
        # Create invoice ID
        invoice_id = str(uuid.uuid4())
        
        # Generate invoice link
        invoice_link = f"{os.getenv('REACT_APP_BACKEND_URL', 'http://localhost:8001')}/api/invoices/{invoice_id}/view"
        
        # Send link via WhatsApp
        message = f"""
📄 *Invoice Generated*

Hello {token.get('customer_name')}!

Your service at {salon.get('salon_name')} is complete.

*Invoice #{invoice_no}*
Total Amount: ₹{total:.2f}

🔗 View/Download Invoice:
{invoice_link}

Thank you for visiting us! 💈
        """.strip()
        
        # Send message with link
        result = await send_whatsapp_notification(
            token.get('phone'),
            message,
            'invoice_sent'
        )
        
        # Store invoice record with base64 PDF
        invoice_record = {
            "id": invoice_id,
            "token_id": token_id,
            "invoice_no": invoice_no,
            "salon_id": token['salon_id'],
            "customer_name": token.get('customer_name'),
            "customer_phone": token.get('phone'),
            "invoice_data": invoice_data,
            "pdf_base64": pdf_base64,
            "amount": total,
            "sent_at": datetime.now(timezone.utc).isoformat(),
            "sent_status": result.get('status'),
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.invoices.insert_one(invoice_record)
        
        # Update token with invoice_id
        await db.tokens.update_one(
            {"id": token_id},
            {"$set": {"invoice_id": invoice_id}}
        )
        
        logger.info(f"Invoice {invoice_no} generated and link sent to {token.get('phone')}")
        
        return {
            "success": True,
            "invoice_id": invoice_id,
            "invoice_number": invoice_no,
            "invoice_link": invoice_link
        }
        
    except Exception as e:
        logger.error(f"Failed to generate and send invoice: {str(e)}")
        return {"success": False, "error": str(e)}

# ============ INITIALIZATION ============

async def initialize_data():
    """Initialize default data"""
    
    # Initialize default salon
    salon_count = await db.salons.count_documents({})
    if salon_count == 0:
        default_salon = {
            "id": str(uuid.uuid4()),
            "salon_name": "The Looks Unisex Salon",
            "owner_name": "Owner Name",
            "phone": "+919876543210",
            "email": "salon@example.com",
            "address": "123 Main Street, Bangalore, Karnataka",
            "latitude": 12.9716,
            "longitude": 77.5946,
            "upi_id": "salon@upi",
            "payment_timing": "after",
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.salons.insert_one(default_salon)
        salon_id = default_salon["id"]
    else:
        salon = await db.salons.find_one({}, {"_id": 0})
        salon_id = salon["id"]
    
    # Initialize services
    service_count = await db.services.count_documents({})
    if service_count == 0:
        services = [
            {"id": str(uuid.uuid4()), "service_name": "Haircut", "description": "Regular haircut", "default_duration": 30, "base_price": 150, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Beard Trim", "description": "Beard trimming and shaping", "default_duration": 20, "base_price": 80, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Hair Color", "description": "Full hair coloring", "default_duration": 60, "base_price": 500, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Facial", "description": "Relaxing facial treatment", "default_duration": 45, "base_price": 400, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Head Massage", "description": "Soothing head massage", "default_duration": 30, "base_price": 200, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Hair Spa", "description": "Complete hair spa treatment", "default_duration": 60, "base_price": 600, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Shave", "description": "Clean shave", "default_duration": 20, "base_price": 100, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Pedicure", "description": "Foot care and pedicure", "default_duration": 45, "base_price": 350, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Manicure", "description": "Hand care and manicure", "default_duration": 45, "base_price": 300, "is_active": True},
            {"id": str(uuid.uuid4()), "service_name": "Waxing", "description": "Body waxing service", "default_duration": 40, "base_price": 400, "is_active": True}
        ]
        await db.services.insert_many(services)
        service_ids = [s["id"] for s in services]
    else:
        services = await db.services.find({}, {"_id": 0}).to_list(100)
        service_ids = [s["id"] for s in services]
    
    # Initialize barbers
    barber_count = await db.barbers.count_documents({})
    if barber_count == 0:
        barbers = [
            {
                "id": str(uuid.uuid4()),
                "name": "Imran",
                "salon_id": salon_id,
                "experience": 8,
                "category": "master",
                "mobile": "+919876543211",
                "queue_status": "available",
                "is_active": True
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Abdul",
                "salon_id": salon_id,
                "experience": 5,
                "category": "star",
                "mobile": "+919876543212",
                "queue_status": "available",
                "is_active": True
            }
        ]
        await db.barbers.insert_many(barbers)
        
        # Set pricing for each barber
        for barber in barbers:
            for i, service_id in enumerate(service_ids):
                # Imran (master) has higher prices
                if barber["name"] == "Imran":
                    price = services[i]["base_price"] * 1.2
                else:
                    price = services[i]["base_price"]
                
                pricing = {
                    "id": str(uuid.uuid4()),
                    "barber_id": barber["id"],
                    "service_id": service_id,
                    "price": price,
                    "is_available": True
                }
                await db.barber_services.insert_one(pricing)

async def allocate_future_tokens():
    """Run at 5-6 AM to allocate tokens for future bookings"""
    logger.info("Running future token allocation...")
    today = datetime.now(timezone.utc).date().isoformat()
    
    # Get all unallocated future bookings for today
    future_bookings = await db.tokens.find({
        "booking_type": "future",
        "date": today,
        "allocated_at": None
    }, {"_id": 0}).to_list(1000)
    
    # Group by salon and barber
    grouped = {}
    for booking in future_bookings:
        key = f"{booking['salon_id']}_{booking['barber_id']}"
        if key not in grouped:
            grouped[key] = []
        grouped[key].append(booking)
    
    # Allocate tokens
    for key, bookings in grouped.items():
        # Sort by time slot
        bookings.sort(key=lambda x: x['time_slot'])
        
        for i, booking in enumerate(bookings, start=1):
            await db.tokens.update_one(
                {"id": booking["id"]},
                {"$set": {
                    "token_number": i,
                    "allocated_at": datetime.now(timezone.utc).isoformat()
                }}
            )
    
    logger.info(f"Allocated {len(future_bookings)} future tokens")

# ============ WEBSOCKET EVENTS ============

@sio.event
async def connect(sid, environ):
    logger.info(f"Client connected: {sid}")

@sio.event
async def disconnect(sid):
    logger.info(f"Client disconnected: {sid}")



# ============ PREDEFINED SERVICES INITIALIZATION ============

from predefined_services import PREDEFINED_SERVICES, PREDEFINED_PACKAGES

async def initialize_predefined_services_for_salon(salon_id: str):
    """Initialize predefined services and packages for a salon on first access"""
    
    # Check if already initialized
    initialized = await db.salon_initialized.find_one({"salon_id": salon_id})
    if initialized:
        return {"already_initialized": True}
    
    # Always ensure predefined services exist (add missing ones)
    existing_services = await db.services.find({}, {"_id": 0, "service_name": 1, "category": 1}).to_list(1000)
    existing_set = {(s["service_name"], s.get("category", "General")) for s in existing_services}
    
    services_to_insert = []
    for service_data in PREDEFINED_SERVICES:
        service_key = (service_data["service_name"], service_data.get("category", "General"))
        if service_key not in existing_set:
            service = {
                "id": str(uuid.uuid4()),
                **service_data,
                "is_active": True,
                "images": [],
                "is_favorite": False
            }
            services_to_insert.append(service)
    
    if services_to_insert:
        await db.services.insert_many(services_to_insert)
        logger.info(f"Inserted {len(services_to_insert)} new predefined services")
    
    # Get all service IDs
    all_services = await db.services.find({}, {"_id": 0, "id": 1}).to_list(1000)
    service_ids = [s["id"] for s in all_services]
    
    # Initialize salon_services (all disabled by default - salon can enable them)
    # Only add services that don't already exist for this salon
    existing_salon_services = await db.salon_services.find(
        {"salon_id": salon_id},
        {"_id": 0, "service_id": 1}
    ).to_list(1000)
    existing_salon_service_ids = {ss["service_id"] for ss in existing_salon_services}
    
    salon_services_to_insert = []
    for service_id in service_ids:
        if service_id not in existing_salon_service_ids:
            salon_service = {
                "id": str(uuid.uuid4()),
                "salon_id": salon_id,
                "service_id": service_id,
                "is_enabled": False,  # Salon must enable services they want to offer
                "created_at": datetime.now(timezone.utc).isoformat()
            }
            salon_services_to_insert.append(salon_service)
    
    if salon_services_to_insert:
        await db.salon_services.insert_many(salon_services_to_insert)
        logger.info(f"Inserted {len(salon_services_to_insert)} salon_service mappings")
    
    # Initialize predefined packages for this salon
    packages_to_insert = []
    for package_data in PREDEFINED_PACKAGES:
        package = {
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            **package_data,
            "service_ids": [],  # Salon will add services to packages
            "is_active": True,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        packages_to_insert.append(package)
    
    if packages_to_insert:
        await db.salon_packages.insert_many(packages_to_insert)
    
    # Mark as initialized
    await db.salon_initialized.insert_one({
        "salon_id": salon_id,
        "initialized_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "initialized": True,
        "new_services_added": len(services_to_insert),
        "services_count": len(service_ids),
        "packages_count": len(packages_to_insert)
    }

# ============ API ROUTES ============

@api_router.get("/")
async def root():
    return {"message": "The Looks Salon API v3.0 - Multi-Salon Edition"}

# ============ SALON ROUTES ============

@api_router.get("/salons", response_model=List[Salon])
async def get_salons(lat: Optional[float] = None, lng: Optional[float] = None, radius: float = 2):
    """Get all salons, optionally filtered by location"""
    salons = await db.salons.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    if lat and lng:
        # Filter by distance
        nearby_salons = []
        for salon in salons:
            distance = calculate_distance(lat, lng, salon["latitude"], salon["longitude"])
            if distance <= radius:
                salon["distance"] = round(distance, 2)
                nearby_salons.append(salon)
        return sorted(nearby_salons, key=lambda x: x["distance"])
    
    return salons

@api_router.get("/salons/{salon_id}", response_model=Salon)
async def get_salon(salon_id: str):
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    return Salon(**salon)

@api_router.post("/salons", response_model=Salon)
async def create_salon(salon: SalonCreate, current_salon=Depends(get_current_salon)):
    salon_dict = salon.model_dump()
    salon_dict["id"] = str(uuid.uuid4())
    salon_dict["is_active"] = True
    salon_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.salons.insert_one(salon_dict)
    return Salon(**salon_dict)

@api_router.put("/salons/{salon_id}", response_model=Salon)
async def update_salon(salon_id: str, salon: SalonUpdate, current_salon=Depends(get_current_salon)):
    """Update salon profile (now supports partial updates)"""
    existing = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Only update fields that are provided
    update_data = {k: v for k, v in salon.model_dump().items() if v is not None}
    
    # If invoice_start_number is being changed, reset current_invoice_number
    if 'invoice_start_number' in update_data:
        update_data['current_invoice_number'] = update_data['invoice_start_number']
    
    if update_data:
        await db.salons.update_one({"id": salon_id}, {"$set": update_data})
    
    updated = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    return Salon(**updated)

@api_router.post("/salons/{salon_id}/initialize")
async def initialize_salon_services(salon_id: str, current_salon=Depends(get_current_salon)):
    """Initialize predefined services and packages for a salon"""
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    result = await initialize_predefined_services_for_salon(salon_id)
    return result

@api_router.post("/salons/{salon_id}/reset-initialization")
async def reset_salon_initialization(salon_id: str, current_salon=Depends(get_current_salon)):
    """Reset initialization flag - allows re-initialization of services"""
    await db.salon_initialized.delete_many({"salon_id": salon_id})
    return {"message": "Initialization reset. Services can be re-initialized now."}

@api_router.get("/salons/{salon_id}/services/enabled")
async def get_salon_enabled_services(salon_id: str):
    """Get all services enabled for a specific salon"""
    # Get salon's enabled services
    salon_services = await db.salon_services.find(
        {"salon_id": salon_id, "is_enabled": True},
        {"_id": 0}
    ).to_list(1000)
    
    service_ids = [ss["service_id"] for ss in salon_services]
    
    # Get service details
    services = await db.services.find(
        {"id": {"$in": service_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(1000)
    
    return services

@api_router.get("/salons/{salon_id}/services/all")
async def get_all_services_with_salon_status(salon_id: str):
    """Get all services with their enabled status for the salon"""
    # Get all services
    all_services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(1000)
    
    # Get salon's service statuses
    salon_services = await db.salon_services.find(
        {"salon_id": salon_id},
        {"_id": 0, "service_id": 1, "is_enabled": 1}
    ).to_list(1000)
    
    # Create a map of service_id to is_enabled
    salon_service_map = {ss["service_id"]: ss["is_enabled"] for ss in salon_services}
    
    # Add is_enabled field to each service
    for service in all_services:
        service["is_enabled_for_salon"] = salon_service_map.get(service["id"], False)
    
    return all_services

@api_router.put("/salons/{salon_id}/services/{service_id}/toggle")
async def toggle_service_for_salon(
    salon_id: str, 
    service_id: str, 
    is_enabled: bool,
    current_salon=Depends(get_current_salon)
):
    """Enable or disable a service for a specific salon"""
    # Check if salon_service entry exists
    salon_service = await db.salon_services.find_one({
        "salon_id": salon_id,
        "service_id": service_id
    })
    
    if salon_service:
        # Update existing
        await db.salon_services.update_one(
            {"salon_id": salon_id, "service_id": service_id},
            {"$set": {"is_enabled": is_enabled}}
        )
    else:
        # Create new entry
        await db.salon_services.insert_one({
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "service_id": service_id,
            "is_enabled": is_enabled,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"success": True, "is_enabled": is_enabled}


# ============ SERVICE ROUTES ============

@api_router.get("/services", response_model=List[Service])
async def get_services():
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(1000)
    return services

@api_router.post("/services", response_model=Service)
async def create_service(service: ServiceCreate, current_salon=Depends(get_current_salon)):
    service_dict = service.model_dump()
    service_dict["id"] = str(uuid.uuid4())
    service_dict["is_active"] = True
    
    await db.services.insert_one(service_dict)
    return Service(**service_dict)

@api_router.put("/services/{service_id}", response_model=Service)
async def update_service(service_id: str, service: ServiceUpdate, current_salon=Depends(get_current_salon)):
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_data = {k: v for k, v in service.model_dump().items() if v is not None}
    if update_data:
        await db.services.update_one({"id": service_id}, {"$set": update_data})
    
    updated = await db.services.find_one({"id": service_id}, {"_id": 0})
    return Service(**updated)

@api_router.delete("/services/{service_id}")
async def delete_service(service_id: str, current_salon=Depends(get_current_salon)):
    """Soft delete a service"""
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Service not found")
    
    await db.services.update_one({"id": service_id}, {"$set": {"is_active": False}})
    # Also remove from all barber_services
    await db.barber_services.delete_many({"service_id": service_id})
    return {"message": "Service deleted"}

@api_router.get("/services/categories")
async def get_service_categories():
    """Get all unique service categories"""
    services = await db.services.find({"is_active": True}, {"_id": 0, "category": 1}).to_list(1000)
    categories = list(set([s.get("category", "General") for s in services]))
    return {"categories": sorted(categories)}

@api_router.get("/services/by-category")
async def get_services_by_category(gender: Optional[str] = None):
    """Get services grouped by category"""
    query = {"is_active": True}
    if gender and gender != "all":
        query["$or"] = [{"gender_tag": gender}, {"gender_tag": "Unisex"}]
    
    services = await db.services.find(query, {"_id": 0}).to_list(1000)
    
    # Group by category
    categorized = {}
    for service in services:
        category = service.get("category", "General")
        if category not in categorized:
            categorized[category] = []
        categorized[category].append(service)
    
    return categorized

@api_router.get("/services/favorites", response_model=List[Service])
async def get_favorite_services():
    """Get all favorite services"""
    services = await db.services.find(
        {"is_active": True, "is_favorite": True}, 
        {"_id": 0}
    ).sort("favorite_order", 1).to_list(100)
    return services

@api_router.put("/services/{service_id}/favorite")
async def toggle_favorite(service_id: str, is_favorite: bool, current_salon=Depends(get_current_salon)):
    """Mark/unmark service as favorite"""
    existing = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Service not found")
    
    update_data = {"is_favorite": is_favorite}
    if is_favorite:
        # Get max favorite_order and increment
        favorites = await db.services.find({"is_favorite": True}, {"_id": 0, "favorite_order": 1}).to_list(100)
        max_order = max([f.get("favorite_order", 0) for f in favorites]) if favorites else 0
        update_data["favorite_order"] = max_order + 1
    else:
        update_data["favorite_order"] = None
    
    await db.services.update_one({"id": service_id}, {"$set": update_data})
    return {"message": "Favorite status updated", "is_favorite": is_favorite}

@api_router.put("/services/favorites/reorder")
async def reorder_favorites(service_ids: List[str], current_salon=Depends(get_current_salon)):
    """Reorder favorites based on array order"""
    for index, service_id in enumerate(service_ids):
        await db.services.update_one(
            {"id": service_id},
            {"$set": {"favorite_order": index}}
        )
    return {"message": "Favorites reordered successfully"}

# ============ PACKAGE ROUTES ============

@api_router.get("/packages", response_model=List[Package])
async def get_packages(gender: Optional[str] = None):
    """Get all packages"""
    query = {"is_active": True}
    if gender and gender != "all":
        query["$or"] = [{"gender_tag": gender}, {"gender_tag": "Unisex"}]
    
    packages = await db.packages.find(query, {"_id": 0}).to_list(100)
    return packages

@api_router.post("/packages", response_model=Package)
async def create_package(package: PackageCreate, current_salon=Depends(get_current_salon)):
    """Create a new package"""
    package_dict = package.model_dump()
    package_dict["id"] = str(uuid.uuid4())
    package_dict["is_active"] = True
    package_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.packages.insert_one(package_dict)
    return Package(**package_dict)

@api_router.put("/packages/{package_id}", response_model=Package)
async def update_package(package_id: str, package: PackageCreate, current_salon=Depends(get_current_salon)):
    """Update a package"""
    existing = await db.packages.find_one({"id": package_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")
    
    update_data = package.model_dump()
    await db.packages.update_one({"id": package_id}, {"$set": update_data})
    
    updated = await db.packages.find_one({"id": package_id}, {"_id": 0})
    return Package(**updated)

@api_router.delete("/packages/{package_id}")
async def delete_package(package_id: str, current_salon=Depends(get_current_salon)):
    """Delete a package"""
    existing = await db.packages.find_one({"id": package_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")
    
    await db.packages.update_one({"id": package_id}, {"$set": {"is_active": False}})
    return {"message": "Package deleted"}

# ============ SALON-SPECIFIC PACKAGE ROUTES ============

@api_router.get("/salons/{salon_id}/packages", response_model=List[SalonPackage])
async def get_salon_packages(salon_id: str, gender: Optional[str] = None):
    """Get all packages for a specific salon"""
    query = {"salon_id": salon_id, "is_active": True}
    if gender and gender != "all":
        query["$or"] = [{"gender_tag": gender}, {"gender_tag": "Unisex"}]
    
    packages = await db.salon_packages.find(query, {"_id": 0}).to_list(100)
    return packages

@api_router.post("/salons/{salon_id}/packages", response_model=SalonPackage)
async def create_salon_package(
    salon_id: str,
    package: SalonPackageCreate,
    current_salon=Depends(get_current_salon)
):
    """Create a new package for a salon"""
    package_dict = package.model_dump()
    package_dict["id"] = str(uuid.uuid4())
    package_dict["is_active"] = True
    package_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.salon_packages.insert_one(package_dict)
    return SalonPackage(**package_dict)

@api_router.put("/salons/{salon_id}/packages/{package_id}", response_model=SalonPackage)
async def update_salon_package(
    salon_id: str,
    package_id: str,
    package: SalonPackageUpdate,
    current_salon=Depends(get_current_salon)
):
    """Update a salon's package"""
    existing = await db.salon_packages.find_one(
        {"id": package_id, "salon_id": salon_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")
    
    # Only update provided fields
    update_data = {k: v for k, v in package.model_dump().items() if v is not None}
    
    if update_data:
        await db.salon_packages.update_one(
            {"id": package_id, "salon_id": salon_id},
            {"$set": update_data}
        )
    
    updated = await db.salon_packages.find_one(
        {"id": package_id, "salon_id": salon_id},
        {"_id": 0}
    )
    return SalonPackage(**updated)

@api_router.delete("/salons/{salon_id}/packages/{package_id}")
async def delete_salon_package(
    salon_id: str,
    package_id: str,
    current_salon=Depends(get_current_salon)
):
    """Delete a salon's package"""
    existing = await db.salon_packages.find_one(
        {"id": package_id, "salon_id": salon_id},
        {"_id": 0}
    )
    if not existing:
        raise HTTPException(status_code=404, detail="Package not found")
    
    await db.salon_packages.update_one(
        {"id": package_id, "salon_id": salon_id},
        {"$set": {"is_active": False}}
    )
    return {"message": "Package deleted"}


# ============ BARBER ROUTES ============

@api_router.get("/salons/{salon_id}/barbers", response_model=List[Barber])
async def get_salon_barbers(salon_id: str, available_only: bool = False):
    """
    Get barbers for a salon
    available_only=True: Only return barbers not on leave (for customer booking)
    available_only=False: Return all active barbers (for admin)
    """
    query = {"salon_id": salon_id, "is_active": True}
    if available_only:
        query["on_leave"] = {"$ne": True}  # Exclude barbers on leave
    
    barbers = await db.barbers.find(query, {"_id": 0}).to_list(100)
    return barbers

@api_router.post("/salons/{salon_id}/barbers", response_model=Barber)
async def create_barber(salon_id: str, barber: BarberCreate, current_salon=Depends(get_current_salon)):
    barber_dict = barber.model_dump()
    barber_dict["id"] = str(uuid.uuid4())
    barber_dict["salon_id"] = salon_id  # Override with URL param
    barber_dict["queue_status"] = "available"
    barber_dict["is_active"] = True
    
    await db.barbers.insert_one(barber_dict)
    return Barber(**barber_dict)

@api_router.put("/barbers/{barber_id}", response_model=Barber)
async def update_barber(barber_id: str, barber_update: BarberUpdate, current_salon=Depends(get_current_salon)):
    """Update barber details"""
    existing = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    update_data = {k: v for k, v in barber_update.model_dump().items() if v is not None}
    if update_data:
        await db.barbers.update_one({"id": barber_id}, {"$set": update_data})
    
    updated = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    return Barber(**updated)

@api_router.delete("/barbers/{barber_id}")
async def delete_barber(barber_id: str, current_salon=Depends(get_current_salon)):
    """Soft delete barber"""
    existing = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    await db.barbers.update_one({"id": barber_id}, {"$set": {"is_active": False}})
    return {"message": "Barber deleted"}

@api_router.get("/barbers/{barber_id}/services")
async def get_barber_services(barber_id: str):
    """Get services with barber-specific pricing"""
    services = await db.services.find({"is_active": True}, {"_id": 0}).to_list(100)
    
    result = []
    for service in services:
        pricing = await db.barber_services.find_one({
            "barber_id": barber_id,
            "service_id": service["id"]
        }, {"_id": 0})
        
        if pricing:
            result.append({
                **service,
                "barber_price": pricing["price"],
                "is_available": pricing["is_available"]
            })
        else:
            result.append({
                **service,
                "barber_price": service["base_price"],
                "is_available": False  # Not assigned yet
            })
    
    return result

@api_router.put("/barbers/{barber_id}/services")
async def update_barber_services(barber_id: str, services: List[BarberServiceAssignment], current_salon=Depends(get_current_salon)):
    """Bulk update barber services with pricing"""
    existing = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    # Clear existing service assignments for this barber
    await db.barber_services.delete_many({"barber_id": barber_id})
    
    # Insert new assignments
    for svc in services:
        if svc.is_available:  # Only add services that are enabled
            pricing = {
                "id": str(uuid.uuid4()),
                "barber_id": barber_id,
                "service_id": svc.service_id,
                "price": svc.price,
                "is_available": svc.is_available
            }
            await db.barber_services.insert_one(pricing)
    
    return {"message": f"Updated {len([s for s in services if s.is_available])} services for barber"}

@api_router.put("/barbers/{barber_id}/services/{service_id}/price")
async def update_barber_service_price(barber_id: str, service_id: str, price: float, current_salon=Depends(get_current_salon)):
    existing = await db.barber_services.find_one({"barber_id": barber_id, "service_id": service_id})
    
    if existing:
        await db.barber_services.update_one(
            {"barber_id": barber_id, "service_id": service_id},
            {"$set": {"price": price}}
        )
    else:
        pricing = {
            "id": str(uuid.uuid4()),
            "barber_id": barber_id,
            "service_id": service_id,
            "price": price,
            "is_available": True
        }
        await db.barber_services.insert_one(pricing)
    
    return {"message": "Price updated"}

# ============ AUTH ROUTES ============

@api_router.post("/salon/send-otp")
async def send_otp(request: SalonOTPRequest):
    """Send OTP to salon phone number via WhatsApp"""
    phone = request.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    logger.info(f"OTP request received for phone: {phone}")
    
    # Check if salon exists with this phone
    salon = await db.salons.find_one({"phone": phone}, {"_id": 0})
    salon_exists = salon is not None
    
    # Generate OTP
    otp = generate_otp()
    expires_at = datetime.now(timezone.utc) + timedelta(minutes=10)
    
    logger.info(f"Generated OTP for {phone}: {otp}")
    
    # Store OTP in database
    await db.salon_otp.delete_many({"phone": phone})
    await db.salon_otp.insert_one({
        "phone": phone,
        "otp": otp,
        "expires_at": expires_at.isoformat(),
        "verified": False
    })
    
    logger.info(f"OTP stored in database for {phone}")
    
    # Send OTP via WhatsApp
    whatsapp_result = await send_whatsapp_otp(phone, otp)
    
    logger.info(f"WhatsApp send result for {phone}: {whatsapp_result}")
    
    # Build response
    response = {
        "message": "OTP sent successfully via WhatsApp",
        "salon_exists": salon_exists,
        "delivery_status": whatsapp_result.get('status')
    }
    
    # Include OTP in response for testing (mock mode or failed delivery)
    if whatsapp_result.get('status') in ['mock', 'failed']:
        response['otp'] = otp
        if whatsapp_result.get('status') == 'mock':
            response['note'] = "⚠️ Twilio not configured - OTP shown for testing"
            logger.warning(f"Mock OTP for {phone}: {otp}")
        else:
            response['error'] = whatsapp_result.get('error')
            response['note'] = "OTP included because WhatsApp delivery failed"
            logger.error(f"WhatsApp delivery failed for {phone}: {whatsapp_result.get('error')}")
    else:
        # For successful WhatsApp delivery, also log OTP for debugging
        logger.info(f"✅ OTP sent via WhatsApp to {phone}. Check WhatsApp for OTP: {otp}")
        response['note'] = "OTP sent to your WhatsApp. Please check your messages."
    
    return response

@api_router.post("/salon/register", response_model=Salon)
async def register_salon(salon: SalonCreate):
    """Register a new salon"""
    # Normalize phone format first
    phone = salon.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    if len(phone) != 13:
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if salon with this phone already exists (use normalized phone)
    existing = await db.salons.find_one({"phone": phone}, {"_id": 0})
    if existing:
        raise HTTPException(status_code=400, detail="Salon already registered with this phone number")
    
    # Create salon
    salon_dict = salon.model_dump()
    salon_dict["phone"] = phone
    salon_dict["id"] = str(uuid.uuid4())
    salon_dict["is_active"] = True
    salon_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    # Hash password if provided
    if salon.password:
        salon_dict["password_hash"] = pwd_context.hash(salon.password)
        del salon_dict["password"]  # Don't store plain password
    
    await db.salons.insert_one(salon_dict)
    
    return Salon(**salon_dict)

@api_router.post("/salon/verify-otp", response_model=SalonToken)
async def verify_otp(request: SalonOTPVerify):
    """Verify OTP and return access token"""
    phone = request.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Check OTP
    otp_record = await db.salon_otp.find_one({"phone": phone, "otp": request.otp})
    
    if not otp_record:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    expires_at = datetime.fromisoformat(otp_record["expires_at"])
    if datetime.now(timezone.utc) > expires_at:
        raise HTTPException(status_code=400, detail="OTP expired")
    
    # Mark as verified
    await db.salon_otp.update_one(
        {"phone": phone, "otp": request.otp},
        {"$set": {"verified": True}}
    )
    
    # Find salon by phone
    salon = await db.salons.find_one({"phone": phone}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found for this phone")
    
    # Generate token
    token = create_access_token({"sub": salon["id"], "role": "salon", "phone": phone})
    
    return SalonToken(access_token=token, salon_id=salon["id"])

@api_router.post("/salon/password-login", response_model=SalonToken)
async def salon_password_login(credentials: SalonPasswordLogin):
    """Login with phone and password"""
    phone = credentials.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Find salon by phone
    salon = await db.salons.find_one({"phone": phone}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found for this phone number")
    
    # Check if password exists
    if "password_hash" not in salon or not salon["password_hash"]:
        raise HTTPException(status_code=400, detail="Password not set for this salon. Please use OTP login.")
    
    # Verify password
    if not pwd_context.verify(credentials.password, salon["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    # Generate token
    token = create_access_token({"sub": salon["id"], "role": "salon", "phone": phone})
    
    return SalonToken(access_token=token, salon_id=salon["id"])

@api_router.put("/salon/{salon_id}/set-password")
async def set_salon_password(salon_id: str, new_password: str, current_salon=Depends(get_current_salon)):
    """Set or update salon password"""
    if len(new_password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    
    # Hash password
    password_hash = pwd_context.hash(new_password)
    
    # Update salon
    await db.salons.update_one(
        {"id": salon_id},
        {"$set": {"password_hash": password_hash}}
    )
    
    return {"message": "Password updated successfully"}

@api_router.post("/user/login", response_model=User)
async def user_login(credentials: UserLogin):
    """User login with name and phone"""
    phone = credentials.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    if len(phone) != 13:
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Check if user exists
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    
    if user:
        # Update name and gender if changed
        update_fields = {}
        if user["name"] != credentials.name:
            update_fields["name"] = credentials.name
        if credentials.gender and user.get("gender") != credentials.gender:
            update_fields["gender"] = credentials.gender
        
        if update_fields:
            await db.users.update_one(
                {"phone": phone},
                {"$set": update_fields}
            )
            user.update(update_fields)
        
        return User(**user)
    else:
        new_user = {
            "id": str(uuid.uuid4()),
            "name": credentials.name,
            "phone": phone,
            "gender": credentials.gender,
            "created_at": datetime.now(timezone.utc).isoformat()
        }
        await db.users.insert_one(new_user)
        return User(**new_user)

# ============ BOOKING/TOKEN ROUTES ============

@api_router.get("/shifts")
async def get_available_shifts():
    """Get available shifts for booking"""
    return {"shifts": get_shifts()}

@api_router.get("/slots")
async def get_available_slots(date: Optional[str] = None):
    """DEPRECATED: Get 2-hour time slots (kept for backward compatibility)"""
    if date:
        parsed_date = datetime.fromisoformat(date).date()
        day_name = parsed_date.strftime("%A")
        
        # Check if Tuesday (closed)
        if day_name == "Tuesday":
            return {"slots": []}
    
    return {"slots": generate_2hour_slots()}

@api_router.post("/bookings", response_model=TokenModel)
async def create_booking(booking: BookingCreate):
    """Create new booking/token with shift-based system"""
    # Validate phone
    phone = booking.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Get barber details
    if booking.barber_id != "any":
        barber = await db.barbers.find_one({"id": booking.barber_id}, {"_id": 0})
        if not barber:
            raise HTTPException(status_code=404, detail="Barber not found")
        barber_name = barber["name"]
    else:
        barber_name = "Any Available"
    
    # Calculate total amount
    total_amount = 0
    if booking.barber_id != "any":
        total_amount = await calculate_booking_total(booking.selected_services, booking.barber_id)
    
    # Get token number with shift
    if booking.booking_type == "instant":
        token_number = await get_next_token_number(booking.salon_id, booking.barber_id, booking.date, booking.shift)
    else:
        # For future bookings, assign temporary token
        token_number = f"{get_shift_prefix(booking.shift)}000"
    
    # Create token
    token_dict = {
        "id": str(uuid.uuid4()),
        "salon_id": booking.salon_id,
        "token_number": token_number,
        "customer_name": booking.customer_name,
        "phone": phone,
        "user_id": booking.user_id,
        "date": booking.date,
        "shift": booking.shift,
        "time_slot": booking.time_slot,  # Optional, for backward compatibility
        "barber_id": booking.barber_id,
        "barber_name": barber_name,
        "selected_services": booking.selected_services,
        "total_amount": total_amount,
        "status": "waiting",
        "payment_status": "pending",
        "payment_mode": None,
        "upi_transaction_id": None,
        "source": booking.source,
        "booking_type": booking.booking_type,
        "booking_for_self": booking.booking_for_self,
        "allocated_at": datetime.now(timezone.utc).isoformat() if booking.booking_type == "instant" else None,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tokens.insert_one(token_dict)
    
    token = TokenModel(**token_dict)
    await broadcast_update("token_created", token.model_dump())
    
    # Send booking confirmation via WhatsApp
    await send_booking_notification(token_dict, 'booking_confirmation')
    
    return token

@api_router.get("/salons/{salon_id}/barbers/{barber_id}/queue", response_model=List[TokenModel])
async def get_barber_queue(salon_id: str, barber_id: str, date: Optional[str] = None, status: Optional[str] = None):
    """Get queue for specific barber"""
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    
    query = {"salon_id": salon_id, "barber_id": barber_id, "date": date}
    if status:
        query["status"] = status
    
    tokens = await db.tokens.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tokens

@api_router.get("/salons/{salon_id}/queue", response_model=List[TokenModel])
async def get_salon_queue(salon_id: str, date: Optional[str] = None, status: Optional[str] = None):
    """Get entire salon queue (all barbers)"""
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    
    query = {"salon_id": salon_id, "date": date}
    if status:
        query["status"] = status
    
    tokens = await db.tokens.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    return tokens

@api_router.post("/salons/{salon_id}/barbers/{barber_id}/call-next")
async def call_next_token(salon_id: str, barber_id: str, current_salon=Depends(get_current_salon)):
    """Call next token for specific barber - Does NOT auto-complete previous token"""
    date = datetime.now(timezone.utc).date().isoformat()
    
    # DON'T auto-complete previous tokens - barber must manually complete
    
    # Get next waiting token
    next_token = await db.tokens.find_one(
        {"salon_id": salon_id, "barber_id": barber_id, "date": date, "status": "waiting"},
        {"_id": 0},
        sort=[("token_number", 1)]
    )
    
    if next_token:
        await db.tokens.update_one(
            {"id": next_token["id"]},
            {
                "$set": {
                    "status": "called",
                    "called_at": datetime.now(timezone.utc).isoformat()
                }
            }
        )
        updated = TokenModel(**{**next_token, "status": "called", "called_at": datetime.now(timezone.utc).isoformat()})
        await broadcast_update("token_called", updated.model_dump())
        
        # Send WhatsApp notification that token is called
        await send_booking_notification(next_token, 'token_called')
        
        # Check and notify tokens that are near (3 away and 1 away)
        await check_and_notify_nearby_tokens(salon_id, barber_id, date, next_token["token_number"])
        
        return updated
    
    return {"message": "No more tokens in queue"}


@api_router.post("/tokens/{token_id}/complete")
async def complete_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Manually mark token as completed and generate invoice"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Mark as completed
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    # Generate and send invoice
    try:
        invoice_sent = await generate_and_send_invoice(token_id)
        await broadcast_update("token_completed", {"token_id": token_id})
        
        return {
            "message": "Token marked as completed",
            "invoice_sent": invoice_sent
        }
    except Exception as e:
        logger.error(f"Error generating invoice: {e}")
        return {
            "message": "Token marked as completed but invoice generation failed",
            "error": str(e)
        }

@api_router.post("/tokens/{token_id}/recall")
async def recall_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Re-call a token (if customer not available)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Increment recall count and update called_at timestamp
    recall_count = token.get("recall_count", 0) + 1
    await db.tokens.update_one(
        {"id": token_id},
        {
            "$set": {
                "recall_count": recall_count,
                "called_at": datetime.now(timezone.utc).isoformat()
            }
        }
    )
    
    # Send notification again
    await send_booking_notification(token, 'token_called')
    await broadcast_update("token_recalled", {"token_id": token_id, "recall_count": recall_count})
    
    return {"message": "Token recalled and notification sent", "recall_count": recall_count}

@api_router.post("/tokens/{token_id}/skip")
async def skip_token(token_id: str, reason: Optional[str] = None, current_salon=Depends(get_current_salon)):
    """Skip/Cancel a token (if customer doesn't show up)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Mark as skipped (not cancelled, different meaning)
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {
            "status": "skipped",
            "skipped_reason": reason or "Customer no-show",
            "skipped_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    # Send notification
    token['skipped_reason'] = reason or "Customer no-show"
    await send_booking_notification(token, 'token_skipped')
    await broadcast_update("token_skipped", {"token_id": token_id})
    
    return {"message": "Token skipped"}

@api_router.post("/tokens/{token_id}/resend-invoice")
async def resend_invoice(token_id: str, current_salon=Depends(get_current_salon)):
    """Resend invoice to customer"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if token.get('status') != 'completed':
        raise HTTPException(status_code=400, detail="Can only resend invoice for completed bookings")
    
    try:
        invoice_sent = await generate_and_send_invoice(token_id)
        return {
            "message": "Invoice resent successfully",
            "sent": invoice_sent
        }
    except Exception as e:
        logger.error(f"Error resending invoice: {e}")
        raise HTTPException(status_code=500, detail=f"Failed to resend invoice: {str(e)}")

@api_router.post("/tokens/{token_id}/call")
async def call_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Call specific token"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Update status to "called" with timestamp
    await db.tokens.update_one(
        {"id": token_id}, 
        {"$set": {
            "status": "called",
            "called_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    await broadcast_update("token_called", {"token_id": token_id})
    
    # Send notification
    await send_booking_notification(token, 'token_called')
    
    return {"message": "Token called"}

@api_router.post("/tokens/{token_id}/skip")
async def skip_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Skip token (final)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    await db.tokens.update_one({"id": token_id}, {"$set": {"status": "skipped"}})
    await broadcast_update("token_skipped", {"token_id": token_id})
    return {"message": "Token skipped"}

@api_router.post("/tokens/{token_id}/recall")
async def recall_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Recall skipped token"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if token["status"] != "skipped":
        raise HTTPException(status_code=400, detail="Can only recall skipped tokens")
    
    await db.tokens.update_one({"id": token_id}, {"$set": {"status": "waiting"}})
    await broadcast_update("token_recalled", {"token_id": token_id})
    return {"message": "Token recalled"}

@api_router.post("/tokens/{token_id}/cancel")
async def cancel_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Cancel token"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    await db.tokens.update_one({"id": token_id}, {"$set": {"status": "cancelled"}})
    await broadcast_update("token_cancelled", {"token_id": token_id})
    
    # Send cancellation notification
    await send_booking_notification(token, 'token_cancelled')
    
    return {"message": "Token cancelled"}

@api_router.post("/tokens/{token_id}/defer")
async def defer_token(token_id: str, new_slot: str, current_salon=Depends(get_current_salon)):
    """Defer token to next slot"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    await db.tokens.update_one({"id": token_id}, {"$set": {"time_slot": new_slot, "status": "waiting"}})
    await broadcast_update("token_deferred", {"token_id": token_id, "new_slot": new_slot})
    return {"message": "Token deferred"}

@api_router.post("/tokens/{token_id}/notify")
async def send_token_notification(token_id: str, current_salon=Depends(get_current_salon)):
    """Send queue status notification to customer"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Get current token being served for this barber
    current_token = await db.tokens.find_one(
        {"salon_id": token["salon_id"], "barber_id": token["barber_id"], "date": token["date"], "status": "in_progress"},
        {"_id": 0}
    )
    
    current_token_number = current_token.get('token_number', "M000") if current_token else "M000"
    user_token_number = token.get('token_number')
    
    # Calculate tokens away using sequence numbers
    current_seq = extract_token_sequence(current_token_number) if current_token else 0
    user_seq = extract_token_sequence(user_token_number)
    tokens_away = user_seq - current_seq
    
    # Calculate estimated time (assume 20 minutes per token)
    estimated_minutes = tokens_away * 20
    if estimated_minutes < 60:
        estimated_time = f"{estimated_minutes} minutes"
    else:
        hours = estimated_minutes // 60
        mins = estimated_minutes % 60
        estimated_time = f"{hours}h {mins}m" if mins > 0 else f"{hours}h"
    
    # Send queue status notification
    message = format_queue_status(
        customer_name=token.get('customer_name'),
        current_token=current_token_number,
        user_token=user_token_number,
        tokens_away=tokens_away,
        estimated_time=estimated_time
    )
    
    result = await send_whatsapp_notification(token.get('phone'), message, 'queue_status')
    
    # Store notification record
    notification = {
        "id": str(uuid.uuid4()),
        "token_id": token_id,
        "notification_type": "whatsapp_queue_status",
        "message": message,
        "status": result.get('status'),
        "sent_at": datetime.now(timezone.utc).isoformat()
    }
    await db.notifications.insert_one(notification)
    
    logger.info(f"Queue status notification sent to {token.get('phone')}: {result.get('status')}")
    
    return {
        "message": "Notification sent successfully",
        "delivery_status": result.get('status'),
        "current_token": current_token_number,
        "user_token": user_token_number,
        "tokens_away": tokens_away,
        "estimated_time": estimated_time
    }

@api_router.put("/tokens/{token_id}/add-services")
async def add_services_to_token(token_id: str, request: AddServicesRequest, current_salon=Depends(get_current_salon)):
    """Add services to existing booking (before completion)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Check if token is already completed
    if token.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot add services to completed booking")
    
    # Get current services
    current_services = token.get("selected_services", [])
    
    # Add new services (avoid duplicates)
    for service_id in request.service_ids:
        if service_id not in current_services:
            current_services.append(service_id)
    
    # Recalculate total amount
    total_amount = 0
    if token["barber_id"] != "any":
        total_amount = await calculate_booking_total(current_services, token["barber_id"])
    
    # Update token
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {
            "selected_services": current_services,
            "total_amount": total_amount
        }}
    )
    
    # Get updated token
    updated_token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    
    # Broadcast update
    await broadcast_update("token_updated", updated_token)
    
    return {
        "message": "Services added successfully",
        "token": TokenModel(**updated_token)
    }

@api_router.put("/tokens/{token_id}/update-services")
async def update_token_services(token_id: str, request: AddServicesRequest, current_salon=Depends(get_current_salon)):
    """Update services for existing booking - can add or remove (before completion)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Check if token is already completed
    if token.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot modify services for completed booking")
    
    # Replace services entirely with new selection
    new_services = request.service_ids
    
    # Recalculate total amount
    total_amount = 0
    if token["barber_id"] != "any":
        total_amount = await calculate_booking_total(new_services, token["barber_id"])
    
    # Update token
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {
            "selected_services": new_services,
            "total_amount": total_amount
        }}
    )
    
    # Get updated token
    updated_token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    
    # Broadcast update
    await broadcast_update("token_updated", updated_token)
    
    return {
        "message": "Services updated successfully",
        "token": TokenModel(**updated_token)
    }

@api_router.get("/users/last-salon")
async def get_last_salon_by_phone(phone: str):
    """Get last visited salon by user phone number"""
    # Normalize phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Find most recent booking for this phone
    recent_booking = await db.tokens.find_one(
        {"phone": phone},
        {"_id": 0, "salon_id": 1},
        sort=[("created_at", -1)]
    )
    
    if not recent_booking:
        return {"salon": None}
    
    # Get salon details
    salon = await db.salons.find_one(
        {"id": recent_booking["salon_id"]},
        {"_id": 0}
    )
    
    if salon:
        return {"salon": Salon(**salon)}
    
    return {"salon": None}

@api_router.get("/salons/search")
async def search_salons(name: str):
    """Search salons by name (case-insensitive partial match)"""
    if not name or len(name) < 2:
        raise HTTPException(status_code=400, detail="Search query must be at least 2 characters")
    
    # Search using case-insensitive regex
    salons = await db.salons.find(
        {
            "is_active": True,
            "salon_name": {"$regex": name, "$options": "i"}
        },
        {"_id": 0}
    ).limit(20).to_list(20)
    
    return {"salons": [Salon(**s) for s in salons]}

@api_router.get("/salons/by-city")
async def get_salons_by_city(city: str):
    """Get salons by city"""
    if not city or len(city) < 2:
        raise HTTPException(status_code=400, detail="City name must be at least 2 characters")
    
    salons = await db.salons.find(
        {
            "is_active": True,
            "city": {"$regex": city, "$options": "i"}
        },
        {"_id": 0}
    ).limit(50).to_list(50)
    
    return {"salons": [Salon(**s) for s in salons]}

@api_router.get("/cities")
async def get_cities():
    """Get list of unique cities with salons"""
    cities = await db.salons.distinct("city", {"is_active": True})
    return {"cities": [c for c in cities if c]}

@api_router.get("/users/{user_id}/recent-services")
async def get_user_recent_services(user_id: str):
    """Get user's recent services from last 5 bookings"""
    # Find last 5 bookings for this user
    recent_bookings = await db.tokens.find(
        {"user_id": user_id},
        {"_id": 0, "selected_services": 1}
    ).sort("created_at", -1).limit(5).to_list(5)
    
    # Collect all unique service IDs
    service_ids = set()
    for booking in recent_bookings:
        service_ids.update(booking.get("selected_services", []))
    
    # Get service details
    if service_ids:
        services = await db.services.find(
            {"id": {"$in": list(service_ids)}, "is_active": True},
            {"_id": 0}
        ).to_list(100)
        return {"services": [Service(**s) for s in services]}
    
    return {"services": []}

@api_router.get("/salons/{salon_id}/token-status")
async def get_salon_token_status(salon_id: str, shift: Optional[str] = None):
    """Get current token status for salon (overall and per barber)"""
    today = datetime.now().date().isoformat()
    
    # Get all barbers for this salon
    barbers = await db.barbers.find(
        {"salon_id": salon_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    result = {
        "date": today,
        "overall": {},
        "barbers": []
    }
    
    # Get overall salon status
    query = {"salon_id": salon_id, "date": today, "status": {"$in": ["waiting", "called"]}}
    if shift:
        query["shift"] = shift
    
    waiting_tokens = await db.tokens.find(query, {"_id": 0}).to_list(1000)
    
    # Get currently called token
    called_query = {"salon_id": salon_id, "date": today, "status": "called"}
    if shift:
        called_query["shift"] = shift
    
    called_token = await db.tokens.find_one(called_query, {"_id": 0}, sort=[("called_at", -1)])
    
    result["overall"] = {
        "current_token": called_token.get("token_number") if called_token else None,
        "waiting_count": len(waiting_tokens),
        "shift": shift
    }
    
    # Get per-barber status
    for barber in barbers:
        barber_query = {
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": today
        }
        if shift:
            barber_query["shift"] = shift
        
        barber_waiting = await db.tokens.find(
            {**barber_query, "status": {"$in": ["waiting", "called"]}},
            {"_id": 0}
        ).to_list(1000)
        
        barber_called = await db.tokens.find_one(
            {**barber_query, "status": "called"},
            {"_id": 0},
            sort=[("called_at", -1)]
        )
        
        result["barbers"].append({
            "barber_id": barber["id"],
            "barber_name": barber["name"],
            "category": barber.get("category"),
            "specialization": barber.get("specialization"),
            "current_token": barber_called.get("token_number") if barber_called else None,
            "waiting_count": len(barber_waiting),
            "queue_status": barber.get("queue_status", "available")
        })
    
    return result

# ============ ANALYTICS ROUTES ============

@api_router.get("/analytics/day-wise-sales")
async def get_day_wise_sales(
    salon_id: str,
    start_date: str,
    end_date: Optional[str] = None,
    current_salon=Depends(get_current_salon)
):
    """Get day-wise sales for the salon"""
    if not end_date:
        # Default to 10 days from start_date
        start = datetime.fromisoformat(start_date)
        end = start + timedelta(days=10)
        end_date = end.date().isoformat()
    
    # Get all completed tokens in date range
    tokens = await db.tokens.find({
        "salon_id": salon_id,
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    # Group by date
    day_wise = {}
    for token in tokens:
        date = token["date"]
        if date not in day_wise:
            day_wise[date] = {
                "date": date,
                "total_sales": 0,
                "total_bookings": 0
            }
        day_wise[date]["total_sales"] += token.get("total_amount", 0)
        day_wise[date]["total_bookings"] += 1
    
    # Convert to list and sort
    result = sorted(day_wise.values(), key=lambda x: x["date"])
    return {"data": result}

@api_router.get("/analytics/barber-wise-sales")
async def get_barber_wise_sales(
    salon_id: str,
    start_date: str,
    end_date: str,
    current_salon=Depends(get_current_salon)
):
    """Get barber-wise sales for the salon"""
    # Get all completed tokens in date range
    tokens = await db.tokens.find({
        "salon_id": salon_id,
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    # Group by barber
    barber_wise = {}
    for token in tokens:
        barber_id = token["barber_id"]
        barber_name = token.get("barber_name", "Unknown")
        
        if barber_id not in barber_wise:
            barber_wise[barber_id] = {
                "barber_id": barber_id,
                "barber_name": barber_name,
                "total_sales": 0,
                "total_bookings": 0
            }
        barber_wise[barber_id]["total_sales"] += token.get("total_amount", 0)
        barber_wise[barber_id]["total_bookings"] += 1
    
    # Convert to list and sort by sales
    result = sorted(barber_wise.values(), key=lambda x: x["total_sales"], reverse=True)
    return {"data": result}

@api_router.get("/analytics/service-wise-sales")
async def get_service_wise_sales(
    salon_id: str,
    start_date: str,
    end_date: str,
    current_salon=Depends(get_current_salon)
):
    """Get top 10 services by sales"""
    # Get all completed tokens in date range
    tokens = await db.tokens.find({
        "salon_id": salon_id,
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    # Get all services
    services_dict = {}
    all_services = await db.services.find({"salon_id": salon_id}, {"_id": 0}).to_list(1000)
    for service in all_services:
        services_dict[service["id"]] = service["service_name"]
    
    # Count service usage
    service_count = {}
    for token in tokens:
        for service_id in token.get("selected_services", []):
            service_name = services_dict.get(service_id, "Unknown Service")
            if service_id not in service_count:
                service_count[service_id] = {
                    "service_id": service_id,
                    "service_name": service_name,
                    "count": 0,
                    "revenue": 0
                }
            service_count[service_id]["count"] += 1
    
    # Calculate approximate revenue per service
    for service_id, data in service_count.items():
        service = next((s for s in all_services if s["id"] == service_id), None)
        if service:
            data["revenue"] = data["count"] * service.get("base_price", 0)
    
    # Get top 10
    result = sorted(service_count.values(), key=lambda x: x["count"], reverse=True)[:10]
    return {"data": result}

@api_router.get("/analytics/gender-distribution")
async def get_gender_distribution(
    salon_id: str,
    start_date: str,
    end_date: str,
    current_salon=Depends(get_current_salon)
):
    """Get gender distribution of customers"""
    # Get all completed tokens in date range
    tokens = await db.tokens.find({
        "salon_id": salon_id,
        "date": {"$gte": start_date, "$lte": end_date},
        "status": "completed"
    }, {"_id": 0}).to_list(10000)
    
    # Get unique user IDs
    user_ids = list(set([t.get("user_id") for t in tokens if t.get("user_id")]))
    
    # Get user gender data
    users = await db.users.find(
        {"id": {"$in": user_ids}},
        {"_id": 0, "id": 1, "gender": 1}
    ).to_list(10000)
    
    # Count by gender
    gender_count = {"Men": 0, "Women": 0, "Not Specified": 0}
    
    for user in users:
        gender = user.get("gender", "Not Specified")
        if gender in gender_count:
            gender_count[gender] += 1
        else:
            gender_count["Not Specified"] += 1
    
    result = [
        {"name": "Men", "value": gender_count["Men"]},
        {"name": "Women", "value": gender_count["Women"]},
        {"name": "Not Specified", "value": gender_count["Not Specified"]}
    ]
    
    return {"data": result}

@api_router.get("/analytics/detailed-report")
async def get_detailed_report(
    salon_id: str,
    start_date: str,
    end_date: str,
    current_salon=Depends(get_current_salon)
):
    """Get detailed booking report for export"""
    # Get all tokens in date range
    tokens = await db.tokens.find({
        "salon_id": salon_id,
        "date": {"$gte": start_date, "$lte": end_date}
    }, {"_id": 0}).sort("created_at", -1).to_list(10000)
    
    # Get all services for name mapping
    services_dict = {}
    all_services = await db.services.find({}, {"_id": 0}).to_list(1000)
    for service in all_services:
        services_dict[service["id"]] = service["service_name"]
    
    # Format data for export
    detailed_data = []
    for token in tokens:
        # Get service names
        service_names = [services_dict.get(sid, "Unknown") for sid in token.get("selected_services", [])]
        
        # Calculate time taken
        time_taken = ""
        if token.get("called_at") and token.get("completed_at"):
            called = datetime.fromisoformat(token["called_at"])
            completed = datetime.fromisoformat(token["completed_at"])
            duration = completed - called
            minutes = int(duration.total_seconds() / 60)
            time_taken = f"{minutes} min"
        
        detailed_data.append({
            "date": token["date"],
            "token_number": token.get("token_number", ""),
            "customer_name": token["customer_name"],
            "phone": token["phone"],
            "barber_name": token.get("barber_name", ""),
            "services": ", ".join(service_names),
            "amount": token.get("total_amount", 0),
            "status": token.get("status", ""),
            "shift": token.get("shift", token.get("time_slot", "")),
            "call_time": token.get("called_at", ""),
            "complete_time": token.get("completed_at", ""),
            "time_taken": time_taken,
            "payment_status": token.get("payment_status", "")
        })
    
    return {"data": detailed_data}

# ============ PAYMENT ROUTES ============

@api_router.post("/payments/generate-upi-qr")
async def generate_upi_qr(token_id: str):
    """Generate UPI QR code for payment"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    salon = await db.salons.find_one({"id": token["salon_id"]}, {"_id": 0})
    if not salon or not salon.get("upi_id"):
        raise HTTPException(status_code=400, detail="Salon UPI not configured")
    
    # Generate UPI URL
    upi_url = f"upi://pay?pa={salon['upi_id']}&pn={salon['salon_name']}&am={token['total_amount']}&cu=INR&tn=Token_{token['token_number']}"
    
    # Generate QR
    qr = qrcode.QRCode(version=1, box_size=10, border=5)
    qr.add_data(upi_url)
    qr.make(fit=True)
    
    img = qr.make_image(fill_color="black", back_color="white")
    
    buffer = io.BytesIO()
    img.save(buffer, format="PNG")
    buffer.seek(0)
    img_str = base64.b64encode(buffer.getvalue()).decode()
    
    return {
        "qr_code": f"data:image/png;base64,{img_str}",
        "upi_url": upi_url,
        "amount": token['total_amount']
    }

@api_router.post("/payments/verify")
async def verify_payment(token_id: str, transaction_id: str, current_salon=Depends(get_current_salon)):
    """Verify payment (manual for UPI)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {
            "payment_status": "paid",
            "payment_mode": "upi",
            "upi_transaction_id": transaction_id
        }}
    )
    
    return {"message": "Payment verified"}

# ============ USER HISTORY ============

@api_router.get("/user/{user_id}/history", response_model=List[TokenModel])
async def get_user_history(user_id: str):
    tokens = await db.tokens.find({"user_id": user_id}, {"_id": 0}).sort("created_at", -1).to_list(100)
    return tokens

@api_router.get("/user/{user_id}/active", response_model=List[TokenModel])
async def get_user_active_bookings(user_id: str):
    today = datetime.now().date().isoformat()
    tokens = await db.tokens.find(
        {"user_id": user_id, "date": {"$gte": today}, "status": {"$in": ["waiting", "in_progress"]}},
        {"_id": 0}
    ).sort("date", 1).to_list(10)
    return tokens

# ============ INVOICE ROUTES ============

@api_router.get("/invoices/{invoice_id}")
async def get_invoice(invoice_id: str):
    """Get invoice data"""
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Remove base64 from response (too large)
    invoice_data = {k: v for k, v in invoice.items() if k != 'pdf_base64'}
    return invoice_data

@api_router.get("/invoices/{invoice_id}/view")
async def view_invoice(invoice_id: str):
    """View invoice PDF in browser"""
    from fastapi.responses import Response
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if not invoice.get('pdf_base64'):
        raise HTTPException(status_code=404, detail="Invoice PDF not found")
    
    # Decode base64 PDF
    import base64
    pdf_bytes = base64.b64decode(invoice['pdf_base64'])
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"inline; filename=invoice_{invoice['invoice_no']}.pdf"
        }
    )

@api_router.get("/invoices/{invoice_id}/download")
async def download_invoice(invoice_id: str):
    """Download invoice PDF"""
    from fastapi.responses import Response
    
    invoice = await db.invoices.find_one({"id": invoice_id}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    if not invoice.get('pdf_base64'):
        raise HTTPException(status_code=404, detail="Invoice PDF not found")
    
    # Decode base64 PDF
    import base64
    pdf_bytes = base64.b64decode(invoice['pdf_base64'])
    
    return Response(
        content=pdf_bytes,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f"attachment; filename=invoice_{invoice['invoice_no']}.pdf"
        }
    )

@api_router.get("/tokens/{token_id}/invoice")
async def get_token_invoice(token_id: str):
    """Get invoice for a specific token"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if not token.get('invoice_id'):
        raise HTTPException(status_code=404, detail="Invoice not generated yet")
    
    invoice = await db.invoices.find_one({"id": token['invoice_id']}, {"_id": 0})
    if not invoice:
        raise HTTPException(status_code=404, detail="Invoice not found")
    
    # Return invoice data without base64
    invoice_data = {k: v for k, v in invoice.items() if k != 'pdf_base64'}
    invoice_data['view_link'] = f"/api/invoices/{invoice['id']}/view"
    invoice_data['download_link'] = f"/api/invoices/{invoice['id']}/download"
    
    return invoice_data

# Include router
app.include_router(api_router)

app.add_middleware(
    CORSMiddleware,
    allow_credentials=True,
    allow_origins=os.environ.get('CORS_ORIGINS', '*').split(','),
    allow_methods=["*"],
    allow_headers=["*"],
)

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)
logger = logging.getLogger(__name__)

# Scheduler for token allocation
scheduler = AsyncIOScheduler()
scheduler.add_job(allocate_future_tokens, 'cron', hour=5, minute=30)  # Run at 5:30 AM daily

@app.on_event("startup")
async def startup_event():
    await initialize_data()
    scheduler.start()
    logger.info("Application started with multi-salon support")

@app.on_event("shutdown")
async def shutdown_db_client():
    scheduler.shutdown()
    client.close()

# Mount Socket.IO
app.mount("/", socket_app)
