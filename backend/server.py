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
from typing import List, Optional, Dict, Any
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
    city: Optional[str] = None  # City for filtering
    latitude: float
    longitude: float
    upi_id: Optional[str] = None
    payment_timing: str = "after"  # before/after
    password: Optional[str] = None  # Optional password for login
    gender_tag: str = "Unisex"  # Unisex/Men/Women

class SalonUpdate(BaseModel):
    salon_name: Optional[str] = None
    owner_name: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None  # City for filtering
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
    rating: float = 0  # Average rating out of 5
    total_reviews: int = 0  # Total number of reviews
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

# Staff Models (formerly Barber - keeping backward compatibility)
class BarberCreate(BaseModel):
    name: str
    salon_id: str
    experience: int
    category: str
    specialization: Optional[str] = None
    mobile: str
    profile_image: Optional[str] = None
    is_barber: bool = True  # True if staff is a barber (visible to customers)
    # New employee fields
    department: Optional[str] = None  # e.g., "Hairstyling", "Spa", "Reception"
    designation: Optional[str] = None  # e.g., "Senior Stylist", "Receptionist"
    emergency_contact: Optional[str] = None
    aadhar_number: Optional[str] = None
    doj: Optional[str] = None  # Date of Joining
    dob: Optional[str] = None  # Date of Birth
    compensation: Optional[float] = None
    documents: Optional[List[str]] = None  # URLs to uploaded documents

class BarberUpdate(BaseModel):
    name: Optional[str] = None
    experience: Optional[int] = None
    category: Optional[str] = None
    specialization: Optional[str] = None
    mobile: Optional[str] = None
    queue_status: Optional[str] = None
    profile_image: Optional[str] = None
    photo_url: Optional[str] = None
    on_leave: Optional[bool] = None
    intro: Optional[str] = None
    gallery: Optional[List[str]] = None
    is_barber: Optional[bool] = None  # Can update barber visibility
    # New employee fields
    department: Optional[str] = None
    designation: Optional[str] = None
    emergency_contact: Optional[str] = None
    aadhar_number: Optional[str] = None
    doj: Optional[str] = None
    dob: Optional[str] = None
    compensation: Optional[float] = None
    documents: Optional[List[str]] = None

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
    photo_url: Optional[str] = None  # Alias for profile_image
    queue_status: str = "available"  # available/busy/offline
    on_leave: bool = False  # True if staff is on leave
    is_active: bool = True
    is_barber: bool = True  # True if staff is a barber (visible to customers)
    intro: Optional[str] = None  # Staff's story/about
    gallery: List[str] = []  # Portfolio images
    rating: float = 4.5  # Average rating
    total_reviews: int = 0  # Total number of reviews
    # New employee fields
    department: Optional[str] = None
    designation: Optional[str] = None
    emergency_contact: Optional[str] = None
    aadhar_number: Optional[str] = None
    doj: Optional[str] = None  # Date of Joining
    dob: Optional[str] = None  # Date of Birth
    compensation: Optional[float] = None
    documents: List[str] = []  # URLs to uploaded documents

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

# Rating/Review Models
class RatingCreate(BaseModel):
    token_id: str  # The completed booking token ID
    barber_id: str
    salon_id: str
    rating: int = Field(..., ge=1, le=5)  # 1-5 stars
    review: str = Field(..., min_length=1)  # Review comment is required

class RatingResponse(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    token_id: str
    user_id: str
    user_name: str
    barber_id: str
    barber_name: str
    salon_id: str
    rating: int
    review: str
    created_at: str

class BarberRatingSummary(BaseModel):
    barber_id: str
    barber_name: str
    average_rating: float
    total_reviews: int
    reviews: List[RatingResponse]

# ============ SALON USER MODELS (Multi-User Access) ============

class SalonUserPermissions(BaseModel):
    can_edit_salon: bool = False
    can_access_analytics: bool = False
    can_delete_salon: bool = False

class SalonUserCreate(BaseModel):
    salon_id: str
    name: str
    mobile: str
    login_id: str  # Free text login ID
    password: str
    role: str = "staff"  # "admin" or "staff"
    staff_id: Optional[str] = None  # Link to staff member in barbers collection
    permissions: Optional[SalonUserPermissions] = None

class SalonUserUpdate(BaseModel):
    name: Optional[str] = None
    mobile: Optional[str] = None
    login_id: Optional[str] = None
    password: Optional[str] = None
    staff_id: Optional[str] = None
    permissions: Optional[SalonUserPermissions] = None
    status: Optional[str] = None  # active/inactive

class SalonUser(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    name: str
    mobile: str
    login_id: str
    password_hash: str
    role: str  # "admin" or "staff"
    staff_id: Optional[str] = None  # Link to staff member
    permissions: SalonUserPermissions
    status: str = "active"  # active/inactive
    created_at: str

class SalonUserLogin(BaseModel):
    identifier: str  # Can be mobile number or login_id
    password: str

class SalonUserToken(BaseModel):
    access_token: str
    token_type: str = "bearer"
    salon_id: str
    user_id: str
    role: str
    permissions: SalonUserPermissions

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
    """Legacy salon auth - for backward compatibility"""
    token = credentials.credentials
    payload = verify_token(token)
    if not payload or payload.get("role") != "salon":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return payload

async def get_current_salon_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated salon user (admin or staff)"""
    token = credentials.credentials
    payload = verify_token(token)
    # Accept legacy "salon" role as well as new "salon_admin" and "salon_staff" roles
    if not payload or payload.get("role") not in ["salon_admin", "salon_staff", "salon"]:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid authentication credentials"
        )
    return payload

async def get_current_salon_admin(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """Get current authenticated salon user - admin only"""
    token = credentials.credentials
    payload = verify_token(token)
    # Accept legacy "salon" role as admin (backward compatibility)
    if not payload or payload.get("role") not in ["salon_admin", "salon"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Admin access required"
        )
    return payload

def check_permission(user_payload: dict, permission: str) -> bool:
    """Check if user has specific permission"""
    if user_payload.get("role") == "salon_admin":
        return True  # Admin has all permissions
    
    permissions = user_payload.get("permissions", {})
    return permissions.get(permission, False)

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
    except (ValueError, IndexError):
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

async def check_and_apply_loyalty_reward(salon_id: str, customer_phone: str, booking_amount: float):
    """Check if customer qualifies for loyalty reward and auto top-up wallet (Multi-Tier with individual periods)"""
    # Get loyalty program settings
    loyalty_program = await db.loyalty_programs.find_one({"salon_id": salon_id, "enabled": True}, {"_id": 0})
    if not loyalty_program or not loyalty_program.get("tiers"):
        return None
    
    # Find highest qualifying tier (each tier has its own period)
    qualifying_tier = None
    total_spend_for_tier = 0
    
    for tier in sorted(loyalty_program["tiers"], key=lambda x: x["spend_amount"], reverse=True):
        # Calculate date range for THIS tier's period
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=tier["period_months"] * 30)
        
        # Get customer's completed bookings in THIS tier's period
        completed_bookings = await db.tokens.find({
            "salon_id": salon_id,
            "phone": customer_phone,
            "status": "completed",
            "completed_at": {"$gte": cutoff_date.isoformat()}
        }, {"_id": 0, "total_amount": 1}).to_list(1000)
        
        # Calculate total spend in this period
        total_spend = sum([b.get("total_amount", 0) for b in completed_bookings])
        
        # Check if threshold is met for this tier
        if total_spend >= tier["spend_amount"]:
            qualifying_tier = tier
            total_spend_for_tier = total_spend
            break  # Found highest qualifying tier
    
    if not qualifying_tier:
        return None
    
    # Calculate top-up amount based on tier
    topup_amount = (qualifying_tier["spend_amount"] * qualifying_tier["topup_percentage"]) / 100
    
    # Check if customer already has membership
    membership = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": customer_phone,
        "is_active": True
    }, {"_id": 0})
    
    if membership:
        # Top up existing wallet
        new_balance = membership["wallet_balance"] + topup_amount
        await db.customer_memberships.update_one(
            {"id": membership["id"]},
            {"$set": {"wallet_balance": new_balance}}
        )
        
        # Record transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": customer_phone,
            "salon_id": salon_id,
            "transaction_type": "credit",
            "amount": topup_amount,
            "balance_after": new_balance,
            "description": f"Loyalty reward ({qualifying_tier['name']} tier): Spent ₹{total_spend_for_tier:.2f} in {qualifying_tier['period_months']} months",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {
            "rewarded": True,
            "tier": qualifying_tier["name"],
            "topup_amount": topup_amount,
            "new_balance": new_balance,
            "total_spend": total_spend_for_tier
        }
    
    return None

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
                "is_active": True,
                "is_barber": True  # Visible to customers
            },
            {
                "id": str(uuid.uuid4()),
                "name": "Abdul",
                "salon_id": salon_id,
                "experience": 5,
                "category": "star",
                "mobile": "+919876543212",
                "queue_status": "available",
                "is_active": True,
                "is_barber": True  # Visible to customers
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

@api_router.get("/salons/search")
async def search_salons(name: Optional[str] = None, city: Optional[str] = None):
    """Search salons by name and/or city (case-insensitive partial match)"""
    if not name and not city:
        raise HTTPException(status_code=400, detail="Please provide a search query (name or city)")
    
    query = {"is_active": True}
    
    # Build combined search query
    conditions = []
    if name and len(name) >= 1:
        conditions.append({"salon_name": {"$regex": name, "$options": "i"}})
    if city and len(city) >= 1:
        conditions.append({"city": {"$regex": city, "$options": "i"}})
    
    if len(conditions) == 1:
        query.update(conditions[0])
    elif len(conditions) > 1:
        query["$and"] = conditions
    
    salons = await db.salons.find(query, {"_id": 0}).limit(50).to_list(50)
    
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

@api_router.delete("/salons/{salon_id}")
async def delete_salon(salon_id: str, current_salon=Depends(get_current_salon)):
    """Delete a salon and all associated data"""
    # Verify the salon exists
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Verify the requesting salon is deleting its own profile
    if current_salon.get("id") != salon_id:
        raise HTTPException(status_code=403, detail="You can only delete your own salon profile")
    
    # Delete all associated data
    await db.barbers.delete_many({"salon_id": salon_id})
    await db.barber_services.delete_many({"salon_id": salon_id})
    await db.salon_services.delete_many({"salon_id": salon_id})
    await db.tokens.delete_many({"salon_id": salon_id})
    await db.ratings.delete_many({"salon_id": salon_id})
    await db.salon_initialized.delete_many({"salon_id": salon_id})
    await db.salon_packages.delete_many({"salon_id": salon_id})
    
    # Delete the salon itself
    await db.salons.delete_one({"id": salon_id})
    
    return {"message": "Salon and all associated data deleted successfully"}

@api_router.get("/salons/{salon_id}/ratings")
async def get_salon_ratings(salon_id: str, limit: int = 50, skip: int = 0):
    """Get all ratings for a salon (across all barbers), sorted by latest"""
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Get all ratings for this salon sorted by latest
    reviews = await db.ratings.find(
        {"salon_id": salon_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calculate salon average rating from all reviews
    pipeline = [
        {"$match": {"salon_id": salon_id}},
        {"$group": {
            "_id": "$salon_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(1)
    
    avg_rating = round(stats[0]["average_rating"], 1) if stats else 0
    total_reviews = stats[0]["total_reviews"] if stats else 0
    
    # Also update the salon's rating field
    if stats:
        await db.salons.update_one(
            {"id": salon_id},
            {"$set": {"rating": avg_rating, "total_reviews": total_reviews}}
        )
    
    return {
        "salon_id": salon_id,
        "salon_name": salon.get("salon_name", ""),
        "average_rating": avg_rating,
        "total_reviews": total_reviews,
        "reviews": [RatingResponse(**r) for r in reviews]
    }

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
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Enable or disable a service for a specific salon"""
    # Verify token (supports both legacy and multi-user auth)
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Check if salon_service entry exists
    salon_service = await db.salon_services.find_one({
        "salon_id": salon_id,
        "service_id": service_id
    }, {"_id": 0})
    
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

@api_router.get("/salons/{salon_id}/packages/with-services")
async def get_salon_packages_with_services(salon_id: str, gender: Optional[str] = None):
    """Get all active packages for a salon with service details"""
    query = {"salon_id": salon_id, "is_active": True}
    if gender and gender != "all":
        query["$or"] = [{"gender_tag": gender}, {"gender_tag": "Unisex"}]
    
    packages = await db.salon_packages.find(query, {"_id": 0}).to_list(100)
    
    # Populate service details for each package
    for package in packages:
        if package.get('service_ids'):
            services = []
            for service_id in package['service_ids']:
                service = await db.services.find_one({"id": service_id}, {"_id": 0})
                if service:
                    services.append(service)
            package['services'] = services
    
    return {"packages": packages}

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
async def get_salon_barbers(salon_id: str, available_only: bool = False, customer_view: bool = False):
    """
    Get barbers for a salon
    available_only=True: Only return barbers not on leave (for customer booking)
    customer_view=True: Only return staff marked as barbers (is_barber=True)
    available_only=False & customer_view=False: Return all active staff (for admin)
    """
    query = {"salon_id": salon_id, "is_active": True}
    if available_only:
        query["on_leave"] = {"$ne": True}  # Exclude barbers on leave
    if customer_view:
        query["is_barber"] = True  # Only show staff visible to customers
    
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
    """Get salon-enabled services with barber-specific pricing"""
    # Get barber to find salon_id
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0, "salon_id": 1})
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    salon_id = barber["salon_id"]
    
    # Get only services enabled for this salon
    salon_services = await db.salon_services.find(
        {"salon_id": salon_id, "is_enabled": True},
        {"_id": 0}
    ).to_list(1000)
    
    enabled_service_ids = [ss["service_id"] for ss in salon_services]
    
    # Get service details for enabled services only
    services = await db.services.find(
        {"id": {"$in": enabled_service_ids}, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
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

@api_router.put("/barbers/{barber_id}/services/{service_id}/toggle")
async def toggle_barber_service(
    barber_id: str, 
    service_id: str, 
    is_available: bool,
    credentials: HTTPAuthorizationCredentials = Depends(security)
):
    """Toggle service availability for a barber"""
    # Verify authentication
    token = credentials.credentials
    payload = verify_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid authentication")
    
    # Check if barber exists
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    # Check if service exists
    service = await db.services.find_one({"id": service_id}, {"_id": 0})
    if not service:
        raise HTTPException(status_code=404, detail="Service not found")
    
    # Check if barber_service entry exists
    existing = await db.barber_services.find_one({
        "barber_id": barber_id,
        "service_id": service_id
    }, {"_id": 0})
    
    if existing:
        # Update existing
        await db.barber_services.update_one(
            {"barber_id": barber_id, "service_id": service_id},
            {"$set": {"is_available": is_available}}
        )
    else:
        # Create new entry with default price
        await db.barber_services.insert_one({
            "id": str(uuid.uuid4()),
            "barber_id": barber_id,
            "service_id": service_id,
            "price": service.get("base_price", 0),
            "is_available": is_available
        })
    
    return {"success": True, "is_available": is_available}


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

# ============ SALON USER MULTI-USER AUTH ROUTES ============

@api_router.post("/salon/users/login", response_model=SalonUserToken)
async def salon_user_login(credentials: SalonUserLogin):
    """Multi-user salon login (staff/admin) - accepts mobile number or login ID"""
    identifier = credentials.identifier.strip()
    
    # Format phone if it looks like a phone number
    if identifier.isdigit():
        if not identifier.startswith("+91"):
            identifier = f"+91{identifier}"
    
    # Find user by login_id or mobile
    salon_user = await db.salon_users.find_one({
        "$or": [
            {"login_id": credentials.identifier},
            {"mobile": identifier}
        ],
        "status": "active"
    }, {"_id": 0})
    
    if not salon_user:
        raise HTTPException(status_code=404, detail="User not found or inactive")
    
    # Verify password
    if not pwd_context.verify(credentials.password, salon_user["password_hash"]):
        raise HTTPException(status_code=401, detail="Incorrect password")
    
    # Generate token with role and permissions
    permissions = salon_user.get("permissions", {
        "can_edit_salon": False,
        "can_access_analytics": False,
        "can_delete_salon": False
    })
    
    token = create_access_token({
        "sub": salon_user["id"],
        "role": f"salon_{salon_user['role']}",  # salon_admin or salon_staff
        "salon_id": salon_user["salon_id"],
        "permissions": permissions
    })
    
    return SalonUserToken(
        access_token=token,
        salon_id=salon_user["salon_id"],
        user_id=salon_user["id"],
        role=salon_user["role"],
        permissions=SalonUserPermissions(**permissions)
    )

@api_router.post("/salon/users", response_model=SalonUser)
async def create_salon_user(user_data: SalonUserCreate, current_user=Depends(get_current_salon_admin)):
    """Create new salon user (admin only)"""
    # Validate salon_id matches current user's salon
    if user_data.salon_id != current_user.get("salon_id"):
        raise HTTPException(status_code=403, detail="Cannot create user for different salon")
    
    # Format mobile
    mobile = user_data.mobile
    if not mobile.startswith("+91"):
        mobile = f"+91{mobile}"
    
    # Check if login_id already exists
    existing_login = await db.salon_users.find_one({"login_id": user_data.login_id}, {"_id": 0})
    if existing_login:
        raise HTTPException(status_code=400, detail="Login ID already exists")
    
    # Check if mobile already exists
    existing_mobile = await db.salon_users.find_one({"mobile": mobile}, {"_id": 0})
    if existing_mobile:
        raise HTTPException(status_code=400, detail="Mobile number already exists")
    
    # Check that staff mobile != salon phone
    salon = await db.salons.find_one({"id": user_data.salon_id}, {"_id": 0, "phone": 1})
    if salon and salon.get("phone") == mobile:
        raise HTTPException(status_code=400, detail="Staff mobile cannot be same as salon phone")
    
    # Validate staff_id if provided
    if user_data.staff_id:
        staff = await db.barbers.find_one({"id": user_data.staff_id, "salon_id": user_data.salon_id}, {"_id": 0})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
    
    # Hash password
    if len(user_data.password) < 6:
        raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
    password_hash = pwd_context.hash(user_data.password)
    
    # Set default permissions for staff
    if user_data.role == "staff" and not user_data.permissions:
        permissions = {
            "can_edit_salon": False,
            "can_access_analytics": False,
            "can_delete_salon": False
        }
    else:
        permissions = user_data.permissions.dict() if user_data.permissions else {
            "can_edit_salon": False,
            "can_access_analytics": False,
            "can_delete_salon": False
        }
    
    # Create user
    new_user = {
        "id": str(uuid.uuid4()),
        "salon_id": user_data.salon_id,
        "name": user_data.name,
        "mobile": mobile,
        "login_id": user_data.login_id,
        "password_hash": password_hash,
        "role": user_data.role,
        "staff_id": user_data.staff_id,
        "permissions": permissions,
        "status": "active",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.salon_users.insert_one(new_user)
    
    # Remove password_hash from response
    response_user = new_user.copy()
    response_user["permissions"] = SalonUserPermissions(**permissions)
    
    return SalonUser(**response_user)

@api_router.get("/salon/users")
async def get_salon_users(current_user=Depends(get_current_salon_admin)):
    """Get all users for a salon (admin only)"""
    salon_id = current_user.get("salon_id")
    
    users = await db.salon_users.find(
        {"salon_id": salon_id},
        {"_id": 0, "password_hash": 0}
    ).to_list(100)
    
    return {"users": users}

@api_router.put("/salon/users/{user_id}")
async def update_salon_user(user_id: str, update_data: SalonUserUpdate, current_user=Depends(get_current_salon_admin)):
    """Update salon user (admin only)"""
    salon_id = current_user.get("salon_id")
    
    # Check user exists and belongs to same salon
    user = await db.salon_users.find_one({"id": user_id, "salon_id": salon_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    update_fields = {}
    
    if update_data.name:
        update_fields["name"] = update_data.name
    
    if update_data.mobile:
        mobile = update_data.mobile
        if not mobile.startswith("+91"):
            mobile = f"+91{mobile}"
        
        # Check mobile doesn't exist for other users
        existing = await db.salon_users.find_one({"mobile": mobile, "id": {"$ne": user_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Mobile number already exists")
        
        # Check against salon phone
        salon = await db.salons.find_one({"id": salon_id}, {"_id": 0, "phone": 1})
        if salon and salon.get("phone") == mobile:
            raise HTTPException(status_code=400, detail="Staff mobile cannot be same as salon phone")
        
        update_fields["mobile"] = mobile
    
    if update_data.login_id:
        # Check login_id doesn't exist for other users
        existing = await db.salon_users.find_one({"login_id": update_data.login_id, "id": {"$ne": user_id}}, {"_id": 0})
        if existing:
            raise HTTPException(status_code=400, detail="Login ID already exists")
        update_fields["login_id"] = update_data.login_id
    
    if update_data.password:
        if len(update_data.password) < 6:
            raise HTTPException(status_code=400, detail="Password must be at least 6 characters")
        update_fields["password_hash"] = pwd_context.hash(update_data.password)
    
    if update_data.staff_id:
        # Validate staff exists
        staff = await db.barbers.find_one({"id": update_data.staff_id, "salon_id": salon_id}, {"_id": 0})
        if not staff:
            raise HTTPException(status_code=404, detail="Staff member not found")
        update_fields["staff_id"] = update_data.staff_id
    
    if update_data.permissions:
        update_fields["permissions"] = update_data.permissions.dict()
    
    if update_data.status:
        update_fields["status"] = update_data.status
    
    if update_fields:
        await db.salon_users.update_one(
            {"id": user_id},
            {"$set": update_fields}
        )
    
    return {"message": "User updated successfully"}

@api_router.delete("/salon/users/{user_id}")
async def delete_salon_user(user_id: str, current_user=Depends(get_current_salon_admin)):
    """Deactivate salon user (admin only)"""
    salon_id = current_user.get("salon_id")
    
    # Check user exists and belongs to same salon
    user = await db.salon_users.find_one({"id": user_id, "salon_id": salon_id}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Deactivate instead of delete
    await db.salon_users.update_one(
        {"id": user_id},
        {"$set": {"status": "inactive"}}
    )
    
    return {"message": "User deactivated successfully"}

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

# ============ CUSTOMER MASTER ROUTES ============

@api_router.get("/salons/{salon_id}/customers")
async def get_salon_customers(salon_id: str, current_user=Depends(get_current_salon_user)):
    """Get all customers who have booked at this salon"""
    # Get unique customers from tokens
    tokens = await db.tokens.find(
        {"salon_id": salon_id},
        {"_id": 0, "user_id": 1, "customer_name": 1, "phone": 1}
    ).to_list(10000)
    
    # Group by phone to get unique customers
    customers_map = {}
    for token in tokens:
        phone = token.get('phone')
        if phone and phone not in customers_map:
            # Get user details if user_id exists
            user_data = None
            if token.get('user_id'):
                user_data = await db.users.find_one({"id": token['user_id']}, {"_id": 0})
            
            customers_map[phone] = {
                "phone": phone,
                "name": token.get('customer_name'),
                "user_id": token.get('user_id'),
                "gender": user_data.get('gender') if user_data else None
            }
    
    return {"customers": list(customers_map.values())}

@api_router.get("/salons/{salon_id}/customers/{phone}/bookings")
async def get_customer_bookings(salon_id: str, phone: str, current_user=Depends(get_current_salon_user)):
    """Get all bookings for a specific customer"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    bookings = await db.tokens.find(
        {"salon_id": salon_id, "phone": phone},
        {"_id": 0}
    ).sort("created_at", -1).to_list(100)
    
    return {"bookings": bookings}

# Custom Package Models
class CustomerPackageService(BaseModel):
    service_id: str
    service_name: str
    original_price: float
    discounted_price: float

class CustomerPackageCreate(BaseModel):
    salon_id: str
    customer_phone: str
    customer_name: str
    package_name: str
    services: List[CustomerPackageService]
    total_original: float
    discount_percentage: float
    total_discounted: float
    notes: Optional[str] = None

class CustomerPackage(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    customer_phone: str
    customer_name: str
    package_name: str
    services: List[CustomerPackageService]
    total_original: float
    discount_percentage: float
    total_discounted: float
    notes: Optional[str] = None
    is_active: bool = True
    created_at: str

# ============ MEMBERSHIP & WALLET MODELS ============

class MembershipPlanCreate(BaseModel):
    salon_id: str
    name: str  # e.g., "Gold", "Diamond", "Platinum"
    amount: float  # Amount customer pays
    credit: float  # Credit added to wallet
    validity_months: int  # Validity in months
    terms_conditions: str  # T&C text

class MembershipPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    name: str
    amount: float
    credit: float
    validity_months: int
    terms_conditions: str
    is_active: bool = True
    created_at: str

class CustomerMembershipCreate(BaseModel):
    customer_phone: str
    customer_name: str
    membership_plan_id: str
    payment_mode: str  # "cash", "card", "upi", "wallet"
    paid_amount: float

class CustomerMembership(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    customer_phone: str
    customer_name: str
    membership_plan_id: str
    membership_name: str
    payment_mode: str
    paid_amount: float
    credit_added: float
    wallet_balance: float
    expiry_date: str
    is_active: bool = True
    purchased_at: str

class WalletTransaction(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    customer_phone: str
    salon_id: str
    transaction_type: str  # "credit", "debit", "expiry"
    amount: float
    balance_after: float
    description: str
    created_at: str

class LoyaltyTier(BaseModel):
    name: str  # e.g., "Bronze", "Silver", "Gold"
    spend_amount: float  # Threshold
    period_months: int  # Individual period for this tier
    topup_percentage: float  # Reward percentage

class LoyaltyProgramSettings(BaseModel):
    salon_id: str
    enabled: bool = False
    tiers: List[Dict[str, Any]] = []  # Multiple tiers with individual periods

class LoyaltyProgram(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    enabled: bool
    tiers: List[Dict[str, Any]]
    updated_at: str

@api_router.post("/salons/{salon_id}/customer-packages", response_model=CustomerPackage)
async def create_customer_package(salon_id: str, package: CustomerPackageCreate, current_user=Depends(get_current_salon_user)):
    """Create a custom package for a specific customer"""
    package_dict = package.model_dump()
    package_dict["id"] = str(uuid.uuid4())
    package_dict["is_active"] = True
    package_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.customer_packages.insert_one(package_dict)
    return CustomerPackage(**package_dict)

@api_router.get("/salons/{salon_id}/customer-packages/{phone}")
async def get_customer_packages(salon_id: str, phone: str, current_user=Depends(get_current_salon_user)):
    """Get all custom packages for a customer"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    packages = await db.customer_packages.find(
        {"salon_id": salon_id, "customer_phone": phone, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    
    return {"packages": packages}


# ============ MEMBERSHIP & WALLET ROUTES ============

@api_router.post("/salons/{salon_id}/membership-plans", response_model=MembershipPlan)
async def create_membership_plan(salon_id: str, plan: MembershipPlanCreate, current_user=Depends(get_current_salon_admin)):
    """Create a new membership plan"""
    plan_dict = plan.model_dump()
    plan_dict["id"] = str(uuid.uuid4())
    plan_dict["is_active"] = True
    plan_dict["created_at"] = datetime.now(timezone.utc).isoformat()
    
    await db.membership_plans.insert_one(plan_dict)
    return MembershipPlan(**plan_dict)

@api_router.get("/salons/{salon_id}/membership-plans")
async def get_membership_plans(salon_id: str):
    """Get all active membership plans for a salon"""
    plans = await db.membership_plans.find(
        {"salon_id": salon_id, "is_active": True},
        {"_id": 0}
    ).to_list(100)
    return {"plans": plans}


@api_router.put("/salons/{salon_id}/membership-plans/{plan_id}", response_model=MembershipPlan)
async def update_membership_plan(
    salon_id: str,
    plan_id: str,
    plan: MembershipPlanCreate,
    current_user=Depends(get_current_salon_user)
):
    """Update membership plan (price locked, other fields editable)"""
    existing = await db.membership_plans.find_one({"id": plan_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    
    # Update all fields but use existing price (locked)
    await db.membership_plans.update_one(
        {"id": plan_id},
        {"$set": {
            "name": plan.name,
            # "amount": existing["amount"],  # Price is LOCKED
            "credit": plan.credit,
            "validity_months": plan.validity_months,
            "terms_conditions": plan.terms_conditions,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    updated = await db.membership_plans.find_one({"id": plan_id}, {"_id": 0})

@api_router.get("/salons/{salon_id}/sold-memberships")
async def get_sold_memberships(salon_id: str, current_user=Depends(get_current_salon_user)):
    """Get all sold memberships for a salon"""
    memberships = await db.customer_memberships.find({
        "salon_id": salon_id
    }, {"_id": 0}).sort("purchased_at", -1).to_list(1000)
    
    return {"memberships": memberships}

@api_router.put("/salons/{salon_id}/customer-memberships/{membership_id}")
async def update_customer_membership(
    salon_id: str,
    membership_id: str,
    updates: dict,
    current_user=Depends(get_current_salon_user)
):
    """Update a sold membership (wallet balance, expiry, status)"""
    await db.customer_memberships.update_one(
        {"id": membership_id, "salon_id": salon_id},
        {"$set": updates}
    )
    
    return {"message": "Membership updated successfully"}

@api_router.get("/salons/{salon_id}/customers/{phone}/membership")
async def get_customer_membership_info(salon_id: str, phone: str):
    """Get customer's active membership info (no auth required for customer view)"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    membership = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="No active membership found")
    
    return membership

    return updated

@api_router.delete("/salons/{salon_id}/membership-plans/{plan_id}")
async def delete_membership_plan(
    salon_id: str,
    plan_id: str,
    current_user=Depends(get_current_salon_user)
):
    """Delete/deactivate membership plan (doesn't affect existing customers)"""
    result = await db.membership_plans.delete_one({"id": plan_id})
    
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    
    return {"message": "Membership plan deleted successfully"}

@api_router.post("/salons/{salon_id}/sell-membership")
async def sell_membership(salon_id: str, membership: CustomerMembershipCreate, current_user=Depends(get_current_salon_user)):
    """Sell membership to a customer"""
    # Get membership plan
    plan = await db.membership_plans.find_one({"id": membership.membership_plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    
    # Format phone
    phone = membership.customer_phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Calculate expiry date
    expiry_date = datetime.now(timezone.utc) + timedelta(days=plan["validity_months"] * 30)
    
    # Check if customer already has active membership
    existing = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0})
    
    if existing:
        # Add credit to existing wallet
        new_balance = existing["wallet_balance"] + plan["credit"]
        await db.customer_memberships.update_one(
            {"id": existing["id"]},
            {"$set": {
                "wallet_balance": new_balance,
                "expiry_date": expiry_date.isoformat()
            }}
        )
        
        # Record transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": phone,
            "salon_id": salon_id,
            "transaction_type": "credit",
            "amount": plan["credit"],
            "balance_after": new_balance,
            "description": f"Membership renewal: {plan['name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Membership renewed", "new_balance": new_balance}
    else:
        # Create new membership
        membership_data = {
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "customer_phone": phone,
            "customer_name": membership.customer_name,
            "membership_plan_id": plan["id"],
            "membership_name": plan["name"],
            "payment_mode": membership.payment_mode,
            "paid_amount": membership.paid_amount,
            "credit_added": plan["credit"],
            "wallet_balance": plan["credit"],
            "expiry_date": expiry_date.isoformat(),
            "is_active": True,
            "purchased_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.customer_memberships.insert_one(membership_data)
        
        # Record transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": phone,
            "salon_id": salon_id,
            "transaction_type": "credit",
            "amount": plan["credit"],
            "balance_after": plan["credit"],
            "description": f"Membership purchased: {plan['name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Membership created", "membership": membership_data}

@api_router.post("/salons/{salon_id}/customers/{phone}/buy-membership")
async def customer_buy_membership(
    salon_id: str, 
    phone: str,
    membership: CustomerMembershipCreate
):
    """Customer-facing endpoint to buy membership (no auth required)"""
    # Get membership plan
    plan = await db.membership_plans.find_one({"id": membership.membership_plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    
    # Format phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Calculate expiry date
    expiry_date = datetime.now(timezone.utc) + timedelta(days=plan["validity_months"] * 30)
    
    # Check if customer already has active membership
    existing = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0})
    
    if existing:
        # Add credit to existing wallet
        new_balance = existing["wallet_balance"] + plan["credit"]
        await db.customer_memberships.update_one(
            {"id": existing["id"]},
            {"$set": {
                "wallet_balance": new_balance,
                "expiry_date": expiry_date.isoformat()
            }}
        )
        
        # Record transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": phone,
            "salon_id": salon_id,
            "transaction_type": "credit",
            "amount": plan["credit"],
            "balance_after": new_balance,
            "description": f"Membership renewal: {plan['name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Membership renewed", "new_balance": new_balance}
    else:
        # Create new membership
        membership_data = {
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "customer_phone": phone,
            "customer_name": membership.customer_name,
            "membership_plan_id": plan["id"],
            "membership_name": plan["name"],
            "payment_mode": membership.payment_mode,
            "paid_amount": membership.paid_amount,
            "credit_added": plan["credit"],
            "wallet_balance": plan["credit"],
            "expiry_date": expiry_date.isoformat(),
            "is_active": True,
            "purchased_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.customer_memberships.insert_one(membership_data)
        
        # Record transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": phone,
            "salon_id": salon_id,
            "transaction_type": "credit",
            "amount": plan["credit"],
            "balance_after": plan["credit"],
            "description": f"Membership purchased: {plan['name']}",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        return {"message": "Membership created", "membership": membership_data}


@api_router.get("/salons/{salon_id}/customers/{phone}/packages")
async def get_customer_available_packages(salon_id: str, phone: str):
    """Get all packages available to a customer (public + customer-specific)"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Get public salon packages
    public_packages = await db.packages.find({
        "salon_id": salon_id,
        "is_active": True
    }, {"_id": 0}).to_list(100)
    
    # Get customer-specific packages
    customer_packages = await db.customer_packages.find({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0}).to_list(100)
    
    return {
        "public_packages": public_packages,
        "customer_packages": customer_packages
    }


@api_router.get("/salons/{salon_id}/customer-membership/{phone}")
async def get_customer_membership(salon_id: str, phone: str):
    """Get customer's membership and wallet details"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    membership = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0})
    
    if not membership:
        return {"has_membership": False, "wallet_balance": 0}
    
    # Check if expired
    expiry_date = datetime.fromisoformat(membership["expiry_date"])
    if expiry_date < datetime.now(timezone.utc):
        # Mark as inactive
        await db.customer_memberships.update_one(
            {"id": membership["id"]},
            {"$set": {"is_active": False, "wallet_balance": 0}}
        )
        return {"has_membership": False, "wallet_balance": 0, "expired": True}
    
    return {"has_membership": True, **membership}

@api_router.get("/salons/{salon_id}/wallet-transactions/{phone}")
async def get_wallet_transactions(salon_id: str, phone: str):
    """Get customer's wallet transaction history"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    transactions = await db.wallet_transactions.find({
        "salon_id": salon_id,
        "customer_phone": phone
    }, {"_id": 0}).sort("created_at", -1).to_list(100)
    
    return {"transactions": transactions}

@api_router.post("/salons/{salon_id}/use-wallet")
async def use_wallet_balance(salon_id: str, phone: str, amount: float):
    """Deduct amount from customer's wallet"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    membership = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0})
    
    if not membership or membership["wallet_balance"] < amount:
        raise HTTPException(status_code=400, detail="Insufficient wallet balance")
    
    new_balance = membership["wallet_balance"] - amount
    
    await db.customer_memberships.update_one(
        {"id": membership["id"]},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    # Record transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "customer_phone": phone,
        "salon_id": salon_id,
        "transaction_type": "debit",
        "amount": amount,
        "balance_after": new_balance,
        "description": "Used for booking",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {"new_balance": new_balance}

@api_router.post("/salons/{salon_id}/loyalty-program", response_model=LoyaltyProgram)
async def update_loyalty_program(salon_id: str, settings: LoyaltyProgramSettings, current_user=Depends(get_current_salon_admin)):
    """Update loyalty program settings"""
    existing = await db.loyalty_programs.find_one({"salon_id": salon_id}, {"_id": 0})
    
    settings_dict = settings.model_dump()
    settings_dict["updated_at"] = datetime.now(timezone.utc).isoformat()
    
    if existing:
        settings_dict["id"] = existing["id"]
        await db.loyalty_programs.update_one(
            {"salon_id": salon_id},
            {"$set": settings_dict}
        )
    else:
        settings_dict["id"] = str(uuid.uuid4())
        await db.loyalty_programs.insert_one(settings_dict)
    
    return LoyaltyProgram(**settings_dict)

@api_router.get("/salons/{salon_id}/loyalty-program")
async def get_loyalty_program(salon_id: str, current_user=Depends(get_current_salon_user)):
    """Get loyalty program settings"""
    program = await db.loyalty_programs.find_one({"salon_id": salon_id}, {"_id": 0})
    if not program:
        return {
            "enabled": False,
            "spend_amount": 0,
            "period_months": 0,
            "topup_percentage": 0
        }
    return program

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
        
        # Check slot availability - limit 10 tokens per barber per slot
        existing_count = await db.tokens.count_documents({
            "salon_id": booking.salon_id,
            "barber_id": booking.barber_id,
            "date": booking.date,
            "shift": booking.shift,
            "status": {"$nin": ["cancelled"]}
        })
        
        if existing_count >= 10:
            raise HTTPException(
                status_code=400, 
                detail=f"All slots are booked for this barber in {booking.shift} shift. Please select another barber or time slot."
            )
    else:
        barber_name = "Any Available"
        
        # For "any" barber, check if any barber has availability
        barbers = await db.barbers.find(
            {
                "salon_id": booking.salon_id, 
                "is_active": True, 
                "$or": [{"on_leave": False}, {"on_leave": None}, {"on_leave": {"$exists": False}}]
            }, 
            {"_id": 0}
        ).to_list(100)
        
        has_availability = False
        for b in barbers:
            count = await db.tokens.count_documents({
                "salon_id": booking.salon_id,
                "barber_id": b["id"],
                "date": booking.date,
                "shift": booking.shift,
                "status": {"$nin": ["cancelled"]}
            })
            if count < 10:
                has_availability = True
                break
        
        if not has_availability and barbers:
            raise HTTPException(
                status_code=400, 
                detail=f"All slots are booked for {booking.shift} shift. Please select another time slot."
            )
    
    # Calculate total amount
    total_amount = 0
    if booking.barber_id != "any":
        total_amount = await calculate_booking_total(booking.selected_services, booking.barber_id)
    
    # Get token number - always assign immediately (even for future bookings)
    token_number = await get_next_token_number(booking.salon_id, booking.barber_id, booking.date, booking.shift)
    
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
        "status": "waiting" if booking.booking_type == "instant" else "future",
        "payment_status": "pending",
        "payment_mode": None,
        "upi_transaction_id": None,
        "source": booking.source,
        "booking_type": booking.booking_type,
        "booking_for_self": booking.booking_for_self,
        "allocated_at": datetime.now(timezone.utc).isoformat(),
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tokens.insert_one(token_dict)
    
    token = TokenModel(**token_dict)
    await broadcast_update("token_created", token.model_dump())
    
    # Send booking confirmation via WhatsApp
    await send_booking_notification(token_dict, 'booking_confirmation')
    
    return token

# Slot availability endpoint
@api_router.get("/salons/{salon_id}/slot-availability")
async def get_slot_availability(salon_id: str, date: str, shift: str):
    """Check slot availability per barber for a given date and shift"""
    # Find active barbers (on_leave can be False, None, or missing)
    barbers = await db.barbers.find(
        {
            "salon_id": salon_id, 
            "is_active": True, 
            "$or": [{"on_leave": False}, {"on_leave": None}, {"on_leave": {"$exists": False}}]
        }, 
        {"_id": 0, "id": 1, "name": 1}
    ).to_list(100)
    
    result = []
    for barber in barbers:
        count = await db.tokens.count_documents({
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": date,
            "shift": shift,
            "status": {"$nin": ["cancelled"]}
        })
        result.append({
            "barber_id": barber["id"],
            "barber_name": barber["name"],
            "booked": count,
            "available": max(0, 10 - count),
            "is_full": count >= 10
        })
    
    # Check if all slots are full - only true if we have barbers AND all are full
    all_full = all(b["is_full"] for b in result) if result else False
    
    return {
        "date": date,
        "shift": shift,
        "barbers": result,
        "all_slots_full": all_full,
        "max_per_slot": 10
    }

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
    
    # Check and apply loyalty reward
    loyalty_reward = None
    try:
        loyalty_reward = await check_and_apply_loyalty_reward(
            token["salon_id"], 
            token["phone"], 
            token.get("total_amount", 0)
        )
    except Exception as e:
        logger.error(f"Error checking loyalty reward: {e}")
    
    # Generate and send invoice
    try:
        invoice_sent = await generate_and_send_invoice(token_id)
        await broadcast_update("token_completed", {"token_id": token_id})
        
        response = {
            "message": "Token marked as completed",
            "invoice_sent": invoice_sent
        }
        
        if loyalty_reward:
            response["loyalty_reward"] = loyalty_reward
            response["message"] += f" - Loyalty reward of ₹{loyalty_reward['topup_amount']:.2f} added to wallet!"
        
        return response
    except Exception as e:
        logger.error(f"Error generating invoice: {e}")
        return {
            "message": "Token marked as completed but invoice generation failed",
            "error": str(e),
            "loyalty_reward": loyalty_reward
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
        
        # Count total tokens for today (all statuses)
        total_tokens_query = {
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": today
        }
        total_tokens_today = await db.tokens.count_documents(total_tokens_query)
        
        result["barbers"].append({
            "barber_id": barber["id"],
            "barber_name": barber["name"],
            "category": barber.get("category"),
            "specialization": barber.get("specialization"),
            "current_token": barber_called.get("token_number") if barber_called else None,
            "waiting_count": len(barber_waiting),
            "total_tokens_today": total_tokens_today,
            "queue_status": barber.get("queue_status", "available")
        })
    
    return result

@api_router.get("/salons/{salon_id}/live-status")
async def get_salon_live_status(salon_id: str, shift: Optional[str] = None):
    """Get current live status for salon (alias for token-status)"""
    return await get_salon_token_status(salon_id, shift)

# ============ RATING/REVIEW ROUTES ============

@api_router.post("/ratings", response_model=RatingResponse)
async def create_rating(rating_data: RatingCreate):
    """Create a rating/review for a completed booking"""
    # Verify the token exists and is completed
    token = await db.tokens.find_one({"id": rating_data.token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Booking not found")
    
    if token.get("status") != "completed":
        raise HTTPException(status_code=400, detail="Can only rate completed bookings")
    
    # Check if rating already exists for this token
    existing_rating = await db.ratings.find_one({"token_id": rating_data.token_id})
    if existing_rating:
        raise HTTPException(status_code=400, detail="You have already rated this booking")
    
    # Get barber name
    barber = await db.barbers.find_one({"id": rating_data.barber_id}, {"_id": 0})
    barber_name = barber.get("name", "Unknown") if barber else "Unknown"
    
    # Get user info from token
    user_id = token.get("user_id", "")
    user_name = token.get("customer_name", "Customer")
    
    # Create rating
    rating_dict = {
        "id": str(uuid.uuid4()),
        "token_id": rating_data.token_id,
        "user_id": user_id,
        "user_name": user_name,
        "barber_id": rating_data.barber_id,
        "barber_name": barber_name,
        "salon_id": rating_data.salon_id,
        "rating": rating_data.rating,
        "review": rating_data.review,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.ratings.insert_one(rating_dict)
    
    # Update barber's average rating
    await update_barber_average_rating(rating_data.barber_id)
    
    return RatingResponse(**rating_dict)

async def update_barber_average_rating(barber_id: str):
    """Update barber's average rating after a new review"""
    pipeline = [
        {"$match": {"barber_id": barber_id}},
        {"$group": {
            "_id": "$barber_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    result = await db.ratings.aggregate(pipeline).to_list(1)
    
    if result:
        avg_rating = round(result[0]["average_rating"], 1)
        total_reviews = result[0]["total_reviews"]
        await db.barbers.update_one(
            {"id": barber_id},
            {"$set": {"rating": avg_rating, "total_reviews": total_reviews}}
        )

@api_router.get("/barbers/{barber_id}/ratings", response_model=BarberRatingSummary)
async def get_barber_ratings(barber_id: str, limit: int = 20, skip: int = 0):
    """Get all ratings and reviews for a barber"""
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    # Get ratings
    reviews = await db.ratings.find(
        {"barber_id": barber_id},
        {"_id": 0}
    ).sort("created_at", -1).skip(skip).limit(limit).to_list(limit)
    
    # Calculate average
    pipeline = [
        {"$match": {"barber_id": barber_id}},
        {"$group": {
            "_id": "$barber_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(1)
    
    avg_rating = round(stats[0]["average_rating"], 1) if stats else 0
    total_reviews = stats[0]["total_reviews"] if stats else 0
    
    return BarberRatingSummary(
        barber_id=barber_id,
        barber_name=barber.get("name", "Unknown"),
        average_rating=avg_rating,
        total_reviews=total_reviews,
        reviews=[RatingResponse(**r) for r in reviews]
    )

@api_router.get("/salons/{salon_id}/barbers/{barber_id}/profile")
async def get_barber_profile(salon_id: str, barber_id: str):
    """Get detailed barber profile with ratings"""
    barber = await db.barbers.find_one(
        {"id": barber_id, "salon_id": salon_id},
        {"_id": 0}
    )
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    # Get barber's services
    barber_services = await db.barber_services.find(
        {"barber_id": barber_id, "is_available": True},
        {"_id": 0}
    ).to_list(100)
    
    service_ids = [bs["service_id"] for bs in barber_services]
    services = await db.services.find(
        {"id": {"$in": service_ids}},
        {"_id": 0}
    ).to_list(100)
    
    # Add prices to services
    price_map = {bs["service_id"]: bs["price"] for bs in barber_services}
    for service in services:
        service["barber_price"] = price_map.get(service["id"], service.get("base_price", 0))
    
    # Get ratings summary
    pipeline = [
        {"$match": {"barber_id": barber_id}},
        {"$group": {
            "_id": "$barber_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(1)
    
    # Get recent reviews
    reviews = await db.ratings.find(
        {"barber_id": barber_id},
        {"_id": 0}
    ).sort("created_at", -1).limit(10).to_list(10)
    
    return {
        **barber,
        "services": services,
        "average_rating": round(stats[0]["average_rating"], 1) if stats else barber.get("rating", 0),
        "total_reviews": stats[0]["total_reviews"] if stats else 0,
        "recent_reviews": reviews
    }

@api_router.get("/tokens/{token_id}")
async def get_token_details(token_id: str):
    """Get details of a specific token"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    return token

@api_router.get("/tokens/{token_id}/can-rate")
async def check_can_rate_token(token_id: str):
    """Check if a token can be rated"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Check if already rated
    existing_rating = await db.ratings.find_one({"token_id": token_id})
    
    return {
        "can_rate": token.get("status") == "completed" and not existing_rating,
        "is_completed": token.get("status") == "completed",
        "already_rated": existing_rating is not None
    }

@api_router.get("/users/{user_id}/pending-ratings")
async def get_user_pending_ratings(user_id: str):
    """Get completed bookings that haven't been rated yet"""
    # Get completed tokens for this user
    completed_tokens = await db.tokens.find(
        {"user_id": user_id, "status": "completed"},
        {"_id": 0}
    ).sort("completed_at", -1).limit(20).to_list(20)
    
    # Filter out already rated ones
    pending_ratings = []
    for token in completed_tokens:
        existing_rating = await db.ratings.find_one({"token_id": token["id"]})
        if not existing_rating:
            pending_ratings.append(token)
    
    return pending_ratings

# Direct barber review endpoint (for customers viewing barber profile)
class DirectBarberReview(BaseModel):
    user_id: Optional[str] = None
    user_name: str
    rating: int
    review: str

@api_router.post("/barbers/{barber_id}/reviews")
async def create_barber_review(barber_id: str, review_data: DirectBarberReview):
    """Create a direct review for a barber (without requiring a completed booking)"""
    # Verify barber exists
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
    if not barber:
        raise HTTPException(status_code=404, detail="Barber not found")
    
    # Validate rating
    if review_data.rating < 1 or review_data.rating > 5:
        raise HTTPException(status_code=400, detail="Rating must be between 1 and 5")
    
    # Create review
    review = {
        "id": str(uuid.uuid4()),
        "barber_id": barber_id,
        "salon_id": barber.get("salon_id"),
        "user_id": review_data.user_id,
        "user_name": review_data.user_name,
        "rating": review_data.rating,
        "review": review_data.review,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "type": "direct"  # To distinguish from booking-based reviews
    }
    
    await db.ratings.insert_one(review)
    
    # Update barber's average rating
    pipeline = [
        {"$match": {"barber_id": barber_id}},
        {"$group": {
            "_id": "$barber_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    stats = await db.ratings.aggregate(pipeline).to_list(1)
    
    if stats:
        await db.barbers.update_one(
            {"id": barber_id},
            {"$set": {
                "rating": round(stats[0]["average_rating"], 1),
                "total_reviews": stats[0]["total_reviews"]
            }}
        )
    
    return {"message": "Review submitted successfully", "review_id": review["id"]}

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
