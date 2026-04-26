from fastapi import FastAPI, APIRouter, HTTPException, Depends, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.responses import Response, HTMLResponse
from dotenv import load_dotenv
from starlette.middleware.cors import CORSMiddleware
from motor.motor_asyncio import AsyncIOMotorClient
import socketio
import os
import logging
from pathlib import Path
from pydantic import BaseModel, Field, ConfigDict
from typing import List, Optional, Dict, Any
from enum import Enum
import uuid
from datetime import datetime, timezone, time, timedelta
import calendar
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

class DayOperationalHours(BaseModel):
    """Operational hours for a specific day"""
    is_holiday: bool = False
    opening_time: Optional[str] = "09:00"  # Format: "HH:MM"
    closing_time: Optional[str] = "20:00"  # Format: "HH:MM"
    lunch_start: Optional[str] = None  # Format: "HH:MM"
    lunch_end: Optional[str] = None  # Format: "HH:MM"

class OperationalHours(BaseModel):
    """Weekly operational hours"""
    monday: DayOperationalHours = Field(default_factory=DayOperationalHours)
    tuesday: DayOperationalHours = Field(default_factory=DayOperationalHours)
    wednesday: DayOperationalHours = Field(default_factory=DayOperationalHours)
    thursday: DayOperationalHours = Field(default_factory=DayOperationalHours)
    friday: DayOperationalHours = Field(default_factory=DayOperationalHours)
    saturday: DayOperationalHours = Field(default_factory=DayOperationalHours)
    sunday: DayOperationalHours = Field(default_factory=DayOperationalHours)

class ManualToggle(BaseModel):
    """Manual open/close override"""
    is_overridden: bool = False
    is_open: bool = True
    overridden_at: Optional[str] = None  # ISO timestamp

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
    operational_hours: Optional[OperationalHours] = None
    manual_toggle: Optional[ManualToggle] = None
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
    thumbnail_url: Optional[str] = None  # Circular thumbnail for category display
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
    thumbnail_url: Optional[str] = None
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
    thumbnail_url: Optional[str] = None  # Circular thumbnail for category display
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
    gender_specialization: Optional[str] = None  # Men/Women/Unisex/Kids
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
    gender_specialization: Optional[str] = None  # Men/Women/Unisex/Kids
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
    gender_specialization: Optional[str] = None  # Men/Women/Unisex/Kids
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
    dob: Optional[str] = None  # YYYY-MM-DD
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None
    is_otp_verified: Optional[bool] = False  # OTP verification status
    otp_verified_at: Optional[str] = None  # When OTP was verified
    created_at: str


class CustomerOTPRequest(BaseModel):
    phone: str

class CustomerOTPVerify(BaseModel):
    phone: str
    otp: str


class UserProfileUpdate(BaseModel):
    name: Optional[str] = None
    gender: Optional[str] = None
    dob: Optional[str] = None
    email: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    pincode: Optional[str] = None

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
    payment_mode: Optional[str] = None  # cash/upi/wallet/card
    customer_gender: Optional[str] = None

class TokenModel(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    token_number: str  # Global/salon-wide token: M1, M2, N1, E1...
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
    # 75%-rule capacity tracking
    total_service_minutes: Optional[int] = None
    blocked_minutes: Optional[int] = None
    status: str = "waiting"  # waiting | called | completed | skipped
    payment_status: str = "pending"
    payment_mode: Optional[str] = None
    payment_confirmed: bool = False  # Salon must confirm payment before completing
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
    final_amount: Optional[float] = None  # Override final amount (salon can adjust)

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
    can_access_financials: bool = False
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
    
    # For legacy salon tokens, salon_id is in 'sub' field
    if payload.get("role") == "salon" and "salon_id" not in payload:
        payload["salon_id"] = payload.get("sub")
    
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

async def get_next_token_number(salon_id: str, date: str, shift: str) -> str:
    """Get next SALON-WIDE token number for date/shift.

    Token format: {shift_prefix}{seq} where seq is a salon-wide sequence per shift.
    Example: M1, M2, N1, E1, ...
    This is the GLOBAL (total) token number visible to customer & salon.
    Barber-wise position is computed separately (see compute_barber_queue_position).
    """
    prefix = get_shift_prefix(shift)

    tokens = await db.tokens.find(
        {"salon_id": salon_id, "date": date, "shift": shift},
        {"_id": 0, "token_number": 1}
    ).to_list(5000)

    # Only consider tokens starting with this prefix
    shift_tokens = [t for t in tokens if t.get("token_number", "").startswith(prefix)]
    if shift_tokens:
        max_seq = max([extract_token_sequence(t["token_number"]) for t in shift_tokens])
        next_seq = max_seq + 1
    else:
        next_seq = 1

    # No zero-padding; customers see M12, N3 etc. (matches PRD examples like M12)
    return f"{prefix}{next_seq}"

def generate_2hour_slots():
    """DEPRECATED: Generate 2-hour time slots (kept for backward compatibility)"""
    slots = []
    start_times = list(range(8, 22, 2))  # 8AM to 10PM, every 2 hours
    
    for start in start_times:
        end = start + 2
        slot = f"{start:02d}:00-{end:02d}:00"
        slots.append(slot)
    
    return slots


# ============================================================================
# ADVANCED TOKEN MANAGEMENT — Shift capacity, 75% rule, barber-wise queue
# ============================================================================

# Token system tuning constants
BLOCKING_FACTOR = 0.75  # 75% rule: blocked time = service duration × 0.75
DEFAULT_SERVICE_DURATION = 30  # fallback minutes if service has no duration

# Default shift window when salon has no operational_hours configured
DEFAULT_OPEN_HOUR = 9
DEFAULT_CLOSE_HOUR = 21


def _parse_hour(hhmm: Optional[str], default_h: int) -> int:
    """Return integer hour portion of 'HH:MM'. Defaults if empty/malformed."""
    try:
        if not hhmm:
            return default_h
        return int(hhmm.split(":")[0])
    except Exception:
        return default_h


def _weekday_key(date_str: str) -> str:
    """Return lowercase day name (monday..sunday) for a date string YYYY-MM-DD."""
    try:
        return datetime.fromisoformat(date_str).strftime("%A").lower()
    except Exception:
        return datetime.now(timezone.utc).strftime("%A").lower()


async def get_salon_shift_windows(salon_id: str, date: str) -> Dict[str, Dict[str, int]]:
    """
    Compute shift windows for a salon on a given date based on its operational hours.

    Rules (per user spec):
      - Base: 4 hours per shift (Morning, Noon, Evening) = 12h baseline.
      - Shift durations derived from salon's opening/closing time.
      - Extra hours go to Morning first, then Evening (lunch counts as part of Evening).
      - All hours kept as whole numbers.

    Returns:
        {
          "Morning": {"start": 7, "end": 11, "duration_hours": 4, "duration_minutes": 240},
          "Noon":    {"start": 11, "end": 15, ...},
          "Evening": {"start": 15, "end": 19, ...},
        }
    """
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0}) or {}
    op_hours = salon.get("operational_hours") or {}

    day_key = _weekday_key(date)
    day_hours = op_hours.get(day_key) if isinstance(op_hours, dict) else None

    if isinstance(day_hours, dict) and not day_hours.get("is_holiday"):
        open_h = _parse_hour(day_hours.get("opening_time"), DEFAULT_OPEN_HOUR)
        close_h = _parse_hour(day_hours.get("closing_time"), DEFAULT_CLOSE_HOUR)
    else:
        open_h, close_h = DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR

    if close_h <= open_h:
        # fall back to defaults if malformed
        open_h, close_h = DEFAULT_OPEN_HOUR, DEFAULT_CLOSE_HOUR

    total_hours = close_h - open_h

    # Distribute hours: base even split, then extras -> Morning, then Evening
    base = total_hours // 3
    extras = total_hours % 3
    durations = [base, base, base]  # [M, N, E]
    if extras >= 1:
        durations[0] += 1  # morning
    if extras >= 2:
        durations[2] += 1  # evening (lunch stays in evening window)
    # (extras==3 not possible since %3)

    m_start = open_h
    m_end = m_start + durations[0]
    n_start = m_end
    n_end = n_start + durations[1]
    e_start = n_end
    e_end = e_start + durations[2]

    return {
        "Morning": {
            "start": m_start, "end": m_end,
            "duration_hours": durations[0],
            "duration_minutes": durations[0] * 60,
        },
        "Noon": {
            "start": n_start, "end": n_end,
            "duration_hours": durations[1],
            "duration_minutes": durations[1] * 60,
        },
        "Evening": {
            "start": e_start, "end": e_end,
            "duration_hours": durations[2],
            "duration_minutes": durations[2] * 60,
        },
    }


async def calc_service_total_minutes(service_ids: List[str]) -> int:
    """Sum default_duration of provided services in minutes. Unknown services get DEFAULT_SERVICE_DURATION."""
    if not service_ids:
        return 0
    total = 0
    for sid in service_ids:
        svc = await db.services.find_one({"id": sid}, {"_id": 0, "default_duration": 1})
        if svc and svc.get("default_duration"):
            total += int(svc["default_duration"])
        else:
            total += DEFAULT_SERVICE_DURATION
    return total


def calc_blocked_minutes_from_total(total_minutes: int) -> int:
    """Apply 75% rule. Ceil so partial minutes always count toward capacity."""
    if total_minutes <= 0:
        return 0
    return math.ceil(total_minutes * BLOCKING_FACTOR)


async def get_barber_blocked_minutes_used(salon_id: str, barber_id: str, date: str, shift: str) -> int:
    """Sum blocked minutes of *pending* tokens assigned to this barber for this shift.

    Only bookings that still occupy the chair count toward capacity:
      • waiting / future / in_progress / called → COUNT (pending)
      • completed / cancelled / skipped         → DO NOT count (slot is free again)

    This means a barber who finishes a booking inside a shift can immediately
    accept a new booking in the same shift if the shift duration permits.
    """
    if barber_id == "any":
        return 0
    tokens = await db.tokens.find(
        {
            "salon_id": salon_id,
            "barber_id": barber_id,
            "date": date,
            "shift": shift,
            "status": {"$nin": ["cancelled", "skipped", "completed"]},
        },
        {"_id": 0, "selected_services": 1, "blocked_minutes": 1, "total_service_minutes": 1},
    ).to_list(1000)

    used = 0
    for t in tokens:
        if t.get("blocked_minutes") is not None:
            used += int(t["blocked_minutes"])
        else:
            mins = await calc_service_total_minutes(t.get("selected_services", []))
            used += calc_blocked_minutes_from_total(mins)
    return used


async def can_fit_in_barber_shift(
    salon_id: str, barber_id: str, date: str, shift: str, new_blocked_minutes: int
) -> Dict[str, Any]:
    """Shift-availability check per the user's rounding rule:

      Shift is declared FULL once the cumulative blocked time crosses the shift duration.
      The booking that causes the crossover is still allowed (last one may cross).
      The next booking is blocked.

    Returns dict with: allowed, used_before, used_after, capacity_minutes, is_full_after
    """
    windows = await get_salon_shift_windows(salon_id, date)
    shift_info = windows.get(shift) or {}
    capacity = int(shift_info.get("duration_minutes", 0))

    used_before = await get_barber_blocked_minutes_used(salon_id, barber_id, date, shift)

    # Not allowed if the shift was ALREADY full before this booking
    already_full = used_before >= capacity if capacity > 0 else False
    allowed = (not already_full) and capacity > 0

    used_after = used_before + (new_blocked_minutes if allowed else 0)
    is_full_after = used_after >= capacity if capacity > 0 else True

    return {
        "allowed": allowed,
        "used_before": used_before,
        "used_after": used_after,
        "capacity_minutes": capacity,
        "is_full_before": already_full,
        "is_full_after": is_full_after,
    }


async def pick_fastest_barber(
    salon_id: str, date: str, shift: str, required_blocked_minutes: int,
    customer_gender: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    """Auto-assign the 'fastest' barber using the priority rules.

    Priority 1: Barber with shortest ACTIVE queue today (waiting + called),
                AND enough capacity in this shift.
    Priority 2: Barber with fewest bookings YESTERDAY, with enough capacity.
    Priority 3: Any random active barber with enough capacity.

    Returns the chosen barber doc or None if no barber has capacity.
    """
    barbers = await db.barbers.find(
        {
            "salon_id": salon_id,
            "is_active": True,
            "$or": [{"on_leave": False}, {"on_leave": None}, {"on_leave": {"$exists": False}}],
        },
        {"_id": 0},
    ).to_list(500)

    if not barbers:
        return None

    # Filter barbers with capacity for this shift
    eligible = []
    for b in barbers:
        fit = await can_fit_in_barber_shift(salon_id, b["id"], date, shift, required_blocked_minutes)
        if fit["allowed"]:
            eligible.append(b)

    if not eligible:
        return None

    # Priority 1: shortest active queue today
    today_counts = []
    for b in eligible:
        cnt = await db.tokens.count_documents({
            "salon_id": salon_id,
            "barber_id": b["id"],
            "date": date,
            "status": {"$in": ["waiting", "called", "in_progress", "in_service"]},
        })
        today_counts.append((cnt, b))

    if today_counts:
        min_today = min(c for c, _ in today_counts)
        # If there are barbers with zero/low counts, pick any among those.
        # If ALL are zero (no data today), fall to priority 2.
        if min_today > 0 or any(c > 0 for c, _ in today_counts):
            tied = [b for c, b in today_counts if c == min_today]
            return random.choice(tied)

    # Priority 2: fewest bookings YESTERDAY
    try:
        yest = (datetime.fromisoformat(date) - timedelta(days=1)).strftime("%Y-%m-%d")
    except Exception:
        yest = (datetime.now(timezone.utc) - timedelta(days=1)).strftime("%Y-%m-%d")

    yest_counts = []
    for b in eligible:
        cnt = await db.tokens.count_documents({
            "salon_id": salon_id,
            "barber_id": b["id"],
            "date": yest,
            "status": {"$nin": ["cancelled", "skipped"]},
        })
        yest_counts.append((cnt, b))

    if yest_counts and any(c > 0 for c, _ in yest_counts):
        min_yest = min(c for c, _ in yest_counts)
        tied = [b for c, b in yest_counts if c == min_yest]
        return random.choice(tied)

    # Priority 3: random active barber
    return random.choice(eligible)


async def compute_barber_queue_snapshot(salon_id: str, barber_id: str, date: str) -> Dict[str, Any]:
    """Return barber queue context used for position & wait calculations.

    Shape:
      {
        "currently_serving": {token_number, customer_name, id, blocked_minutes, ...} | None,
        "waiting_queue": [token, ...] ordered by created_at ascending,
        "remaining_current_minutes": int (75%-rule residual for the token being served)
      }
    """
    if not barber_id or barber_id == "any":
        return {"currently_serving": None, "waiting_queue": [], "remaining_current_minutes": 0}

    # Currently serving: status 'called' or 'in_progress'/'in_service'
    serving = await db.tokens.find_one(
        {
            "salon_id": salon_id,
            "barber_id": barber_id,
            "date": date,
            "status": {"$in": ["called", "in_progress", "in_service"]},
        },
        {"_id": 0},
        sort=[("called_at", -1)],
    )

    remaining = 0
    if serving:
        if serving.get("blocked_minutes") is not None:
            remaining = int(serving["blocked_minutes"])
        else:
            mins = await calc_service_total_minutes(serving.get("selected_services", []))
            remaining = calc_blocked_minutes_from_total(mins)
        # If called_at present, subtract elapsed; floor at 0
        try:
            if serving.get("called_at"):
                called_dt = datetime.fromisoformat(serving["called_at"].replace("Z", "+00:00"))
                elapsed = (datetime.now(timezone.utc) - called_dt).total_seconds() / 60
                remaining = max(0, int(remaining - elapsed))
        except Exception:
            pass

    waiting = await db.tokens.find(
        {
            "salon_id": salon_id,
            "barber_id": barber_id,
            "date": date,
            "status": "waiting",
        },
        {"_id": 0},
    ).sort("created_at", 1).to_list(1000)

    return {
        "currently_serving": serving,
        "waiting_queue": waiting,
        "remaining_current_minutes": remaining,
    }


async def compute_queue_status_for_token(token: Dict[str, Any]) -> Dict[str, Any]:
    """Build customer-facing queue view for a single token.

    Returns:
      {
        total_token, barber_name, barber_id,
        position, people_before, estimated_wait_minutes,
        currently_serving_token, currently_serving_services, approx_finish_time_minutes,
        status_message, is_current (True when THIS customer is being served)
      }
    """
    salon_id = token.get("salon_id")
    barber_id = token.get("barber_id")
    date = token.get("date")
    token_id = token.get("id")

    snapshot = await compute_barber_queue_snapshot(salon_id, barber_id, date)
    serving = snapshot["currently_serving"]
    waiting = snapshot["waiting_queue"]
    remaining_current = snapshot["remaining_current_minutes"]

    status = token.get("status")
    is_current_customer = bool(serving and serving.get("id") == token_id)

    position = 0
    people_before = 0
    wait_minutes = 0
    status_message = ""

    if is_current_customer:
        position = 1
        people_before = 0
        wait_minutes = 0
        status_message = "It's your turn — you're being served now."
    elif status in ("called", "in_progress", "in_service"):
        # Called but maybe not the 'serving' lookup returned them — treat as current
        position = 1
        people_before = 0
        wait_minutes = 0
        status_message = "Please proceed to the salon chair."
    elif status == "waiting":
        # Find index in waiting queue (FIFO by created_at)
        idx = next((i for i, t in enumerate(waiting) if t.get("id") == token_id), None)
        if idx is None:
            position = 1
            people_before = 0
        else:
            people_before = idx + (1 if serving else 0)
            position = people_before + 1
        # wait = remaining_current + blocked minutes of all waiting tokens ahead
        wait_minutes = remaining_current
        if idx is not None:
            for t in waiting[:idx]:
                if t.get("blocked_minutes") is not None:
                    wait_minutes += int(t["blocked_minutes"])
                else:
                    mins = await calc_service_total_minutes(t.get("selected_services", []))
                    wait_minutes += calc_blocked_minutes_from_total(mins)

        if people_before >= 3:
            status_message = f"{people_before} customers before you."
        elif people_before == 2:
            status_message = "Your turn is coming soon. Please be ready."
        elif people_before == 1:
            status_message = "Please proceed to the salon chair."
        else:
            status_message = "You're next!"
    elif status == "completed":
        status_message = "Service completed."
    elif status == "cancelled":
        status_message = "Booking cancelled."
    elif status == "skipped":
        status_message = "Booking skipped."
    else:
        status_message = "Waiting for the salon to start the shift."

    # Currently-serving info (for Live Chair Status section)
    serving_payload = None
    approx_finish = None
    if serving:
        # Fetch service names briefly
        svc_names = []
        for sid in serving.get("selected_services", []) or []:
            svc = await db.services.find_one({"id": sid}, {"_id": 0, "service_name": 1})
            if svc:
                svc_names.append(svc.get("service_name"))
        serving_payload = {
            "token_number": serving.get("token_number"),
            "customer_name_masked": _mask_name(serving.get("customer_name")),
            "services": svc_names,
            "started_at": serving.get("called_at"),
        }
        approx_finish = remaining_current

    return {
        "total_token": token.get("token_number"),
        "barber_id": barber_id,
        "barber_name": token.get("barber_name"),
        "position": position,
        "people_before": people_before,
        "estimated_wait_minutes": wait_minutes,
        "currently_serving": serving_payload,
        "approx_finish_minutes": approx_finish,
        "status": status,
        "is_current_customer": is_current_customer,
        "status_message": status_message,
    }


def _mask_name(name: Optional[str]) -> str:
    """Privacy: show first name only or initials to avoid leaking identities."""
    if not name:
        return ""
    first = name.strip().split(" ")[0]
    if len(first) <= 2:
        return first
    return first[0] + "*" * (len(first) - 2) + first[-1]

async def check_and_apply_loyalty_reward(salon_id: str, customer_phone: str, booking_amount: float, payment_mode: str = None):
    """Check if customer qualifies for loyalty reward and auto top-up wallet (Multi-Tier with individual periods)
    
    IMPORTANT: Only counts completed bookings paid by non-wallet methods (cash, upi, pay_later, card).
    Wallet balance is independent of membership - stored in customer_wallets collection.
    """
    # Get loyalty program settings
    loyalty_program = await db.loyalty_programs.find_one({"salon_id": salon_id, "enabled": True}, {"_id": 0})
    if not loyalty_program or not loyalty_program.get("tiers"):
        return None
    
    # Normalize phone number
    if not customer_phone.startswith("+91"):
        customer_phone = f"+91{customer_phone}"
    
    # Find highest qualifying tier (each tier has its own period)
    qualifying_tier = None
    total_spend_for_tier = 0
    
    for tier in sorted(loyalty_program["tiers"], key=lambda x: x["spend_amount"], reverse=True):
        # Calculate date range for THIS tier's period
        cutoff_date = datetime.now(timezone.utc) - timedelta(days=tier["period_months"] * 30)
        
        # Get customer's completed bookings in THIS tier's period
        # ONLY count bookings paid by non-wallet methods (cash, upi, pay_later, card)
        completed_bookings = await db.tokens.find({
            "salon_id": salon_id,
            "phone": customer_phone,
            "status": "completed",
            "completed_at": {"$gte": cutoff_date.isoformat()},
            "payment_mode": {"$nin": ["wallet", None]}  # Exclude wallet payments
        }, {"_id": 0, "total_amount": 1, "payment_mode": 1}).to_list(1000)
        
        # Calculate total spend in this period (only non-wallet payments)
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
    
    # Check if customer already received this tier's reward in current period
    # to avoid duplicate rewards
    cutoff_for_check = datetime.now(timezone.utc) - timedelta(days=qualifying_tier["period_months"] * 30)
    existing_reward = await db.loyalty_rewards.find_one({
        "salon_id": salon_id,
        "customer_phone": customer_phone,
        "tier_name": qualifying_tier["name"],
        "created_at": {"$gte": cutoff_for_check.isoformat()}
    })
    
    if existing_reward:
        # Already rewarded for this tier in current period
        return None
    
    # Get or create customer wallet (independent of membership)
    customer_wallet = await db.customer_wallets.find_one({
        "salon_id": salon_id,
        "customer_phone": customer_phone
    }, {"_id": 0})
    
    if customer_wallet:
        # Top up existing wallet
        new_balance = customer_wallet["wallet_balance"] + topup_amount
        await db.customer_wallets.update_one(
            {"id": customer_wallet["id"]},
            {"$set": {"wallet_balance": new_balance, "updated_at": datetime.now(timezone.utc).isoformat()}}
        )
    else:
        # Create new customer wallet
        new_balance = topup_amount
        customer_wallet = {
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "customer_phone": customer_phone,
            "wallet_balance": new_balance,
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        await db.customer_wallets.insert_one(customer_wallet)
    
    # Record the loyalty reward to prevent duplicates
    await db.loyalty_rewards.insert_one({
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "customer_phone": customer_phone,
        "tier_name": qualifying_tier["name"],
        "topup_amount": topup_amount,
        "total_spend": total_spend_for_tier,
        "period_months": qualifying_tier["period_months"],
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Record wallet transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "customer_phone": customer_phone,
        "salon_id": salon_id,
        "transaction_type": "credit",
        "amount": topup_amount,
        "balance_after": new_balance,
        "description": f"🎉 Loyalty reward ({qualifying_tier['name']} tier): Spent ₹{total_spend_for_tier:.2f} in {qualifying_tier['period_months']} months",
        "source": "loyalty_reward",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create in-app notification for customer
    await create_in_app_notification(
        user_type="customer",
        user_id=customer_phone,
        title="🎉 Loyalty Bonus Credited!",
        message=f"Congratulations! You've earned ₹{topup_amount:.2f} as loyalty reward ({qualifying_tier['name']} tier). Your new wallet balance is ₹{new_balance:.2f}.",
        notification_type="loyalty_reward",
        setting_key="membership_added",
        salon_id=salon_id,
        related_id=customer_wallet.get("id", "")
    )
    
    # Send WhatsApp notification for loyalty bonus
    try:
        # Get salon name for the message
        salon = await db.salons.find_one({"id": salon_id}, {"_id": 0, "salon_name": 1})
        salon_name = salon.get("salon_name", "The Salon") if salon else "The Salon"
        
        whatsapp_message = f"""🎉 *Loyalty Bonus Credited!*

Hi! Great news from *{salon_name}*!

You've earned a loyalty reward:
• *Tier*: {qualifying_tier['name']}
• *Bonus*: ₹{topup_amount:.2f}
• *Total Spend*: ₹{total_spend_for_tier:.2f} in {qualifying_tier['period_months']} months

💰 *New Wallet Balance*: ₹{new_balance:.2f}

Thank you for being a valued customer! Use your wallet balance on your next visit.

Book your next appointment on SalonHub! 💇"""
        
        await send_whatsapp_notification(customer_phone, whatsapp_message, "loyalty_bonus")
        logger.info(f"WhatsApp loyalty notification sent to {customer_phone}")
    except Exception as e:
        logger.error(f"Failed to send WhatsApp loyalty notification to {customer_phone}: {e}")
    
    return {
        "rewarded": True,
        "tier": qualifying_tier["name"],
        "topup_amount": topup_amount,
        "new_balance": new_balance,
        "total_spend": total_spend_for_tier
    }

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

# ============ NOTIFICATION SETTINGS ============

# Default notification preferences
DEFAULT_SALON_NOTIFICATION_SETTINGS = {
    "new_booking": True,
    "booking_change": True,
    "membership_purchase": True,
    "review_added": True,
}

DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS = {
    # In-app toggles
    "payment_confirmation": True,
    "turn_approaching": True,
    "manual_notify": True,
    "membership_added": True,
    "membership_expiry": True,  # 30-day and 7-day reminders
    "booking_status_change": True,
    "custom_package": True,
    # WhatsApp toggles (independent on/off for whatsapp messages)
    "whatsapp_payment_confirmation": True,
    "whatsapp_turn_approaching": True,
    "whatsapp_manual_notify": True,
    "whatsapp_membership_added": True,
    "whatsapp_membership_expiry": True,
    "whatsapp_booking_status_change": True,
    "whatsapp_booking_confirmation": True,
    "whatsapp_booking_cancelled": True,
    "whatsapp_booking_rescheduled": True,
}


async def get_salon_notification_settings(salon_id: str) -> dict:
    """Get salon notification settings, creating defaults if missing."""
    settings = await db.salon_notification_settings.find_one({"salon_id": salon_id}, {"_id": 0})
    if not settings:
        return {**DEFAULT_SALON_NOTIFICATION_SETTINGS, "salon_id": salon_id}
    # Merge with defaults to ensure new keys default to True
    merged = {**DEFAULT_SALON_NOTIFICATION_SETTINGS, **settings}
    return merged


async def get_customer_notification_settings(phone: str) -> dict:
    """Get customer notification settings, creating defaults if missing."""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    settings = await db.customer_notification_settings.find_one({"phone": phone}, {"_id": 0})
    if not settings:
        return {**DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS, "phone": phone}
    merged = {**DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS, **settings}
    return merged


async def create_in_app_notification(
    user_type: str,
    user_id: str,
    title: str,
    message: str,
    notification_type: str,
    setting_key: str,
    salon_id: str = "",
    related_id: str = "",
):
    """Create an in-app notification, respecting user's notification preferences."""
    try:
        # Normalize phone for customer
        if user_type == "customer" and not user_id.startswith("+91"):
            user_id = f"+91{user_id}"

        # Check user preferences
        if user_type == "salon":
            settings = await get_salon_notification_settings(user_id)
        else:
            settings = await get_customer_notification_settings(user_id)

        if not settings.get(setting_key, True):
            logger.info(f"In-app notification suppressed for {user_type}/{user_id} (setting {setting_key} is OFF)")
            return None

        notification = {
            "id": str(uuid.uuid4()),
            "user_type": user_type,
            "user_id": user_id,
            "salon_id": salon_id,
            "title": title,
            "message": message,
            "type": notification_type,
            "related_id": related_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        }
        await db.notifications.insert_one(notification)
        # Best-effort live broadcast (non-blocking)
        try:
            await sio.emit("notification_created", {
                "user_type": user_type,
                "user_id": user_id,
                "notification": {**notification},
            })
        except Exception:
            pass
        return notification
    except Exception as e:
        logger.error(f"Failed to create in-app notification: {e}")
        return None


async def should_send_customer_whatsapp(phone: str, setting_key: str) -> bool:
    """Check if customer has WhatsApp notifications enabled for given key."""
    settings = await get_customer_notification_settings(phone)
    return bool(settings.get(setting_key, True))


def build_action_links(token_id: str, salon_id: str) -> str:
    """Build clickable Reschedule and Cancel action links for WhatsApp messages."""
    base = os.getenv("FRONTEND_BASE_URL") or os.getenv("REACT_APP_BACKEND_URL", "")
    if not base:
        return ""
    base = base.rstrip("/")
    api_base = base
    # Use relative API path for cancel that returns confirmation HTML
    reschedule_url = f"{base}/book/{salon_id}?modify={token_id}"
    cancel_url = f"{api_base}/api/tokens/{token_id}/cancel-link"
    return f"\n\n🔁 *Reschedule:* {reschedule_url}\n❌ *Cancel:* {cancel_url}"


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
        whatsapp_setting_key = None
        action_links = ""

        token_id = token_data.get('id')
        salon_id_for_links = token_data.get('salon_id', '')
        
        if notification_type == 'booking_confirmation':
            message = format_booking_confirmation(
                customer_name=customer_name,
                token_number=token_data.get('token_number', 0),
                date=token_data.get('date'),
                time_slot=token_data.get('time_slot'),
                barber_name=token_data.get('barber_name'),
                salon_name=salon_name
            )
            whatsapp_setting_key = 'whatsapp_booking_confirmation'
            if token_id and salon_id_for_links:
                action_links = build_action_links(token_id, salon_id_for_links)
        elif notification_type == 'token_called':
            message = format_token_called(
                customer_name=customer_name,
                token_number=token_data.get('token_number'),
                barber_name=token_data.get('barber_name')
            )
            whatsapp_setting_key = 'whatsapp_turn_approaching'
        elif notification_type == 'token_cancelled':
            message = format_token_cancelled(
                customer_name=customer_name,
                token_number=token_data.get('token_number'),
                reason=token_data.get('cancellation_reason')
            )
            whatsapp_setting_key = 'whatsapp_booking_cancelled'
        elif notification_type == 'token_rescheduled':
            message = format_token_rescheduled(
                customer_name=customer_name,
                old_date=token_data.get('old_date', ''),
                new_date=token_data.get('date', ''),
                new_slot=token_data.get('time_slot', ''),
                token_number=token_data.get('token_number', 0)
            )
            whatsapp_setting_key = 'whatsapp_booking_rescheduled'
            if token_id and salon_id_for_links:
                action_links = build_action_links(token_id, salon_id_for_links)
        elif notification_type == 'token_skipped':
            message = format_token_cancelled(
                customer_name=customer_name,
                token_number=token_data.get('token_number'),
                reason="Skipped"
            )
            whatsapp_setting_key = 'whatsapp_booking_status_change'
        
        if message:
            # Check customer WhatsApp preference (default ON)
            if whatsapp_setting_key and not await should_send_customer_whatsapp(phone, whatsapp_setting_key):
                logger.info(f"WhatsApp notification suppressed for {phone} (setting {whatsapp_setting_key} is OFF)")
                return
            full_message = message + action_links if action_links else message
            result = await send_whatsapp_notification(phone, full_message, notification_type)
            logger.info(f"Notification sent: {notification_type} to {phone}, status: {result.get('status')}")
            
    except Exception as e:
        logger.error(f"Failed to send notification {notification_type}: {str(e)}")

async def check_and_notify_nearby_tokens(salon_id: str, barber_id: str, date: str, current_token_number: str):
    """Check and notify customers who are 3, 2 or 1 tokens away in THIS barber's queue (in-app + WhatsApp).

    Note: With salon-wide token numbering, 'tokens_away' is computed by barber-queue FIFO position
    (waiting + called), NOT by raw numeric token sequence.
    """
    try:
        waiting_tokens = await db.tokens.find(
            {"salon_id": salon_id, "barber_id": barber_id, "date": date, "status": "waiting"},
            {"_id": 0}
        ).sort("created_at", 1).to_list(100)

        for idx, token in enumerate(waiting_tokens):
            # Position in barber's queue (1-indexed), where 1 is "next up"
            # idx==0 means next in line → 1 away, idx==1 → 2 away, idx==2 → 3 away
            tokens_away = idx + 1
            phone = token.get('phone')
            token_number = token.get('token_number')

            if tokens_away not in (3, 2, 1) or not phone:
                continue

            notified_field = f"notified_{tokens_away}_away"
            if token.get(notified_field):
                continue

            # Message text matches PRD
            if tokens_away == 1:
                title = "Please proceed to the salon chair"
                msg_body = "Please proceed to the salon chair. You're up next."
            elif tokens_away == 2:
                title = "Your turn is coming soon"
                msg_body = "Your turn is coming soon. Please be ready."
            else:
                title = "You're 3 customers away"
                msg_body = f"You are 3 customers away. Your token {token_number} will be called shortly."

            await create_in_app_notification(
                user_type="customer",
                user_id=phone,
                title=title,
                message=msg_body,
                notification_type=f"turn_{tokens_away}_away",
                setting_key="turn_approaching",
                salon_id=salon_id,
                related_id=token.get('id', ''),
            )

            if await should_send_customer_whatsapp(phone, 'whatsapp_turn_approaching'):
                message = format_token_near(
                    customer_name=token.get('customer_name'),
                    user_token=token_number,
                    tokens_away=tokens_away
                )
                action_links = build_action_links(token.get('id', ''), salon_id) if tokens_away >= 2 else ""
                full_message = (message + action_links) if action_links else message
                await send_whatsapp_notification(phone, full_message, f'token_{tokens_away}_away')

            await db.tokens.update_one(
                {"id": token.get('id')},
                {"$set": {notified_field: True}}
            )
            logger.info(f"Notified token #{token_number} ({tokens_away} away) via barber queue position")

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
            "phone": "+917503070727",
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

@api_router.get("/salons/{salon_id}/operational-hours")
async def get_operational_hours(salon_id: str):
    """Get operational hours for a salon"""
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Return default if not set
    if not salon.get("operational_hours"):
        default_hours = OperationalHours().model_dump()
        return {"operational_hours": default_hours, "manual_toggle": {"is_overridden": False, "is_open": True, "overridden_at": None}}
    
    return {
        "operational_hours": salon.get("operational_hours", OperationalHours().model_dump()),
        "manual_toggle": salon.get("manual_toggle", {"is_overridden": False, "is_open": True, "overridden_at": None})
    }

@api_router.put("/salons/{salon_id}/operational-hours")
async def update_operational_hours(salon_id: str, hours: OperationalHours, current_salon=Depends(get_current_salon)):
    """Update operational hours for a salon"""
    existing = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Verify ownership (JWT payload uses "sub" for salon ID)
    salon_id_from_token = current_salon.get("sub") or current_salon.get("id")
    if salon_id_from_token != salon_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    await db.salons.update_one(
        {"id": salon_id},
        {"$set": {"operational_hours": hours.model_dump()}}
    )
    
    return {"message": "Operational hours updated successfully", "operational_hours": hours.model_dump()}

@api_router.put("/salons/{salon_id}/manual-toggle")
async def update_manual_toggle(salon_id: str, toggle_data: dict, current_salon=Depends(get_current_salon)):
    """Toggle salon open/close manually"""
    existing = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not existing:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Verify ownership (JWT payload uses "sub" for salon ID)
    salon_id_from_token = current_salon.get("sub") or current_salon.get("id")
    if salon_id_from_token != salon_id:
        raise HTTPException(status_code=403, detail="Unauthorized")
    
    is_overridden = toggle_data.get("is_overridden", True)
    is_open = toggle_data.get("is_open", True)
    
    manual_toggle = {
        "is_overridden": is_overridden,
        "is_open": is_open,
        "overridden_at": datetime.now(timezone.utc).isoformat() if is_overridden else None
    }
    
    await db.salons.update_one(
        {"id": salon_id},
        {"$set": {"manual_toggle": manual_toggle}}
    )
    
    return {"message": f"Salon manually {'opened' if is_open else 'closed'}" if is_overridden else "Manual override cleared", "manual_toggle": manual_toggle}

@api_router.get("/salons/{salon_id}/is-accepting-bookings")
async def check_booking_availability(salon_id: str):
    """Check if salon is accepting bookings based on operational hours and holidays"""
    salon = await db.salons.find_one({"id": salon_id}, {"_id": 0})
    if not salon:
        raise HTTPException(status_code=404, detail="Salon not found")
    
    # Check manual toggle first and auto-clear if day has changed
    manual_toggle = salon.get("manual_toggle", {})
    if manual_toggle.get("is_overridden"):
        # Auto-clear override if day has changed
        overridden_at = manual_toggle.get("overridden_at")
        if overridden_at:
            overridden_date = datetime.fromisoformat(overridden_at).date()
            current_date = datetime.now(timezone.utc).date()
            if overridden_date < current_date:
                # Day has changed, clear the override
                await db.salons.update_one(
                    {"id": salon_id},
                    {"$set": {"manual_toggle": {"is_overridden": False, "is_open": True, "overridden_at": None}}}
                )
                manual_toggle = {"is_overridden": False, "is_open": True, "overridden_at": None}
        
        # If still overridden, return manual status
        if manual_toggle.get("is_overridden"):
            return {
                "is_accepting_bookings": manual_toggle.get("is_open", True),
                "reason": "manual_override",
                "message": f"Salon is manually {'open' if manual_toggle.get('is_open') else 'closed'}"
            }
    
    # Check operational hours
    operational_hours = salon.get("operational_hours")
    if not operational_hours:
        # Default: always open
        return {"is_accepting_bookings": True, "reason": "default", "message": "Salon is open"}
    
    # Get current day
    current_day = datetime.now(timezone.utc).strftime('%A').lower()
    day_hours = operational_hours.get(current_day)
    
    if not day_hours:
        return {"is_accepting_bookings": True, "reason": "no_config", "message": "Salon is open"}
    
    # Check if today is a holiday
    if day_hours.get("is_holiday"):
        return {"is_accepting_bookings": False, "reason": "holiday", "message": "Salon is closed (Holiday)"}
    
    # Salon is open (we don't block during lunch as per requirements)
    return {"is_accepting_bookings": True, "reason": "operational_hours", "message": "Salon is open"}


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
    
    # Upsert: ensure a single entry per (salon_id, service_id).
    # Clean up any pre-existing duplicates first.
    await db.salon_services.delete_many({
        "salon_id": salon_id,
        "service_id": service_id
    })
    await db.salon_services.insert_one({
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "service_id": service_id,
        "is_enabled": is_enabled,
        "created_at": datetime.now(timezone.utc).isoformat(),
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
    """Get all unique service categories with thumbnails"""
    services = await db.services.find({"is_active": True}, {"_id": 0, "category": 1, "thumbnail_url": 1}).to_list(1000)
    
    # Group by category and get first thumbnail for each
    category_thumbnails = {}
    for s in services:
        cat = s.get("category", "General")
        if cat not in category_thumbnails:
            category_thumbnails[cat] = s.get("thumbnail_url")
    
    # Default thumbnails for categories without one
    default_thumbnails = {
        "Hair Treatments": "https://images.unsplash.com/photo-1593702275687-f8b402bf1fb5?w=200&h=200&fit=crop",
        "Massage & Spa": "https://images.unsplash.com/photo-1639162906614-0603b0ae95fd?w=200&h=200&fit=crop",
        "Men's Grooming": "https://images.unsplash.com/photo-1700760934268-8aa0ef52ce0a?w=200&h=200&fit=crop",
        "Manicure & Pedicure": "https://images.unsplash.com/photo-1632345031435-8727f6897d53?w=200&h=200&fit=crop",
        "Waxing & Threading": "https://images.pexels.com/photos/16120497/pexels-photo-16120497.jpeg?w=200&h=200&fit=crop",
        "General": "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=200&h=200&fit=crop",
        "Packages": "https://images.unsplash.com/photo-1633681926035-ec1ac984418a?w=200&h=200&fit=crop",
        "Facial": "https://images.pexels.com/photos/16120497/pexels-photo-16120497.jpeg?w=200&h=200&fit=crop",
        "Favorites": "https://images.unsplash.com/photo-1634449571010-02389ed0f9b0?w=200&h=200&fit=crop"
    }
    
    categories = []
    for cat in sorted(category_thumbnails.keys()):
        categories.append({
            "name": cat,
            "thumbnail_url": category_thumbnails[cat] or default_thumbnails.get(cat, default_thumbnails["General"])
        })
    
    return {"categories": categories}

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
        "can_access_financials": False,
        "can_delete_salon": False
    })
    # Ensure newly added keys default to False if missing on legacy records
    permissions.setdefault("can_access_financials", False)
    permissions.setdefault("can_access_analytics", False)
    permissions.setdefault("can_edit_salon", False)
    permissions.setdefault("can_delete_salon", False)
    
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
            "can_access_financials": False,
            "can_delete_salon": False
        }
    else:
        permissions = user_data.permissions.dict() if user_data.permissions else {
            "can_edit_salon": False,
            "can_access_analytics": False,
            "can_access_financials": False,
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


@api_router.get("/users/by-phone/{phone}", response_model=User)
async def get_user_by_phone(phone: str):
    """Get a customer's profile by phone."""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return User(**user)


@api_router.put("/users/by-phone/{phone}", response_model=User)
async def update_user_profile(phone: str, payload: UserProfileUpdate):
    """Update a customer's profile fields (name, gender, dob, email, address, city, pincode)."""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    update_dict = {k: v for k, v in payload.model_dump(exclude_unset=True).items() if v is not None}
    if update_dict:
        await db.users.update_one({"phone": phone}, {"$set": update_dict})
        user.update(update_dict)
    return User(**user)


# ============ CUSTOMER OTP VERIFICATION ============

@api_router.post("/customer/send-otp")
async def send_customer_otp(request: CustomerOTPRequest):
    """Send OTP to customer phone number via WhatsApp for verification"""
    phone = request.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    if len(phone) != 13:
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    logger.info(f"Customer OTP request for phone: {phone}")
    
    # Check if user exists
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found. Please login first.")
    
    # Generate OTP
    otp = generate_otp()
    logger.info(f"Generated OTP for customer {phone}: {otp}")
    
    # Store OTP in database
    await db.customer_otp.delete_many({"phone": phone})
    await db.customer_otp.insert_one({
        "phone": phone,
        "otp": otp,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "expires_at": (datetime.now(timezone.utc) + timedelta(minutes=10)).isoformat()
    })
    
    logger.info(f"OTP stored in database for customer {phone}")
    
    # Send OTP via WhatsApp
    whatsapp_result = await send_whatsapp_otp(phone, otp)
    
    response = {
        "success": True,
        "message": "OTP sent successfully via WhatsApp",
        "phone": phone
    }
    
    # Include OTP in response for testing (mock mode or failed delivery)
    if whatsapp_result.get("mock") or not whatsapp_result.get("success"):
        response['otp'] = otp
        if whatsapp_result.get("mock"):
            response['note'] = "⚠️ Twilio not configured - OTP shown for testing"
            logger.warning(f"Mock OTP for customer {phone}: {otp}")
        else:
            response['note'] = "OTP included because WhatsApp delivery failed"
    else:
        logger.info(f"✅ OTP sent via WhatsApp to customer {phone}")
    
    return response


@api_router.post("/customer/verify-otp")
async def verify_customer_otp(request: CustomerOTPVerify):
    """Verify customer OTP and mark user as OTP verified"""
    phone = request.phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    if len(phone) != 13:
        raise HTTPException(status_code=400, detail="Invalid phone number format")
    
    # Get stored OTP
    stored = await db.customer_otp.find_one({"phone": phone})
    if not stored:
        raise HTTPException(status_code=400, detail="No OTP found. Please request a new OTP.")
    
    # Check if OTP has expired
    expires_at = datetime.fromisoformat(stored["expires_at"].replace("Z", "+00:00"))
    if datetime.now(timezone.utc) > expires_at:
        await db.customer_otp.delete_many({"phone": phone})
        raise HTTPException(status_code=400, detail="OTP has expired. Please request a new OTP.")
    
    # Verify OTP
    if stored["otp"] != request.otp:
        raise HTTPException(status_code=400, detail="Invalid OTP")
    
    # OTP is valid - delete it and mark user as verified
    await db.customer_otp.delete_many({"phone": phone})
    
    # Update user to mark as OTP verified
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    await db.users.update_one(
        {"phone": phone},
        {"$set": {
            "is_otp_verified": True,
            "otp_verified_at": datetime.now(timezone.utc).isoformat()
        }}
    )
    
    user["is_otp_verified"] = True
    user["otp_verified_at"] = datetime.now(timezone.utc).isoformat()
    
    logger.info(f"Customer {phone} OTP verified successfully")
    
    return {
        "success": True,
        "message": "OTP verified successfully",
        "user": User(**user)
    }


@api_router.get("/customer/{phone}/otp-status")
async def get_customer_otp_status(phone: str):
    """Check if customer is OTP verified"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    user = await db.users.find_one({"phone": phone}, {"_id": 0})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    return {
        "phone": phone,
        "is_otp_verified": user.get("is_otp_verified", False),
        "otp_verified_at": user.get("otp_verified_at")
    }

@api_router.get("/salons/{salon_id}/customers")
async def get_salon_customers(salon_id: str, current_user=Depends(get_current_salon_user)):
    """Get all customers who have booked at this salon + manually added"""
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
    
    # Also include manually added customers
    manual_customers = await db.salon_customers.find(
        {"salon_id": salon_id}, {"_id": 0}
    ).to_list(10000)
    
    for mc in manual_customers:
        phone = mc.get('phone')
        if phone and phone not in customers_map:
            customers_map[phone] = {
                "phone": phone,
                "name": mc.get('name'),
                "user_id": None,
                "gender": mc.get('gender', 'Men'),
                "source": "manual"
            }
        elif phone and phone in customers_map:
            # Update gender if not set from booking
            if not customers_map[phone].get('gender'):
                customers_map[phone]['gender'] = mc.get('gender', 'Men')
    
    return {"customers": list(customers_map.values())}

@api_router.post("/salons/{salon_id}/customers")
async def add_salon_customer(salon_id: str, body: dict, current_user=Depends(get_current_salon_user)):
    """Manually add a customer to the salon"""
    name = body.get("name", "").strip()
    phone = body.get("phone", "").strip()
    gender = body.get("gender", "Men")
    
    if not name:
        raise HTTPException(status_code=400, detail="Customer name is required")
    
    if phone:
        # Normalize phone
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+91"):
            phone = f"+91{phone}"
        
        # Check if already exists
        existing = await db.salon_customers.find_one({
            "salon_id": salon_id,
            "phone": phone
        })
        if existing:
            # Update name/gender
            await db.salon_customers.update_one(
                {"id": existing["id"]},
                {"$set": {"name": name, "gender": gender}}
            )
            return {"message": "Customer updated", "customer": {
                "id": existing["id"], "name": name, "phone": phone, "gender": gender
            }}
    
    customer = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "name": name,
        "phone": phone or None,
        "gender": gender,
        "created_at": datetime.now(timezone.utc).isoformat(),
        "source": "manual"
    }
    
    await db.salon_customers.insert_one(customer)
    customer.pop("_id", None)
    
    return {"message": "Customer added", "customer": customer}

@api_router.post("/salons/{salon_id}/salon-booking")
async def create_salon_booking(salon_id: str, body: dict, current_user=Depends(get_current_salon_user)):
    """Create a booking from the salon side (walk-in, phone call, etc.)"""
    customer_name = body.get("customer_name", "Walk-in").strip()
    phone = body.get("phone", "").strip()
    gender = body.get("gender", "Men")
    barber_id = body.get("barber_id", "any")
    selected_services = body.get("selected_services", [])
    shift = body.get("shift", "")
    date = body.get("date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    payment_mode = body.get("payment_mode")
    
    if not customer_name:
        customer_name = "Walk-in"
    
    # Normalize phone
    if phone:
        phone = phone.replace(" ", "").replace("-", "")
        if not phone.startswith("+91"):
            phone = f"+91{phone}"
    
    # Auto-detect current shift if not provided
    if not shift:
        from datetime import datetime as dt
        now = dt.now()
        hour = now.hour
        if hour < 12:
            shift = "Morning"
        elif hour < 16:
            shift = "Noon"
        else:
            shift = "Evening"
    
    # Calculate total
    total_amount = 0
    for service_id in selected_services:
        if barber_id and barber_id != "any":
            # Check barber-specific pricing
            barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
            if barber:
                barber_service = next((s for s in (barber.get("services") or []) if s.get("service_id") == service_id), None)
                if barber_service:
                    total_amount += barber_service.get("price", 0)
                    continue
        # Fallback to base price
        service = await db.services.find_one({"id": service_id}, {"_id": 0})
        if service:
            total_amount += service.get("base_price", 0)
    
    # Get token number
    token_number = await get_next_token_number(salon_id, barber_id, date, shift)
    
    # Get barber name
    barber_name = "Any Available"
    if barber_id and barber_id != "any":
        barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0})
        if barber:
            barber_name = barber.get("name", "Unknown")
    
    token_dict = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "token_number": token_number,
        "customer_name": customer_name,
        "phone": phone or "",
        "user_id": "",
        "barber_id": barber_id,
        "barber_name": barber_name,
        "selected_services": selected_services,
        "date": date,
        "shift": shift,
        "time_slot": shift,
        "total_amount": total_amount,
        "status": "waiting",
        "payment_status": "pending",
        "payment_mode": payment_mode,
        "payment_confirmed": False,
        "source": "salon",
        "booking_type": "instant",
        "booking_for_self": True,
        "customer_gender": gender,
        "recall_count": 0,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.tokens.insert_one(token_dict)
    token_dict.pop("_id", None)
    
    # Also save customer if phone provided
    if phone:
        existing_customer = await db.salon_customers.find_one({
            "salon_id": salon_id, "phone": phone
        })
        if not existing_customer:
            await db.salon_customers.insert_one({
                "id": str(uuid.uuid4()),
                "salon_id": salon_id,
                "name": customer_name,
                "phone": phone,
                "gender": gender,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "source": "salon_booking"
            })
    
    await broadcast_update("new_token", token_dict)
    
    return token_dict

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
    # Color-tier badge (shown to customer as a colored badge)
    tier: Optional[str] = "Custom"  # one of: Diamond, Gold, Silver, Custom
    color: Optional[str] = None  # hex color override, optional

class MembershipPlan(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    name: str
    amount: float
    credit: float
    validity_months: int
    terms_conditions: str
    tier: Optional[str] = "Custom"
    color: Optional[str] = None
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
    tier: Optional[str] = "Custom"
    color: Optional[str] = None
    payment_mode: str
    paid_amount: float
    credit_added: float
    wallet_balance: float
    expiry_date: str
    is_active: bool = True
    cancelled: Optional[bool] = False
    cancelled_at: Optional[str] = None
    cancel_reason: Optional[str] = None
    notified_1m_expiry: Optional[bool] = False
    notified_1w_expiry: Optional[bool] = False
    payment_confirmed: bool = True  # False for customer purchases until salon confirms
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

    # Notify customer (in-app) about new custom package
    customer_phone = package_dict.get("customer_phone", "")
    if customer_phone:
        await create_in_app_notification(
            user_type="customer",
            user_id=customer_phone,
            title="Special Package Created for You",
            message=f"A custom package '{package_dict.get('name','Package')}' has been created for you. Check it out in your packages.",
            notification_type="custom_package",
            setting_key="custom_package",
            salon_id=salon_id,
            related_id=package_dict["id"],
        )

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


@api_router.put("/salons/{salon_id}/customer-packages/{package_id}")
async def update_customer_package(
    salon_id: str,
    package_id: str,
    package_data: dict,
    current_user=Depends(get_current_salon_user)
):
    """Update a custom customer package"""
    await db.customer_packages.update_one(
        {"id": package_id, "salon_id": salon_id},
        {"$set": package_data}
    )
    return {"message": "Package updated successfully"}

@api_router.delete("/salons/{salon_id}/customer-packages/{package_id}")
async def delete_customer_package(
    salon_id: str,
    package_id: str,
    current_user=Depends(get_current_salon_user)
):
    """Delete a custom customer package"""
    result = await db.customer_packages.delete_one({"id": package_id, "salon_id": salon_id})
    if result.deleted_count == 0:
        raise HTTPException(status_code=404, detail="Package not found")
    return {"message": "Package deleted successfully"}


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
            "tier": plan.tier or existing.get("tier", "Custom"),
            "color": plan.color or existing.get("color"),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }}
    )

    updated = await db.membership_plans.find_one({"id": plan_id}, {"_id": 0})
    return MembershipPlan(**updated)

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

@api_router.post("/salons/{salon_id}/customer-memberships/{membership_id}/cancel")
async def cancel_customer_membership(
    salon_id: str,
    membership_id: str,
    body: Optional[dict] = None,
    current_user=Depends(get_current_salon_user),
):
    """Soft-cancel a sold membership.

    Sets is_active=False, cancelled=True, cancelled_at=now, and stores an optional
    cancel_reason. The record is preserved for audit. Customer is notified.
    """
    body = body or {}
    reason = (body.get("reason") or "").strip() or "Cancelled by salon"

    m = await db.customer_memberships.find_one({"id": membership_id, "salon_id": salon_id}, {"_id": 0})
    if not m:
        raise HTTPException(status_code=404, detail="Membership not found")
    if m.get("cancelled") or not m.get("is_active", True):
        return {"message": "Membership already cancelled"}

    now_iso = datetime.now(timezone.utc).isoformat()
    await db.customer_memberships.update_one(
        {"id": membership_id},
        {"$set": {
            "is_active": False,
            "cancelled": True,
            "cancelled_at": now_iso,
            "cancel_reason": reason,
        }}
    )

    # Notify customer
    try:
        if m.get("customer_phone"):
            await create_in_app_notification(
                user_type="customer",
                user_id=m["customer_phone"],
                title="Membership Cancelled",
                message=f"Your '{m.get('membership_name','')}' membership has been cancelled by the salon. Reason: {reason}",
                notification_type="membership_cancelled",
                setting_key="membership_added",
                salon_id=salon_id,
                related_id=membership_id,
            )
    except Exception as e:
        logger.error(f"Failed membership cancellation notification: {e}")

    return {"message": "Membership cancelled", "membership_id": membership_id}

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

@api_router.get("/salons/{salon_id}/customers/{phone}/bookings-public")
async def get_customer_bookings_public(salon_id: str, phone: str):
    """Get customer's booking history (no auth required)"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    bookings = await db.tokens.find({
        "salon_id": salon_id,
        "phone": phone
    }, {"_id": 0}).sort("created_at", -1).limit(20).to_list(20)
    
    return {"bookings": bookings}

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
                "expiry_date": expiry_date.isoformat(),
                "tier": plan.get("tier", existing.get("tier", "Custom")),
                "color": plan.get("color") or existing.get("color"),
                # Reset expiry-warning flags on renewal
                "notified_1m_expiry": False,
                "notified_1w_expiry": False,
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
            "tier": plan.get("tier", "Custom"),
            "color": plan.get("color"),
            "payment_mode": membership.payment_mode,
            "paid_amount": membership.paid_amount,
            "credit_added": plan["credit"],
            "wallet_balance": plan["credit"],
            "expiry_date": expiry_date.isoformat(),
            "is_active": True,
            "cancelled": False,
            "notified_1m_expiry": False,
            "notified_1w_expiry": False,
            "payment_confirmed": True,  # Salon-side sells are auto-confirmed
            "purchased_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.customer_memberships.insert_one(membership_data)
        # FastAPI can't serialize ObjectId; strip it after insert.
        membership_data.pop("_id", None)
        
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
        
        # Record financial transaction for salon-side sell (auto-confirmed)
        if membership.payment_mode != "wallet":
            await db.financial_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "salon_id": salon_id,
                "type": "inflow",
                "category": "membership_payment",
                "amount": float(membership.paid_amount),
                "payment_mode": membership.payment_mode,
                "narration": f"Membership sold: {plan['name']} - {membership.customer_name}",
                "reference_id": membership_data["id"],
                "reference_type": "membership",
                "created_by": "system",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "created_at": datetime.now(timezone.utc).isoformat()
            })

        # Notify customer (in-app + WhatsApp)
        await create_in_app_notification(
            user_type="customer",
            user_id=phone,
            title="Membership Added",
            message=f"You have been enrolled in {plan['name']} membership. Wallet credit: ₹{plan['credit']}.",
            notification_type="membership_added",
            setting_key="membership_added",
            salon_id=salon_id,
            related_id=membership_data["id"],
        )
        if await should_send_customer_whatsapp(phone, "whatsapp_membership_added"):
            wa_msg = (
                f"🎉 *Membership Added!*\n\nHello {membership.customer_name},\n\n"
                f"You have been enrolled in *{plan['name']}* membership.\n"
                f"💳 Wallet Credit: ₹{plan['credit']}\n"
                f"📅 Valid for: {plan['validity_months']} months\n\n_SalonHub_"
            )
            await send_whatsapp_notification(phone, wa_msg, "membership_added")

        return {"message": "Membership created", "membership": membership_data}

@api_router.post("/salons/{salon_id}/customers/{phone}/buy-membership")
async def customer_buy_membership(
    salon_id: str, 
    phone: str,
    membership: CustomerMembershipCreate
):
    """Customer-facing endpoint to buy membership (no auth required).
    Credit is NOT added until salon confirms payment."""
    # Get membership plan
    plan = await db.membership_plans.find_one({"id": membership.membership_plan_id}, {"_id": 0})
    if not plan:
        raise HTTPException(status_code=404, detail="Membership plan not found")
    
    # Format phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Calculate expiry date
    expiry_date = datetime.now(timezone.utc) + timedelta(days=plan["validity_months"] * 30)
    
    # Create new membership with payment_confirmed=False
    # Credit will be added after salon confirms payment
    membership_data = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "customer_phone": phone,
        "customer_name": membership.customer_name,
        "membership_plan_id": plan["id"],
        "membership_name": plan["name"],
        "tier": plan.get("tier", "Custom"),
        "color": plan.get("color"),
        "payment_mode": membership.payment_mode,
        "paid_amount": membership.paid_amount,
        "credit_added": plan["credit"],
        "wallet_balance": 0,  # No credit until confirmed
        "expiry_date": expiry_date.isoformat(),
        "is_active": True,
        "cancelled": False,
        "notified_1m_expiry": False,
        "notified_1w_expiry": False,
        "payment_confirmed": False,  # Requires salon confirmation
        "purchased_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.customer_memberships.insert_one(membership_data)
    membership_data.pop("_id", None)

    # Create notification for salon about pending membership confirmation
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_type": "salon",
        "user_id": salon_id,
        "salon_id": salon_id,
        "title": "New Membership Purchase - Confirmation Required",
        "message": f"{membership.customer_name} ({phone}) purchased {plan['name']} membership for ₹{membership.paid_amount}. Please confirm payment.",
        "type": "membership_pending",
        "related_id": membership_data["id"],
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create notification for customer about pending confirmation
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_type": "customer",
        "user_id": phone,
        "salon_id": salon_id,
        "title": "Membership Purchase - Pending Confirmation",
        "message": f"Your {plan['name']} membership purchase is pending confirmation by the salon. Wallet credit of ₹{plan['credit']} will be added after confirmation.",
        "type": "membership_pending",
        "related_id": membership_data["id"],
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    return {
        "message": "Membership purchase submitted. Pending salon confirmation.",
        "membership": membership_data,
        "pending_confirmation": True
    }


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
    
    # Get confirmed active membership
    membership = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True,
        "payment_confirmed": True
    }, {"_id": 0})
    
    # Also check for pending (unconfirmed) memberships
    pending_memberships = await db.customer_memberships.find({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True,
        "payment_confirmed": False
    }, {"_id": 0}).to_list(10)
    
    if not membership and not pending_memberships:
        return {"has_membership": False, "wallet_balance": 0, "pending_memberships": []}
    
    if membership:
        # Check if expired
        expiry_date = datetime.fromisoformat(membership["expiry_date"])
        if expiry_date < datetime.now(timezone.utc):
            await db.customer_memberships.update_one(
                {"id": membership["id"]},
                {"$set": {"is_active": False, "wallet_balance": 0}}
            )
            return {"has_membership": False, "wallet_balance": 0, "expired": True, "pending_memberships": pending_memberships}
        
        return {"has_membership": True, **membership, "pending_memberships": pending_memberships}
    
    return {"has_membership": False, "wallet_balance": 0, "pending_memberships": pending_memberships}

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

@api_router.put("/salons/{salon_id}/customers/{phone}/wallet-balance")
async def update_wallet_balance(
    salon_id: str,
    phone: str,
    body: dict,
    current_user=Depends(get_current_salon_user)
):
    """Admin endpoint to manually adjust customer wallet balance"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    new_balance = body.get("wallet_balance")
    reason = body.get("reason", "Manual adjustment by admin")
    
    if new_balance is None or new_balance < 0:
        raise HTTPException(status_code=400, detail="Invalid wallet balance")
    
    membership = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="No active membership found")
    
    old_balance = membership["wallet_balance"]
    diff = new_balance - old_balance
    
    # Update balance
    await db.customer_memberships.update_one(
        {"id": membership["id"]},
        {"$set": {"wallet_balance": new_balance}}
    )
    
    # Record transaction for audit
    if diff != 0:
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": phone,
            "salon_id": salon_id,
            "transaction_type": "credit" if diff > 0 else "debit",
            "amount": abs(diff),
            "balance_after": new_balance,
            "description": reason,
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {"message": "Wallet balance updated", "old_balance": old_balance, "new_balance": new_balance}

@api_router.get("/salons/{salon_id}/customers/{phone}/combined-history")
async def get_customer_combined_history(salon_id: str, phone: str):
    """Get combined booking + wallet transaction history for a customer"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Fetch bookings
    bookings = await db.tokens.find({
        "salon_id": salon_id,
        "phone": phone
    }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    # Fetch wallet transactions
    transactions = await db.wallet_transactions.find({
        "salon_id": salon_id,
        "customer_phone": phone
    }, {"_id": 0}).sort("created_at", -1).limit(50).to_list(50)
    
    # Combine and tag
    combined = []
    for b in bookings:
        combined.append({
            **b,
            "history_type": "booking",
            "sort_date": b.get("created_at", "")
        })
    for t in transactions:
        combined.append({
            **t,
            "history_type": "transaction",
            "sort_date": t.get("created_at", "")
        })
    
    # Sort by date descending
    combined.sort(key=lambda x: x.get("sort_date", ""), reverse=True)
    
    return {"history": combined}

@api_router.get("/salons/{salon_id}/customers/{phone}/recent-services")
async def get_customer_recent_services(salon_id: str, phone: str):
    """Get recently used services by a customer at this salon"""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Get recent bookings with services (include all non-cancelled statuses)
    bookings = await db.tokens.find({
        "salon_id": salon_id,
        "phone": phone,
        "status": {"$nin": ["cancelled"]}
    }, {"_id": 0, "selected_services": 1, "created_at": 1}).sort("created_at", -1).limit(20).to_list(20)
    
    # Collect unique service IDs in order of recency
    seen = set()
    recent_service_ids = []
    for booking in bookings:
        for sid in (booking.get("selected_services") or []):
            if sid not in seen:
                seen.add(sid)
                recent_service_ids.append(sid)
    
    # Fetch service details (include even disabled ones for recent history)
    recent_services = []
    for sid in recent_service_ids[:15]:
        service = await db.services.find_one({"id": sid}, {"_id": 0})
        if service:
            recent_services.append(service)
    
    return {"recent_services": recent_services}

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


def _fmt_hour_label(h: int) -> str:
    """Convert 24h integer to '7 AM' / '4 PM' style label."""
    try:
        h = int(h)
    except Exception:
        return ""
    if h == 0:
        return "12 AM"
    if h == 12:
        return "12 PM"
    if h < 12:
        return f"{h} AM"
    return f"{h - 12} PM"


@api_router.get("/salons/{salon_id}/shift-windows")
async def get_salon_shift_windows_api(salon_id: str, date: Optional[str] = None):
    """Return shift windows for a salon on a given date computed from its operational_hours."""
    if not date:
        date = datetime.now(timezone.utc).date().isoformat()
    windows = await get_salon_shift_windows(salon_id, date)
    shifts = []
    for shift_id in ["Morning", "Noon", "Evening"]:
        w = windows.get(shift_id, {}) or {}
        start_h = w.get("start")
        end_h = w.get("end")
        duration_hours = w.get("duration_hours", 0) or 0
        start_label = _fmt_hour_label(start_h) if start_h is not None else ""
        end_label = _fmt_hour_label(end_h) if end_h is not None else ""
        time_label = f"{start_label} - {end_label}" if start_label and end_label else ""
        shifts.append({
            "id": shift_id,
            "name": shift_id,
            "start": start_h,
            "end": end_h,
            "time": time_label,
            "duration_hours": duration_hours,
            "duration_minutes": w.get("duration_minutes", 0),
            "is_available": bool(duration_hours and duration_hours > 0),
        })
    return {"date": date, "shifts": shifts}

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
    
    # Check booking limit: Max 2 active bookings per customer per day (1 for self + 1 for others)
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    active_bookings = await db.tokens.find({
        "phone": phone,
        "date": today,
        "status": {"$in": ["waiting", "in_service"]},
        "$or": [{"cancelled": False}, {"cancelled": {"$exists": False}}]
    }, {"_id": 0}).to_list(10)
    
    # Count bookings for self and others
    bookings_for_self = sum(1 for b in active_bookings if b.get("booking_for_self", True))
    bookings_for_others = len(active_bookings) - bookings_for_self
    
    # Enforce limits: max 1 for self + max 1 for others
    if booking.booking_for_self and bookings_for_self >= 1:
        raise HTTPException(
            status_code=400,
            detail="You already have an active booking for yourself today. Please complete or cancel it before booking again."
        )
    
    if not booking.booking_for_self and bookings_for_others >= 1:
        raise HTTPException(
            status_code=400,
            detail="You already have an active booking for someone else today. Maximum 2 bookings allowed per day (1 for self + 1 for others)."
        )
    
    if len(active_bookings) >= 2:
        raise HTTPException(
            status_code=400,
            detail="You have reached the maximum limit of 2 active bookings per day. Please complete or cancel an existing booking."
        )
    
    # Get barber details (with Fastest-Barber auto-assignment support)
    # Compute required blocked minutes for the 75% rule
    service_total_minutes = await calc_service_total_minutes(booking.selected_services)
    required_blocked = calc_blocked_minutes_from_total(service_total_minutes)

    if booking.barber_id == "any":
        # Fastest Barber Auto Assignment
        chosen = await pick_fastest_barber(
            salon_id=booking.salon_id,
            date=booking.date,
            shift=booking.shift,
            required_blocked_minutes=required_blocked,
            customer_gender=booking.customer_gender,
        )
        if not chosen:
            raise HTTPException(
                status_code=400,
                detail=f"All barbers are fully booked for {booking.shift} shift. Please choose another shift or date."
            )
        booking.barber_id = chosen["id"]
        barber_name = chosen["name"]
        barber = chosen
    else:
        barber = await db.barbers.find_one({"id": booking.barber_id}, {"_id": 0})
        if not barber:
            raise HTTPException(status_code=404, detail="Barber not found")
        barber_name = barber["name"]

        # 75% rule capacity check
        fit = await can_fit_in_barber_shift(
            salon_id=booking.salon_id,
            barber_id=booking.barber_id,
            date=booking.date,
            shift=booking.shift,
            new_blocked_minutes=required_blocked,
        )
        if not fit["allowed"]:
            raise HTTPException(
                status_code=400,
                detail=f"{barber_name}'s {booking.shift} shift is full. Please pick another barber or shift."
            )
    
    # Calculate total amount (barber is now always a real barber after fastest-barber assignment)
    total_amount = 0
    if booking.barber_id and booking.barber_id != "any":
        total_amount = await calculate_booking_total(booking.selected_services, booking.barber_id)
    # Fallback to base prices if nothing was found
    if total_amount == 0:
        for service_id in booking.selected_services:
            service = await db.services.find_one({"id": service_id}, {"_id": 0})
            if service:
                total_amount += service.get("base_price", 0)
    
    # Handle wallet payment
    payment_status = "pending"
    payment_mode = booking.payment_mode
    
    if payment_mode == "wallet":
        if not phone.startswith("+91"):
            wallet_phone = f"+91{phone}"
        else:
            wallet_phone = phone
        
        membership = await db.customer_memberships.find_one({
            "salon_id": booking.salon_id,
            "customer_phone": wallet_phone,
            "is_active": True
        }, {"_id": 0})
        
        if not membership:
            raise HTTPException(status_code=400, detail="No active wallet/membership found")
        
        if membership["wallet_balance"] < total_amount:
            raise HTTPException(
                status_code=400, 
                detail=f"Insufficient wallet balance. Available: ₹{membership['wallet_balance']}, Required: ₹{total_amount}"
            )
        
        # Deduct wallet balance
        new_balance = membership["wallet_balance"] - total_amount
        await db.customer_memberships.update_one(
            {"id": membership["id"]},
            {"$set": {"wallet_balance": new_balance}}
        )
        
        # Record wallet transaction
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": wallet_phone,
            "salon_id": booking.salon_id,
            "transaction_type": "debit",
            "amount": total_amount,
            "balance_after": new_balance,
            "description": f"Booking payment - {booking.shift} shift",
            "created_at": datetime.now(timezone.utc).isoformat()
        })
        
        payment_status = "paid"
    
    # Get GLOBAL (salon-wide) token number — salon+date+shift sequence
    token_number = await get_next_token_number(booking.salon_id, booking.date, booking.shift)

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
        # 75%-rule bookkeeping (stored for consistent capacity math)
        "total_service_minutes": service_total_minutes,
        "blocked_minutes": required_blocked,
        "status": "waiting" if booking.booking_type == "instant" else "future",
        "payment_status": payment_status,
        "payment_mode": payment_mode,
        "payment_confirmed": payment_mode == "wallet",  # Auto-confirm wallet payments
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
    
    # Notify salon (in-app) about new booking
    if token_dict.get("salon_id"):
        await create_in_app_notification(
            user_type="salon",
            user_id=token_dict["salon_id"],
            title="New Booking Received",
            message=f"{token_dict.get('customer_name','Customer')} booked Token #{token_dict.get('token_number','')} on {token_dict.get('date','')} ({token_dict.get('time_slot','')}).",
            notification_type="new_booking",
            setting_key="new_booking",
            salon_id=token_dict["salon_id"],
            related_id=token_dict.get("id", ""),
        )
    
    return token

# Slot availability endpoint
@api_router.get("/salons/{salon_id}/slot-availability")
async def get_slot_availability(
    salon_id: str, date: str, shift: str, service_ids: Optional[str] = None
):
    """Check per-barber capacity for a given date and shift using the 75%-rule.

    Query params:
      - service_ids (optional, comma-separated) — if provided, compute whether each barber
        can accommodate those specific services (more accurate display).
    """
    # Compute shift window for salon
    windows = await get_salon_shift_windows(salon_id, date)
    shift_info = windows.get(shift, {})
    capacity = int(shift_info.get("duration_minutes", 0))

    # Optional services → required blocked minutes
    required_blocked = 0
    if service_ids:
        sid_list = [s for s in service_ids.split(",") if s]
        total_mins = await calc_service_total_minutes(sid_list)
        required_blocked = calc_blocked_minutes_from_total(total_mins)

    # Find active barbers
    barbers = await db.barbers.find(
        {
            "salon_id": salon_id,
            "is_active": True,
            "$or": [{"on_leave": False}, {"on_leave": None}, {"on_leave": {"$exists": False}}],
        },
        {"_id": 0, "id": 1, "name": 1},
    ).to_list(100)

    result = []
    for barber in barbers:
        used = await get_barber_blocked_minutes_used(salon_id, barber["id"], date, shift)
        remaining = max(0, capacity - used)
        # If required_blocked specified, barber is full when it can't take this booking
        already_full = used >= capacity if capacity > 0 else True
        cant_fit_new = required_blocked > 0 and remaining <= 0
        is_full = already_full or cant_fit_new
        # count of live bookings (for display)
        count = await db.tokens.count_documents({
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": date,
            "shift": shift,
            "status": {"$nin": ["cancelled", "skipped"]},
        })
        result.append({
            "barber_id": barber["id"],
            "barber_name": barber["name"],
            "booked": count,
            "capacity_minutes": capacity,
            "used_minutes": used,
            "remaining_minutes": remaining,
            # "available" kept for backward compatibility: approximate slots left (remaining / avg 30 min service with 75% rule ≈ 22.5m)
            "available": max(0, int(remaining / 22)) if remaining > 0 else 0,
            "is_full": is_full,
        })

    all_full = all(b["is_full"] for b in result) if result else False

    return {
        "date": date,
        "shift": shift,
        "shift_window": shift_info,
        "capacity_minutes": capacity,
        "barbers": result,
        "all_slots_full": all_full,
        # Kept for backward compat but no longer the source of truth
        "max_per_slot": 10,
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
    
    # Get next waiting token (FIFO by creation time — lexicographic sort on M1,M2,M10 is unsafe)
    next_token = await db.tokens.find_one(
        {"salon_id": salon_id, "barber_id": barber_id, "date": date, "status": "waiting"},
        {"_id": 0},
        sort=[("created_at", 1)]
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
        
        # In-app notification for customer (your turn now)
        if next_token.get("phone"):
            await create_in_app_notification(
                user_type="customer",
                user_id=next_token["phone"],
                title="It's Your Turn!",
                message=f"Your token #{next_token.get('token_number','')} is being called. Please proceed to {next_token.get('barber_name','your barber')}.",
                notification_type="turn_now",
                setting_key="booking_status_change",
                salon_id=salon_id,
                related_id=next_token.get("id", ""),
            )
        
        # Check and notify tokens that are near (3, 2, 1 away)
        await check_and_notify_nearby_tokens(salon_id, barber_id, date, next_token["token_number"])
        
        return updated
    
    return {"message": "No more tokens in queue"}


@api_router.post("/tokens/{token_id}/complete")
async def complete_token(token_id: str, current_salon=Depends(get_current_salon)):
    """Manually mark token as completed and generate invoice"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Check if payment is confirmed
    if not token.get("payment_confirmed", False):
        raise HTTPException(
            status_code=400, 
            detail="Payment must be confirmed before marking as complete. Please confirm payment first."
        )
    
    # Mark as completed
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {"status": "completed", "completed_at": datetime.now(timezone.utc).isoformat()}}
    )

    # Notify customer of status change (in-app)
    if token.get("phone"):
        await create_in_app_notification(
            user_type="customer",
            user_id=token["phone"],
            title="Service Completed",
            message=f"Your service (Token #{token.get('token_number','')}) has been completed. Thank you!",
            notification_type="booking_completed",
            setting_key="booking_status_change",
            salon_id=token.get("salon_id", ""),
            related_id=token_id,
        )
    
    # Check and apply loyalty reward (only for non-wallet payments)
    loyalty_reward = None
    payment_mode = token.get("payment_mode", "cash")
    try:
        loyalty_reward = await check_and_apply_loyalty_reward(
            token["salon_id"], 
            token["phone"], 
            token.get("total_amount", 0),
            payment_mode
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

        # Recompute the barber's incentive payout for the booking month so the
        # Reward Plan dashboard always reflects the latest sales.
        try:
            barber_id = token.get("barber_id")
            # Tokens use `date` field (YYYY-MM-DD). Fall back to legacy `booking_date`
            # then to today's UTC date.
            tok_date = (
                token.get("date")
                or token.get("booking_date")
                or datetime.now(timezone.utc).strftime("%Y-%m-%d")
            )
            year_month = tok_date[:7]
            salon_id_for_token = token.get("salon_id")
            if barber_id and salon_id_for_token and year_month:
                await _recompute_incentive_payout(salon_id_for_token, barber_id, year_month)
        except Exception as e:
            logger.error(f"Incentive recompute failed for token {token_id}: {e}")

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
    """Cancel token and refund wallet if paid via wallet"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    # Refund wallet if payment was via wallet
    if token.get("payment_mode") == "wallet" and token.get("payment_status") == "paid":
        wallet_phone = token["phone"]
        if not wallet_phone.startswith("+91"):
            wallet_phone = f"+91{wallet_phone}"
        
        membership = await db.customer_memberships.find_one({
            "salon_id": token["salon_id"],
            "customer_phone": wallet_phone,
            "is_active": True
        }, {"_id": 0})
        
        if membership:
            refund_amount = token.get("total_amount", 0)
            new_balance = membership["wallet_balance"] + refund_amount
            
            await db.customer_memberships.update_one(
                {"id": membership["id"]},
                {"$set": {"wallet_balance": new_balance}}
            )
            
            # Record refund transaction
            await db.wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "customer_phone": wallet_phone,
                "salon_id": token["salon_id"],
                "transaction_type": "credit",
                "amount": refund_amount,
                "balance_after": new_balance,
                "description": f"Refund - Booking cancelled (Token {token['token_number']})",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    await db.tokens.update_one({"id": token_id}, {"$set": {"status": "cancelled"}})
    await broadcast_update("token_cancelled", {"token_id": token_id})
    
    # Send cancellation notification
    await send_booking_notification(token, 'token_cancelled')

    # Customer in-app notification
    if token.get("phone"):
        await create_in_app_notification(
            user_type="customer",
            user_id=token["phone"],
            title="Booking Cancelled",
            message=f"Your booking (Token #{token.get('token_number','')}) was cancelled by the salon.",
            notification_type="booking_cancelled",
            setting_key="booking_status_change",
            salon_id=token.get("salon_id", ""),
            related_id=token_id,
        )
    
    return {"message": "Token cancelled"}

@api_router.post("/tokens/{token_id}/customer-cancel")
async def customer_cancel_token(token_id: str):
    """Customer-facing cancel token and refund wallet if paid via wallet"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if token.get("status") in ["completed", "cancelled"]:
        raise HTTPException(status_code=400, detail="Cannot cancel this booking")
    
    # Refund wallet if payment was via wallet
    if token.get("payment_mode") == "wallet" and token.get("payment_status") == "paid":
        wallet_phone = token["phone"]
        if not wallet_phone.startswith("+91"):
            wallet_phone = f"+91{wallet_phone}"
        
        membership = await db.customer_memberships.find_one({
            "salon_id": token["salon_id"],
            "customer_phone": wallet_phone,
            "is_active": True
        }, {"_id": 0})
        
        if membership:
            refund_amount = token.get("total_amount", 0)
            new_balance = membership["wallet_balance"] + refund_amount
            
            await db.customer_memberships.update_one(
                {"id": membership["id"]},
                {"$set": {"wallet_balance": new_balance}}
            )
            
            await db.wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "customer_phone": wallet_phone,
                "salon_id": token["salon_id"],
                "transaction_type": "credit",
                "amount": refund_amount,
                "balance_after": new_balance,
                "description": f"Refund - Booking cancelled by customer (Token {token['token_number']})",
                "created_at": datetime.now(timezone.utc).isoformat()
            })
    
    await db.tokens.update_one({"id": token_id}, {"$set": {"status": "cancelled"}})
    await broadcast_update("token_cancelled", {"token_id": token_id})
    
    await send_booking_notification(token, 'token_cancelled')

    # Customer in-app notification
    if token.get("phone"):
        await create_in_app_notification(
            user_type="customer",
            user_id=token["phone"],
            title="Booking Cancelled",
            message=f"Your booking (Token #{token.get('token_number','')}) has been cancelled.",
            notification_type="booking_cancelled",
            setting_key="booking_status_change",
            salon_id=token.get("salon_id", ""),
            related_id=token_id,
        )
    # Salon in-app notification
    if token.get("salon_id"):
        await create_in_app_notification(
            user_type="salon",
            user_id=token["salon_id"],
            title="Booking Cancelled by Customer",
            message=f"{token.get('customer_name','Customer')} cancelled booking (Token #{token.get('token_number','')}).",
            notification_type="booking_cancelled",
            setting_key="booking_change",
            salon_id=token["salon_id"],
            related_id=token_id,
        )
    
    return {"message": "Booking cancelled successfully"}

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
    
    # Use final_amount override if provided by salon
    if request.final_amount is not None:
        total_amount = request.final_amount
    
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

@api_router.put("/tokens/{token_id}/update-amount")
async def update_token_amount(token_id: str, body: dict, current_salon=Depends(get_current_salon)):
    """Update final amount for a token (salon override)"""
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if token.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot modify completed booking")
    
    final_amount = body.get("final_amount")
    if final_amount is None:
        raise HTTPException(status_code=400, detail="final_amount is required")
    
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {"total_amount": float(final_amount)}}
    )
    
    updated_token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    await broadcast_update("token_updated", updated_token)
    
    return {"message": f"Amount updated to ₹{final_amount}", "token": TokenModel(**updated_token)}


@api_router.get("/salons/{salon_id}/customers/{phone}/wallet")
async def get_customer_wallet(salon_id: str, phone: str):
    """Return customer's active wallet balance with this salon.

    Wallet balance comes from two sources:
    1. Membership wallet (if customer has active membership)
    2. Loyalty wallet (independent of membership, from loyalty rewards)
    
    Returns combined balance for customer's usage.
    """
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    # Check for membership wallet
    membership = await db.customer_memberships.find_one(
        {"salon_id": salon_id, "customer_phone": phone, "is_active": True, "payment_confirmed": True},
        {"_id": 0, "id": 1, "wallet_balance": 1, "membership_name": 1, "tier": 1, "color": 1, "expiry_date": 1},
    )
    
    # Check for loyalty wallet (independent of membership)
    loyalty_wallet = await db.customer_wallets.find_one(
        {"salon_id": salon_id, "customer_phone": phone},
        {"_id": 0, "id": 1, "wallet_balance": 1}
    )
    
    membership_balance = float(membership.get("wallet_balance", 0)) if membership else 0.0
    loyalty_balance = float(loyalty_wallet.get("wallet_balance", 0)) if loyalty_wallet else 0.0
    total_balance = membership_balance + loyalty_balance
    
    if not membership and not loyalty_wallet:
        return {
            "has_membership": False,
            "has_loyalty_wallet": False,
            "wallet_balance": 0.0,
            "membership_balance": 0.0,
            "loyalty_balance": 0.0,
            "membership_id": None,
            "loyalty_wallet_id": None,
            "membership_name": None,
            "tier": None,
            "color": None,
            "expiry_date": None,
        }
    
    return {
        "has_membership": bool(membership),
        "has_loyalty_wallet": bool(loyalty_wallet),
        "wallet_balance": total_balance,
        "membership_balance": membership_balance,
        "loyalty_balance": loyalty_balance,
        "membership_id": membership.get("id") if membership else None,
        "loyalty_wallet_id": loyalty_wallet.get("id") if loyalty_wallet else None,
        "membership_name": membership.get("membership_name") if membership else None,
        "tier": membership.get("tier") if membership else None,
        "color": membership.get("color") if membership else None,
        "expiry_date": membership.get("expiry_date") if membership else None,
    }


@api_router.post("/tokens/{token_id}/confirm-payment")
async def confirm_token_payment(token_id: str, body: dict, current_salon=Depends(get_current_salon)):
    """Salon confirms payment for a token. Supports full wallet, full cash/upi, or split.

    Body shape:
      - payment_mode: "cash" | "upi" | "wallet" | "split" | "card"
      - wallet_amount (float, optional): portion paid from wallet (for "wallet" or "split")
      - cash_amount (float, optional): portion paid in cash (for "split")
      - upi_amount (float, optional): portion paid via UPI (for "split")

    Rules:
      - For "wallet", the customer's wallet_balance must be >= total_amount, else 400.
      - For "split", wallet_amount must be <= wallet_balance AND
        wallet_amount + cash_amount + upi_amount must equal total_amount (±1 tolerance).
      - Wallet deduction is recorded on `customer_memberships.wallet_balance` and logged
        in `wallet_transactions`. Cash/UPI portions are logged to `financial_transactions`.
    """
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    if token.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Token is already completed")

    already_confirmed = token.get("payment_confirmed", False)
    total_amount = float(token.get("total_amount", 0))
    payment_mode = (body.get("payment_mode") or token.get("payment_mode") or "cash").lower()

    wallet_amount = float(body.get("wallet_amount") or 0)
    cash_amount = float(body.get("cash_amount") or 0)
    upi_amount = float(body.get("upi_amount") or 0)

    # Backfill amounts from legacy body shapes when only payment_mode is provided
    if payment_mode == "wallet" and wallet_amount <= 0:
        wallet_amount = total_amount
    elif payment_mode == "cash" and cash_amount <= 0 and wallet_amount <= 0 and upi_amount <= 0:
        cash_amount = total_amount
    elif payment_mode == "upi" and upi_amount <= 0 and wallet_amount <= 0 and cash_amount <= 0:
        upi_amount = total_amount
    elif payment_mode == "card" and cash_amount <= 0 and upi_amount <= 0 and wallet_amount <= 0:
        # record card portion as cash bucket for now
        cash_amount = total_amount

    # Fetch wallet (active & confirmed membership only)
    salon_id = token.get("salon_id", "")
    phone = token.get("phone") or ""
    wallet_doc = None
    if phone:
        wallet_doc = await db.customer_memberships.find_one(
            {"salon_id": salon_id, "customer_phone": phone, "is_active": True, "payment_confirmed": True},
            {"_id": 0, "id": 1, "wallet_balance": 1, "membership_name": 1},
        )
    wallet_balance = float(wallet_doc["wallet_balance"]) if wallet_doc else 0.0

    # Validation
    if wallet_amount < 0 or cash_amount < 0 or upi_amount < 0:
        raise HTTPException(status_code=400, detail="Payment amounts cannot be negative")

    if wallet_amount > 0 and not wallet_doc:
        raise HTTPException(
            status_code=400,
            detail="Customer has no active wallet. Select cash or UPI instead.",
        )
    if wallet_amount > wallet_balance + 0.001:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Insufficient wallet balance. Available: ₹{wallet_balance:.2f}, "
                f"attempted to use: ₹{wallet_amount:.2f}. Please pay the remainder via cash/UPI."
            ),
        )

    total_paid = wallet_amount + cash_amount + upi_amount
    if abs(total_paid - total_amount) > 1.0:
        raise HTTPException(
            status_code=400,
            detail=(
                f"Payment total ₹{total_paid:.2f} does not match bill ₹{total_amount:.2f}. "
                f"Please adjust amounts."
            ),
        )

    # Determine effective payment_mode label
    modes_used = []
    if wallet_amount > 0:
        modes_used.append("wallet")
    if cash_amount > 0:
        modes_used.append("cash")
    if upi_amount > 0:
        modes_used.append("upi")
    if len(modes_used) == 1:
        effective_mode = modes_used[0]
    elif len(modes_used) > 1:
        effective_mode = "split"
    else:
        effective_mode = payment_mode or "cash"

    # Apply wallet deduction (first-time only)
    new_wallet_balance = wallet_balance
    if wallet_amount > 0 and not already_confirmed:
        new_wallet_balance = wallet_balance - wallet_amount
        await db.customer_memberships.update_one(
            {"id": wallet_doc["id"]},
            {"$set": {"wallet_balance": new_wallet_balance}},
        )
        await db.wallet_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "customer_phone": phone,
            "salon_id": salon_id,
            "transaction_type": "debit",
            "amount": wallet_amount,
            "balance_after": new_wallet_balance,
            "description": f"Service payment: Token {token.get('token_number','')} - {token.get('customer_name','')}",
            "reference_type": "token",
            "reference_id": token_id,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    # Update token
    update_data = {
        "payment_confirmed": True,
        "payment_status": "paid",
        "payment_mode": effective_mode,
        "payment_breakdown": {
            "wallet_amount": wallet_amount,
            "cash_amount": cash_amount,
            "upi_amount": upi_amount,
        },
    }
    await db.tokens.update_one({"id": token_id}, {"$set": update_data})
    updated_token = await db.tokens.find_one({"id": token_id}, {"_id": 0})

    # Customer notification
    if phone:
        breakdown_bits = []
        if wallet_amount > 0:
            breakdown_bits.append(f"₹{wallet_amount:.0f} wallet")
        if cash_amount > 0:
            breakdown_bits.append(f"₹{cash_amount:.0f} cash")
        if upi_amount > 0:
            breakdown_bits.append(f"₹{upi_amount:.0f} UPI")
        breakdown_str = " + ".join(breakdown_bits) if breakdown_bits else effective_mode
        await db.notifications.insert_one({
            "id": str(uuid.uuid4()),
            "user_type": "customer",
            "user_id": phone,
            "salon_id": salon_id,
            "title": "Payment Confirmed",
            "message": f"Payment of ₹{total_amount:.0f} for token {token.get('token_number','')} confirmed ({breakdown_str}).",
            "type": "payment_confirmed",
            "related_id": token_id,
            "is_read": False,
            "created_at": datetime.now(timezone.utc).isoformat(),
        })

    await broadcast_update("token_updated", updated_token)

    # Financial transactions — log each non-wallet portion
    if not already_confirmed:
        for mode_name, amt in (("cash", cash_amount), ("upi", upi_amount)):
            if amt > 0:
                await db.financial_transactions.insert_one({
                    "id": str(uuid.uuid4()),
                    "salon_id": salon_id,
                    "type": "inflow",
                    "category": "booking_payment",
                    "amount": float(amt),
                    "payment_mode": mode_name,
                    "narration": f"Booking {token.get('token_number','')} - {token.get('customer_name','')}"
                                + (" (split)" if effective_mode == "split" else ""),
                    "reference_id": token_id,
                    "reference_type": "token",
                    "created_by": "system",
                    "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                    "created_at": datetime.now(timezone.utc).isoformat(),
                })
    else:
        # Just update the payment_mode on existing financial transactions for this token
        await db.financial_transactions.update_many(
            {"reference_id": token_id, "reference_type": "token"},
            {"$set": {"payment_mode": effective_mode}},
        )
    
    return {
        "message": "Payment confirmed successfully",
        "token": TokenModel(**updated_token),
        "payment": {
            "mode": effective_mode,
            "wallet_amount": wallet_amount,
            "cash_amount": cash_amount,
            "upi_amount": upi_amount,
            "wallet_balance_after": new_wallet_balance,
        },
    }

@api_router.put("/tokens/{token_id}/change-barber")
async def change_token_barber(token_id: str, body: dict, current_salon=Depends(get_current_salon)):
    """Change the barber assigned to a token and recalculate total + capacity.

    Validations:
      - Target barber must have capacity for this token in the same shift (75% rule).
    Side effects:
      - Recalculates total_amount using new barber's pricing.
      - Sends customer notification: "Your service will now be provided by Barber X".
    """
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    if token.get("status") == "completed":
        raise HTTPException(status_code=400, detail="Cannot change barber for completed booking")
    
    new_barber_id = body.get("barber_id")
    if not new_barber_id:
        raise HTTPException(status_code=400, detail="barber_id is required")

    old_barber_id = token.get("barber_id")

    # Resolve new barber (supports auto-assign via "any")
    if new_barber_id == "any":
        # Use fastest-barber logic, passing this token's blocked minutes
        required_blocked = int(token.get("blocked_minutes") or 0)
        if required_blocked <= 0:
            required_blocked = calc_blocked_minutes_from_total(
                await calc_service_total_minutes(token.get("selected_services", []))
            )
        chosen = await pick_fastest_barber(
            salon_id=token["salon_id"],
            date=token["date"],
            shift=token.get("shift", "Morning"),
            required_blocked_minutes=required_blocked,
        )
        if not chosen:
            raise HTTPException(status_code=400, detail="No barber has capacity for this shift.")
        new_barber_id = chosen["id"]
        new_barber_name = chosen["name"]
    else:
        barber = await db.barbers.find_one({"id": new_barber_id}, {"_id": 0})
        if not barber:
            raise HTTPException(status_code=404, detail="Barber not found")
        new_barber_name = barber.get("name", "Unknown")

        # Capacity check (skip if same barber as before)
        if new_barber_id != old_barber_id:
            required_blocked = int(token.get("blocked_minutes") or 0)
            if required_blocked <= 0:
                required_blocked = calc_blocked_minutes_from_total(
                    await calc_service_total_minutes(token.get("selected_services", []))
                )
            fit = await can_fit_in_barber_shift(
                salon_id=token["salon_id"],
                barber_id=new_barber_id,
                date=token["date"],
                shift=token.get("shift", "Morning"),
                new_blocked_minutes=required_blocked,
            )
            if not fit["allowed"]:
                raise HTTPException(
                    status_code=400,
                    detail=f"{new_barber_name}'s shift is full. Please choose another barber."
                )

    # Recalculate total amount based on new barber's pricing
    selected_services = token.get("selected_services", [])
    total_amount = await calculate_booking_total(selected_services, new_barber_id)
    if total_amount == 0:
        for service_id in selected_services:
            service = await db.services.find_one({"id": service_id}, {"_id": 0})
            if service:
                total_amount += service.get("base_price", 0)

    # Update token — also RESET near-notification flags so the new barber's queue re-triggers them
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {
            "barber_id": new_barber_id,
            "barber_name": new_barber_name,
            "total_amount": total_amount,
            "notified_3_away": False,
            "notified_2_away": False,
            "notified_1_away": False,
        }}
    )

    # Get updated token
    updated_token = await db.tokens.find_one({"id": token_id}, {"_id": 0})

    await broadcast_update("token_updated", updated_token)

    # Notify customer of barber change
    try:
        if updated_token.get("phone") and new_barber_id != old_barber_id:
            await create_in_app_notification(
                user_type="customer",
                user_id=updated_token["phone"],
                title="Barber Changed",
                message=f"Your service will now be provided by Barber {new_barber_name}.",
                notification_type="barber_changed",
                setting_key="booking_status_change",
                salon_id=updated_token.get("salon_id", ""),
                related_id=token_id,
            )
    except Exception as e:
        logger.error(f"Failed to send barber-change notification: {e}")

    return {
        "message": f"Barber changed to {new_barber_name}. Total recalculated: ₹{total_amount}",
        "token": TokenModel(**updated_token)
    }

# ============ MEMBERSHIP PAYMENT CONFIRMATION ============

@api_router.post("/salons/{salon_id}/memberships/{membership_id}/confirm-payment")
async def confirm_membership_payment(salon_id: str, membership_id: str, body: dict = {}, current_user=Depends(get_current_salon_user)):
    """Salon confirms payment for a customer-purchased membership. Credits wallet after confirmation."""
    membership = await db.customer_memberships.find_one({
        "id": membership_id,
        "salon_id": salon_id
    }, {"_id": 0})
    
    if not membership:
        raise HTTPException(status_code=404, detail="Membership not found")
    
    if membership.get("payment_confirmed", True):
        raise HTTPException(status_code=400, detail="Payment is already confirmed")
    
    # Get the plan to know credit amount
    plan = await db.membership_plans.find_one({"id": membership["membership_plan_id"]}, {"_id": 0})
    credit_amount = plan["credit"] if plan else membership.get("credit_added", 0)
    
    # Optionally change payment mode
    payment_mode = body.get("payment_mode", membership.get("payment_mode"))
    
    # Check for existing active membership to add credit to
    phone = membership["customer_phone"]
    existing = await db.customer_memberships.find_one({
        "salon_id": salon_id,
        "customer_phone": phone,
        "is_active": True,
        "payment_confirmed": True,
        "id": {"$ne": membership_id}
    }, {"_id": 0})
    
    if existing:
        # Add credit to existing confirmed membership wallet
        new_balance = existing["wallet_balance"] + credit_amount
        await db.customer_memberships.update_one(
            {"id": existing["id"]},
            {"$set": {"wallet_balance": new_balance, "expiry_date": membership.get("expiry_date")}}
        )
        # Mark this one as merged/confirmed
        await db.customer_memberships.update_one(
            {"id": membership_id},
            {"$set": {
                "payment_confirmed": True,
                "payment_mode": payment_mode,
                "wallet_balance": 0,
                "is_active": False  # merged into existing
            }}
        )
        wallet_balance_after = new_balance
    else:
        # Confirm and activate this membership with credit
        await db.customer_memberships.update_one(
            {"id": membership_id},
            {"$set": {
                "payment_confirmed": True,
                "payment_mode": payment_mode,
                "wallet_balance": credit_amount
            }}
        )
        wallet_balance_after = credit_amount
    
    # Record wallet transaction
    await db.wallet_transactions.insert_one({
        "id": str(uuid.uuid4()),
        "customer_phone": phone,
        "salon_id": salon_id,
        "transaction_type": "credit",
        "amount": credit_amount,
        "balance_after": wallet_balance_after,
        "description": f"Membership confirmed: {membership.get('membership_name', 'N/A')}",
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Create notification for customer
    await db.notifications.insert_one({
        "id": str(uuid.uuid4()),
        "user_type": "customer",
        "user_id": phone,
        "salon_id": salon_id,
        "title": "Membership Payment Confirmed",
        "message": f"Your {membership.get('membership_name', '')} membership payment has been confirmed. ₹{credit_amount} has been added to your wallet.",
        "type": "membership_confirmed",
        "related_id": membership_id,
        "is_read": False,
        "created_at": datetime.now(timezone.utc).isoformat()
    })
    
    # Record financial transaction for membership (cash/upi/card impact cash flow)
    if payment_mode != "wallet":
        await db.financial_transactions.insert_one({
            "id": str(uuid.uuid4()),
            "salon_id": salon_id,
            "type": "inflow",
            "category": "membership_payment",
            "amount": float(membership.get("paid_amount", 0)),
            "payment_mode": payment_mode,
            "narration": f"Membership: {membership.get('membership_name', '')} - {membership.get('customer_name', '')}",
            "reference_id": membership_id,
            "reference_type": "membership",
            "created_by": "system",
            "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
            "created_at": datetime.now(timezone.utc).isoformat()
        })
    
    return {
        "message": "Membership payment confirmed and wallet credited",
        "credit_added": credit_amount,
        "wallet_balance": wallet_balance_after
    }


# ============ FINANCIALS SYSTEM ============

class FinancialTransactionCreate(BaseModel):
    type: str  # inflow, outflow, withdrawal, deposit, adjustment
    category: str  # salary, staff_refreshment, consumables, utilities, rent, maintenance, products, custom, withdrawal, deposit, adjustment
    amount: float
    payment_mode: str = "cash"  # cash, upi, card, wallet
    narration: Optional[str] = ""
    date: Optional[str] = None  # YYYY-MM-DD, defaults to today

@api_router.get("/salons/{salon_id}/financials/settings")
async def get_financial_settings(salon_id: str, current_user=Depends(get_current_salon_user)):
    """Get financial settings (opening balance, etc.)"""
    settings = await db.financial_settings.find_one({"salon_id": salon_id}, {"_id": 0})
    if not settings:
        return {"salon_id": salon_id, "opening_balance": 0, "opening_balance_date": datetime.now(timezone.utc).strftime("%Y-%m-%d")}
    return settings

@api_router.put("/salons/{salon_id}/financials/settings")
async def update_financial_settings(salon_id: str, body: dict, current_user=Depends(get_current_salon_user)):
    """Update financial settings (opening balance)"""
    opening_balance = body.get("opening_balance", 0)
    opening_balance_date = body.get("opening_balance_date", datetime.now(timezone.utc).strftime("%Y-%m-%d"))
    
    await db.financial_settings.update_one(
        {"salon_id": salon_id},
        {"$set": {
            "salon_id": salon_id,
            "opening_balance": float(opening_balance),
            "opening_balance_date": opening_balance_date,
            "updated_at": datetime.now(timezone.utc).isoformat()
        }},
        upsert=True
    )
    
    return {"message": "Financial settings updated", "opening_balance": opening_balance}

@api_router.get("/salons/{salon_id}/financials/transactions")
async def get_financial_transactions(
    salon_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None,
    type: Optional[str] = None,
    category: Optional[str] = None,
    payment_mode: Optional[str] = None,
    limit: int = 200,
    current_user=Depends(get_current_salon_user)
):
    """Get financial transactions with filters"""
    query = {"salon_id": salon_id}
    
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    if type:
        query["type"] = type
    if category:
        query["category"] = category
    if payment_mode:
        query["payment_mode"] = payment_mode
    
    transactions = await db.financial_transactions.find(query, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"transactions": transactions}

@api_router.post("/salons/{salon_id}/financials/transactions")
async def create_financial_transaction(salon_id: str, txn: FinancialTransactionCreate, current_user=Depends(get_current_salon_user)):
    """Create a manual financial transaction (expense, withdrawal, deposit, adjustment)"""
    txn_date = txn.date or datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    txn_data = {
        "id": str(uuid.uuid4()),
        "salon_id": salon_id,
        "type": txn.type,
        "category": txn.category,
        "amount": txn.amount if txn.type == "adjustment" else abs(txn.amount),
        "payment_mode": txn.payment_mode,
        "narration": txn.narration or "",
        "reference_id": "",
        "reference_type": "manual",
        "created_by": current_user.get("id", "admin"),
        "date": txn_date,
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.financial_transactions.insert_one(txn_data)
    
    # Remove MongoDB _id before returning
    txn_data.pop("_id", None)
    
    return {"message": "Transaction recorded", "transaction": txn_data}

@api_router.delete("/salons/{salon_id}/financials/transactions/{txn_id}")
async def delete_financial_transaction(salon_id: str, txn_id: str, current_user=Depends(get_current_salon_user)):
    """Delete a manual financial transaction (admin only)"""
    txn = await db.financial_transactions.find_one({"id": txn_id, "salon_id": salon_id}, {"_id": 0})
    if not txn:
        raise HTTPException(status_code=404, detail="Transaction not found")
    if txn.get("reference_type") != "manual":
        raise HTTPException(status_code=400, detail="Cannot delete system-generated transactions")
    
    await db.financial_transactions.delete_one({"id": txn_id})
    return {"message": "Transaction deleted"}

@api_router.get("/salons/{salon_id}/financials/dashboard")
async def get_financial_dashboard(
    salon_id: str,
    period: str = "daily",  # daily or monthly
    date: Optional[str] = None,  # YYYY-MM-DD for daily, YYYY-MM for monthly
    current_user=Depends(get_current_salon_user)
):
    """Get financial dashboard data with cash in/out summary"""
    today = datetime.now(timezone.utc)
    
    if period == "daily":
        target_date = date or today.strftime("%Y-%m-%d")
        query = {"salon_id": salon_id, "date": target_date}
    else:  # monthly
        target_month = date or today.strftime("%Y-%m")
        query = {"salon_id": salon_id, "date": {"$regex": f"^{target_month}"}}
    
    transactions = await db.financial_transactions.find(query, {"_id": 0}).sort("created_at", -1).to_list(1000)
    
    # Calculate summaries
    total_inflow = 0
    total_outflow = 0
    inflow_by_mode = {"cash": 0, "upi": 0, "card": 0, "wallet": 0}
    outflow_by_category = {}
    inflow_by_category = {}
    
    for txn in transactions:
        amount = txn.get("amount", 0)
        mode = txn.get("payment_mode", "cash")
        cat = txn.get("category", "other")
        txn_type = txn.get("type", "")
        
        if txn_type in ("inflow", "deposit"):
            total_inflow += amount
            inflow_by_mode[mode] = inflow_by_mode.get(mode, 0) + amount
            inflow_by_category[cat] = inflow_by_category.get(cat, 0) + amount
        elif txn_type in ("outflow", "withdrawal"):
            total_outflow += amount
            outflow_by_category[cat] = outflow_by_category.get(cat, 0) + amount
        elif txn_type == "adjustment":
            if amount >= 0:
                total_inflow += amount
            else:
                total_outflow += abs(amount)
    
    # Get opening balance
    settings = await db.financial_settings.find_one({"salon_id": salon_id}, {"_id": 0})
    opening_balance = settings.get("opening_balance", 0) if settings else 0
    
    # For daily view, calculate running balance from opening + all previous transactions
    if period == "daily":
        target = target_date
        prev_txns = await db.financial_transactions.find({
            "salon_id": salon_id,
            "date": {"$lt": target}
        }, {"_id": 0, "type": 1, "amount": 1}).to_list(10000)
        
        running_balance = opening_balance
        for pt in prev_txns:
            if pt["type"] in ("inflow", "deposit"):
                running_balance += pt["amount"]
            elif pt["type"] in ("outflow", "withdrawal"):
                running_balance -= pt["amount"]
        
        day_opening = running_balance
        day_closing = day_opening + total_inflow - total_outflow
    else:
        day_opening = opening_balance
        day_closing = opening_balance + total_inflow - total_outflow
    
    # Daily breakdown for monthly view
    daily_breakdown = []
    if period == "monthly":
        daily_data = {}
        for txn in transactions:
            d = txn.get("date", "")
            if d not in daily_data:
                daily_data[d] = {"date": d, "inflow": 0, "outflow": 0}
            if txn["type"] in ("inflow", "deposit"):
                daily_data[d]["inflow"] += txn["amount"]
            elif txn["type"] in ("outflow", "withdrawal"):
                daily_data[d]["outflow"] += txn["amount"]
        daily_breakdown = sorted(daily_data.values(), key=lambda x: x["date"])
    
    return {
        "period": period,
        "date": date or (today.strftime("%Y-%m-%d") if period == "daily" else today.strftime("%Y-%m")),
        "opening_balance": day_opening,
        "closing_balance": day_closing,
        "total_inflow": total_inflow,
        "total_outflow": total_outflow,
        "net": total_inflow - total_outflow,
        "inflow_by_mode": inflow_by_mode,
        "inflow_by_category": inflow_by_category,
        "outflow_by_category": outflow_by_category,
        "daily_breakdown": daily_breakdown,
        "transactions": transactions
    }

@api_router.get("/salons/{salon_id}/financials/report/csv")
async def download_financial_report_csv(
    salon_id: str,
    start_date: Optional[str] = None,
    end_date: Optional[str] = None
):
    """Download financial report as CSV"""
    from fastapi.responses import StreamingResponse
    import io
    import csv
    
    query = {"salon_id": salon_id}
    if start_date:
        query["date"] = {"$gte": start_date}
    if end_date:
        if "date" in query:
            query["date"]["$lte"] = end_date
        else:
            query["date"] = {"$lte": end_date}
    
    transactions = await db.financial_transactions.find(query, {"_id": 0}).sort("date", 1).to_list(10000)
    
    # Build CSV
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Date", "Time", "Type", "Category", "Amount", "Payment Mode", "Narration", "Reference"])
    
    for txn in transactions:
        # Extract time from created_at
        created_at = txn.get("created_at", "")
        time_str = ""
        if created_at:
            try:
                dt = datetime.fromisoformat(created_at.replace('Z', '+00:00'))
                time_str = dt.strftime("%H:%M:%S")
            except:
                time_str = ""
        
        writer.writerow([
            txn.get("date", ""),
            time_str,
            txn.get("type", ""),
            txn.get("category", ""),
            txn.get("amount", 0),
            txn.get("payment_mode", ""),
            txn.get("narration", ""),
            txn.get("reference_type", "")
        ])
    
    output.seek(0)
    filename = f"financials_{salon_id}_{start_date or 'all'}_{end_date or 'all'}.csv"
    
    return StreamingResponse(
        io.BytesIO(output.getvalue().encode()),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"}
    )

@api_router.get("/salons/{salon_id}/today-sales")
async def get_today_sales(
    salon_id: str
):
    """Get today's sales from completed tokens (analytics logic)"""
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Find all completed tokens for today (matching analytics logic)
    completed_tokens = await db.tokens.find({
        "salon_id": salon_id,
        "date": today,
        "status": "completed"
    }, {"_id": 0, "total_amount": 1}).to_list(1000)
    
    # Sum up total_amount from all completed tokens (same as analytics)
    total_sales = sum(token.get("total_amount", 0) for token in completed_tokens)
    
    return {"today_sales": total_sales}


# ============ NOTIFICATIONS SYSTEM ============

@api_router.get("/notifications/{user_type}/{user_id}")
async def get_notifications(user_type: str, user_id: str, limit: int = 50):
    """Get notifications for a user (customer or salon)"""
    # Normalize phone for customer
    if user_type == "customer" and not user_id.startswith("+91"):
        user_id = f"+91{user_id}"
    
    notifications = await db.notifications.find({
        "user_type": user_type,
        "user_id": user_id
    }, {"_id": 0}).sort("created_at", -1).limit(limit).to_list(limit)
    
    return {"notifications": notifications}

@api_router.get("/notifications/{user_type}/{user_id}/unread-count")
async def get_unread_notification_count(user_type: str, user_id: str):
    """Get unread notification count"""
    if user_type == "customer" and not user_id.startswith("+91"):
        user_id = f"+91{user_id}"
    
    count = await db.notifications.count_documents({
        "user_type": user_type,
        "user_id": user_id,
        "is_read": False
    })
    
    return {"unread_count": count}

@api_router.put("/notifications/{notification_id}/read")
async def mark_notification_read(notification_id: str):
    """Mark a notification as read"""
    result = await db.notifications.update_one(
        {"id": notification_id},
        {"$set": {"is_read": True}}
    )
    
    if result.modified_count == 0:
        raise HTTPException(status_code=404, detail="Notification not found")
    
    return {"message": "Notification marked as read"}

@api_router.put("/notifications/{user_type}/{user_id}/read-all")
async def mark_all_notifications_read(user_type: str, user_id: str):
    """Mark all notifications as read for a user"""
    if user_type == "customer" and not user_id.startswith("+91"):
        user_id = f"+91{user_id}"
    
    await db.notifications.update_many(
        {"user_type": user_type, "user_id": user_id, "is_read": False},
        {"$set": {"is_read": True}}
    )
    
    return {"message": "All notifications marked as read"}


# ============ NOTIFICATION SETTINGS ============

@api_router.get("/salons/{salon_id}/notification-settings")
async def get_salon_notif_settings(salon_id: str):
    """Get salon notification preferences (defaults all True if not set)."""
    settings = await get_salon_notification_settings(salon_id)
    return settings


@api_router.put("/salons/{salon_id}/notification-settings")
async def update_salon_notif_settings(
    salon_id: str,
    body: dict,
    current_user=Depends(get_current_salon_user),
):
    """Update salon notification preferences."""
    update_doc = {k: bool(v) for k, v in body.items() if k in DEFAULT_SALON_NOTIFICATION_SETTINGS}
    update_doc["salon_id"] = salon_id
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.salon_notification_settings.update_one(
        {"salon_id": salon_id},
        {"$set": update_doc},
        upsert=True,
    )
    settings = await get_salon_notification_settings(salon_id)
    return settings


@api_router.get("/customers/{phone}/notification-settings")
async def get_customer_notif_settings(phone: str):
    """Get customer notification preferences (defaults all True)."""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    settings = await get_customer_notification_settings(phone)
    return settings


@api_router.put("/customers/{phone}/notification-settings")
async def update_customer_notif_settings(phone: str, body: dict):
    """Update customer notification preferences (in-app + WhatsApp toggles)."""
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    update_doc = {k: bool(v) for k, v in body.items() if k in DEFAULT_CUSTOMER_NOTIFICATION_SETTINGS}
    update_doc["phone"] = phone
    update_doc["updated_at"] = datetime.now(timezone.utc).isoformat()

    await db.customer_notification_settings.update_one(
        {"phone": phone},
        {"$set": update_doc},
        upsert=True,
    )
    settings = await get_customer_notification_settings(phone)
    return settings


# ============ CANCEL VIA WHATSAPP LINK ============

@api_router.get("/tokens/{token_id}/cancel-link", response_class=HTMLResponse)
async def cancel_token_via_link(token_id: str):
    """
    Cancel a booking via direct link (used in WhatsApp messages).
    Returns a styled HTML confirmation page. No app login required.
    """
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        return HTMLResponse(content=_render_cancel_page(success=False, message="Booking not found."), status_code=404)

    # If already cancelled/completed, show appropriate page
    current_status = token.get("status")
    if current_status == "cancelled":
        return HTMLResponse(content=_render_cancel_page(
            success=True,
            message=f"Your booking (Token #{token.get('token_number','')}) is already cancelled."
        ))
    if current_status in ("completed", "in_service", "called"):
        return HTMLResponse(content=_render_cancel_page(
            success=False,
            message=f"This booking cannot be cancelled (status: {current_status})."
        ), status_code=400)

    # Refund wallet if paid via wallet
    if token.get("payment_mode") == "wallet" and token.get("payment_status") == "paid":
        wallet_phone = token.get("phone", "")
        if wallet_phone and not wallet_phone.startswith("+91"):
            wallet_phone = f"+91{wallet_phone}"
        membership = await db.customer_memberships.find_one({
            "salon_id": token.get("salon_id"),
            "customer_phone": wallet_phone,
            "is_active": True,
        }, {"_id": 0})
        if membership:
            refund_amount = token.get("total_amount", 0) or 0
            new_balance = (membership.get("wallet_balance", 0) or 0) + refund_amount
            await db.customer_memberships.update_one(
                {"id": membership["id"]},
                {"$set": {"wallet_balance": new_balance}},
            )
            await db.wallet_transactions.insert_one({
                "id": str(uuid.uuid4()),
                "customer_phone": wallet_phone,
                "salon_id": token.get("salon_id"),
                "transaction_type": "credit",
                "amount": refund_amount,
                "balance_after": new_balance,
                "description": f"Refund - Cancelled via WhatsApp (Token {token.get('token_number','')})",
                "created_at": datetime.now(timezone.utc).isoformat(),
            })

    # Cancel the booking
    await db.tokens.update_one({"id": token_id}, {"$set": {"status": "cancelled"}})
    await broadcast_update("token_cancelled", {"token_id": token_id})

    # Notify customer (in-app + whatsapp)
    if token.get("phone"):
        await create_in_app_notification(
            user_type="customer",
            user_id=token["phone"],
            title="Booking Cancelled",
            message=f"Your booking (Token #{token.get('token_number','')}) has been cancelled via WhatsApp.",
            notification_type="booking_cancelled",
            setting_key="booking_status_change",
            salon_id=token.get("salon_id", ""),
            related_id=token_id,
        )
    await send_booking_notification(token, "token_cancelled")

    # Notify salon (in-app)
    if token.get("salon_id"):
        await create_in_app_notification(
            user_type="salon",
            user_id=token["salon_id"],
            title="Booking Cancelled by Customer",
            message=f"{token.get('customer_name','Customer')} cancelled booking (Token #{token.get('token_number','')}) via WhatsApp.",
            notification_type="booking_cancelled",
            setting_key="booking_change",
            salon_id=token["salon_id"],
            related_id=token_id,
        )

    return HTMLResponse(content=_render_cancel_page(
        success=True,
        message=f"Your booking (Token #{token.get('token_number','')}) has been cancelled successfully."
    ))


def _render_cancel_page(success: bool, message: str) -> str:
    icon = "✅" if success else "❌"
    color = "#16a34a" if success else "#dc2626"
    title = "Cancellation Confirmed" if success else "Cancellation Failed"
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>{title}</title>
<style>
  body {{ margin:0; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
         background: linear-gradient(135deg,#1f2937 0%, #111827 100%); min-height: 100vh;
         display:flex; align-items:center; justify-content:center; color:#fff; padding:20px; }}
  .card {{ background:#1f2937; border:1px solid rgba(184,134,11,0.3); border-radius:16px;
         padding:36px 28px; max-width:420px; width:100%; box-shadow:0 20px 50px rgba(0,0,0,0.4);
         text-align:center; }}
  .icon {{ font-size:64px; line-height:1; margin-bottom:12px; }}
  h1 {{ color:{color}; margin:0 0 12px 0; font-size:22px; }}
  p {{ color:#cbd5e1; margin:8px 0 24px; line-height:1.5; }}
  .btn {{ display:inline-block; padding:12px 24px; border-radius:8px;
         background:#b8860b; color:#000; text-decoration:none; font-weight:700; }}
  .small {{ color:#94a3b8; font-size:12px; margin-top:18px; }}
</style>
</head>
<body>
<div class="card">
  <div class="icon">{icon}</div>
  <h1>{title}</h1>
  <p>{message}</p>
  <a class="btn" href="/salons">Book Another Appointment</a>
  <div class="small">SalonHub · You can close this tab.</div>
</div>
</body>
</html>"""



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
async def get_salon_token_status(salon_id: str, shift: Optional[str] = None, date: Optional[str] = None):
    """Get current token status for salon (overall and per barber)"""
    today = date or datetime.now().date().isoformat()
    
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
            {**barber_query, "status": {"$in": ["called", "in_progress", "in_service"]}},
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

        # Compute approx finish time for the currently-serving token using 75% rule residual
        approx_finish_minutes = None
        currently_serving_payload = None
        if barber_called:
            try:
                remaining = None
                if barber_called.get("blocked_minutes") is not None:
                    remaining = int(barber_called["blocked_minutes"])
                else:
                    mins = await calc_service_total_minutes(barber_called.get("selected_services", []))
                    remaining = calc_blocked_minutes_from_total(mins)
                # Subtract elapsed since called_at
                if barber_called.get("called_at"):
                    try:
                        called_dt = datetime.fromisoformat(str(barber_called["called_at"]).replace("Z", "+00:00"))
                        elapsed = (datetime.now(timezone.utc) - called_dt).total_seconds() / 60
                        remaining = max(0, int(remaining - elapsed))
                    except Exception:
                        pass
                approx_finish_minutes = remaining
                # Service names (not sensitive)
                svc_names = []
                for sid in barber_called.get("selected_services", []) or []:
                    svc = await db.services.find_one({"id": sid}, {"_id": 0, "service_name": 1})
                    if svc:
                        svc_names.append(svc.get("service_name"))
                currently_serving_payload = {
                    "token_number": barber_called.get("token_number"),
                    "services": svc_names,
                    "started_at": barber_called.get("called_at"),
                    "approx_finish_minutes": approx_finish_minutes,
                }
            except Exception as e:
                logger.error(f"live-status finish calc failed: {e}")

        result["barbers"].append({
            "barber_id": barber["id"],
            "barber_name": barber["name"],
            "category": barber.get("category"),
            "specialization": barber.get("specialization"),
            "current_token": barber_called.get("token_number") if barber_called else None,
            "waiting_count": len(barber_waiting),
            "total_tokens_today": total_tokens_today,
            "queue_status": barber.get("queue_status", "available"),
            "currently_serving": currently_serving_payload,
            "approx_finish_minutes": approx_finish_minutes,
        })
    
    return result

@api_router.get("/salons/{salon_id}/live-status")
async def get_salon_live_status(salon_id: str, shift: Optional[str] = None, date: Optional[str] = None):
    """Get current live status for salon (alias for token-status)"""
    return await get_salon_token_status(salon_id, shift, date)

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

    # Notify salon (in-app) about new review
    if rating_data.salon_id:
        stars = "⭐" * int(rating_data.rating)
        await create_in_app_notification(
            user_type="salon",
            user_id=rating_data.salon_id,
            title=f"New Review ({rating_data.rating}/5)",
            message=f"{user_name} rated {barber_name} {stars}: {(rating_data.review or '')[:100]}",
            notification_type="review_added",
            setting_key="review_added",
            salon_id=rating_data.salon_id,
            related_id=rating_dict["id"],
        )
    
    return RatingResponse(**rating_dict)

async def update_barber_average_rating(barber_id: str):
    """Update barber's average rating after a new review, and also update the salon-level aggregate."""
    pipeline = [
        {"$match": {"barber_id": barber_id}},
        {"$group": {
            "_id": "$barber_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    result = await db.ratings.aggregate(pipeline).to_list(1)

    salon_id = None
    if result:
        avg_rating = round(result[0]["average_rating"], 1)
        total_reviews = result[0]["total_reviews"]
        await db.barbers.update_one(
            {"id": barber_id},
            {"$set": {"rating": avg_rating, "total_reviews": total_reviews}}
        )
        barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0, "salon_id": 1})
        if barber:
            salon_id = barber.get("salon_id")

    if not salon_id:
        # Fallback: look up salon via ratings
        sample = await db.ratings.find_one({"barber_id": barber_id}, {"_id": 0, "salon_id": 1})
        if sample:
            salon_id = sample.get("salon_id")

    if salon_id:
        await update_salon_average_rating(salon_id)


async def update_salon_average_rating(salon_id: str):
    """Recompute the salon's aggregate rating across all its ratings."""
    pipeline = [
        {"$match": {"salon_id": salon_id}},
        {"$group": {
            "_id": "$salon_id",
            "average_rating": {"$avg": "$rating"},
            "total_reviews": {"$sum": 1}
        }}
    ]
    result = await db.ratings.aggregate(pipeline).to_list(1)
    if result:
        avg = round(result[0]["average_rating"], 1)
        total = result[0]["total_reviews"]
    else:
        avg = 0
        total = 0
    await db.salons.update_one(
        {"id": salon_id},
        {"$set": {"rating": avg, "total_reviews": total}}
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

# ============ EMPLOYEE REWARD PLAN (INCENTIVES) ============

class IncentiveSlab(BaseModel):
    from_pct: float = Field(ge=0)
    to_pct: float = Field(ge=0)        # use 9999 for "+" / open-ended
    type: str                           # "total_pct" | "additional_pct" | "fixed_amount"
    value: float = Field(ge=0)

class IncentivePlanConfig(BaseModel):
    target_type: str = "salary_multiplier"  # "salary_multiplier" | "manual"
    multiplier: Optional[float] = None
    manual_target: Optional[float] = None
    slabs: List[IncentiveSlab] = []

class RewardPlanCreate(BaseModel):
    mode: str  # "all" | "individual" | "partial"
    global_plan: Optional[IncentivePlanConfig] = None
    assigned_barber_ids: List[str] = []
    individual_plans: Dict[str, IncentivePlanConfig] = {}

class IncentivePayoutStatusUpdate(BaseModel):
    status: str  # "Pending" | "Approved" | "Paid" | "Hold"
    payment_method: Optional[str] = None  # "cash" | "upi" | "bank"
    notes: Optional[str] = None
    # Admin-overridden incentive amount (used when approving / paying out).
    # If null, the auto-calculated incentive_earned is used.
    manual_amount: Optional[float] = None


# ============ STAFF ATTENDANCE MODELS ============

class AttendanceStatus(str, Enum):
    PRESENT = "present"
    HALF_DAY = "half_day"
    ABSENT = "absent"
    HOLIDAY = "holiday"

class AttendanceRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    barber_id: str
    date: str  # YYYY-MM-DD
    status: str  # present/half_day/absent/holiday
    auto_calculated: bool = True  # True if system calculated, False if admin override
    morning_shift_completed: bool = False
    noon_evening_shift_completed: bool = False
    bookings_count: int = 0
    created_at: str
    updated_at: str
    override_by: Optional[str] = None  # Admin user ID who overrode
    override_note: Optional[str] = None

class AttendanceOverride(BaseModel):
    status: str  # present/half_day/absent/holiday
    note: Optional[str] = None

class SalaryPaymentRequest(BaseModel):
    payment_method: str  # cash/upi/bank
    note: Optional[str] = None

class SalaryRecord(BaseModel):
    model_config = ConfigDict(extra="ignore")
    id: str
    salon_id: str
    barber_id: str
    month: str  # YYYY-MM
    base_salary: float
    working_days: int
    present_days: int
    half_days: int
    absent_days: int
    holidays: int
    calculated_salary: float
    incentive_amount: float = 0
    total_payable: float
    is_paid: bool = False
    paid_at: Optional[str] = None
    payment_method: Optional[str] = None
    financial_transaction_id: Optional[str] = None
    created_at: str
    updated_at: str


def _compute_incentive_amount(plan_config: dict, target: float, actual_sales: float) -> dict:
    """Calculate incentive earned based on plan slabs.

    Slab types:
    - additional_pct: % applied only on the incremental sale within that slab range (cumulative)
    - total_pct:      % applied on the FULL actual_sales (only the matching range applies)
    - fixed_amount:   flat ₹ bonus when achievement reaches from_pct (additive)
    """
    target = float(target or 0)
    actual_sales = float(actual_sales or 0)
    if target <= 0:
        return {"earned": 0.0, "achievement_pct": 0.0, "breakdown": []}

    achievement_pct = (actual_sales / target) * 100.0
    slabs = sorted(plan_config.get("slabs", []) or [], key=lambda s: float(s.get("from_pct", 0)))

    earned = 0.0
    breakdown = []

    # 1) Additional % slabs (cumulative)
    for slab in slabs:
        if slab.get("type") != "additional_pct":
            continue
        from_pct = float(slab.get("from_pct", 0))
        to_pct = float(slab.get("to_pct", 9999))
        rate = float(slab.get("value", 0))
        if achievement_pct < from_pct:
            continue
        slab_lower_amt = (from_pct / 100.0) * target
        slab_upper_amt = (to_pct / 100.0) * target
        applicable = min(actual_sales, slab_upper_amt) - slab_lower_amt
        if applicable > 0:
            amt = applicable * (rate / 100.0)
            earned += amt
            breakdown.append({
                "slab": f"{from_pct:g}%-{to_pct:g}%",
                "type": "% of Additional Sale",
                "applied_on": round(applicable, 2),
                "rate": f"{rate:g}%",
                "amount": round(amt, 2),
            })

    # 2) Total % slab
    # Pick the slab with the HIGHEST from_pct that the barber has crossed.
    # If achievement_pct lands inside an explicit [from, to) range, that slab wins.
    # If achievement_pct is past the highest defined to_pct, the highest crossed
    # slab still applies (the barber doesn't lose the bonus for over-performing).
    total_pct_match = None
    for slab in slabs:
        if slab.get("type") != "total_pct":
            continue
        from_pct = float(slab.get("from_pct", 0))
        to_pct = float(slab.get("to_pct", 9999))
        if achievement_pct < from_pct:
            continue
        # This slab is "crossed" — keep it as the best match so far.
        # Slabs are sorted ascending by from_pct, so later iterations may overwrite.
        total_pct_match = slab
        if achievement_pct < to_pct or to_pct >= 9999:
            # Exact range match — no higher slab can be better.
            break

    if total_pct_match is not None:
        from_pct = float(total_pct_match.get("from_pct", 0))
        to_pct = float(total_pct_match.get("to_pct", 9999))
        rate = float(total_pct_match.get("value", 0))
        amt = actual_sales * (rate / 100.0)
        earned += amt
        breakdown.append({
            "slab": f"{from_pct:g}%-{to_pct:g}%",
            "type": "% of Total Sale",
            "applied_on": round(actual_sales, 2),
            "rate": f"{rate:g}%",
            "amount": round(amt, 2),
        })

    # 3) Fixed bonuses (additive when achievement crosses from_pct)
    for slab in slabs:
        if slab.get("type") != "fixed_amount":
            continue
        from_pct = float(slab.get("from_pct", 0))
        amount = float(slab.get("value", 0))
        if achievement_pct >= from_pct:
            earned += amount
            breakdown.append({
                "slab": f"{from_pct:g}%+",
                "type": "Fixed Bonus",
                "applied_on": "—",
                "rate": "—",
                "amount": round(amount, 2),
            })

    return {
        "earned": round(earned, 2),
        "achievement_pct": round(achievement_pct, 2),
        "breakdown": breakdown,
    }


async def _get_effective_plan_for_barber(salon_id: str, barber_id: str) -> Optional[dict]:
    """Return the incentive plan config that applies to this barber.

    Override priority: individual_plans[barber_id] > global_plan (if barber is
    assigned/all). Returns None if no plan applies.
    """
    config = await db.salon_reward_plans.find_one({"salon_id": salon_id}, {"_id": 0})
    if not config:
        return None
    individual_plans = config.get("individual_plans") or {}
    if barber_id in individual_plans and individual_plans[barber_id]:
        return individual_plans[barber_id]
    mode = config.get("mode", "all")
    if mode == "individual":
        return None
    assigned = config.get("assigned_barber_ids") or []
    # If empty assigned_barber_ids in "all" mode, treat as "applies to everyone"
    if mode == "all" and not assigned:
        return config.get("global_plan")
    if barber_id in assigned:
        return config.get("global_plan")
    return None


async def _get_barber_target(plan_config: dict, barber: dict) -> float:
    """Compute monthly target from plan + barber salary."""
    target_type = (plan_config or {}).get("target_type", "salary_multiplier")
    if target_type == "manual":
        return float(plan_config.get("manual_target") or 0)
    salary = float(barber.get("compensation") or 0)
    multiplier = float(plan_config.get("multiplier") or 0)
    return salary * multiplier


async def _get_barber_actual_sales(salon_id: str, barber_id: str, year_month: str) -> float:
    """Sum of total_amount on completed tokens for this barber in the given month (YYYY-MM).

    Tokens are dated using the `date` field (YYYY-MM-DD). For older / migrated
    rows that may not have `date` set, we fall back to the YYYY-MM prefix of
    `created_at`.
    """
    start = f"{year_month}-01"
    # Compute end of month
    try:
        y, m = year_month.split("-")
        y_i, m_i = int(y), int(m)
        if m_i == 12:
            next_first = f"{y_i + 1}-01-01"
        else:
            next_first = f"{y_i}-{m_i + 1:02d}-01"
    except Exception:
        return 0.0

    cursor = db.tokens.find({
        "salon_id": salon_id,
        "barber_id": barber_id,
        "status": "completed",
        "$or": [
            {"date": {"$gte": start, "$lt": next_first}},
            {"booking_date": {"$gte": start, "$lt": next_first}},
            # Fallback for legacy tokens with neither date nor booking_date set
            {
                "date": {"$in": [None, ""]},
                "booking_date": {"$in": [None, ""]},
                "created_at": {"$gte": start, "$lt": next_first + "T99"},
            },
        ],
    }, {"_id": 0, "total_amount": 1})

    total = 0.0
    async for tok in cursor:
        total += float(tok.get("total_amount") or 0)
    return total


async def _recompute_incentive_payout(salon_id: str, barber_id: str, year_month: str) -> Optional[dict]:
    """Recompute and upsert the incentive_payouts row for a barber+month. Preserves status."""
    plan = await _get_effective_plan_for_barber(salon_id, barber_id)
    if not plan:
        return None

    barber = await db.barbers.find_one({"id": barber_id, "salon_id": salon_id}, {"_id": 0})
    if not barber:
        return None

    target = await _get_barber_target(plan, barber)
    actual_sales = await _get_barber_actual_sales(salon_id, barber_id, year_month)
    calc = _compute_incentive_amount(plan, target, actual_sales)

    existing = await db.incentive_payouts.find_one(
        {"salon_id": salon_id, "barber_id": barber_id, "month": year_month}, {"_id": 0}
    )

    payout = {
        "id": existing.get("id") if existing else str(uuid.uuid4()),
        "salon_id": salon_id,
        "barber_id": barber_id,
        "barber_name": barber.get("name", ""),
        "month": year_month,
        "salary": float(barber.get("compensation") or 0),
        "target": round(float(target), 2),
        "actual_sales": round(actual_sales, 2),
        "achievement_pct": calc["achievement_pct"],
        "incentive_earned": calc["earned"],
        "breakdown": calc["breakdown"],
        "status": (existing or {}).get("status") or ("Pending" if calc["earned"] > 0 else "Pending"),
        "payment_method": (existing or {}).get("payment_method"),
        "paid_at": (existing or {}).get("paid_at"),
        "linked_expense_id": (existing or {}).get("linked_expense_id"),
        "manual_amount": (existing or {}).get("manual_amount"),
        "notes": (existing or {}).get("notes", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
        "created_at": (existing or {}).get("created_at") or datetime.now(timezone.utc).isoformat(),
    }
    await db.incentive_payouts.update_one(
        {"salon_id": salon_id, "barber_id": barber_id, "month": year_month},
        {"$set": payout},
        upsert=True,
    )
    return payout


@api_router.get("/salons/{salon_id}/reward-plan")
async def get_reward_plan(salon_id: str, current_user=Depends(get_current_salon_user)):
    config = await db.salon_reward_plans.find_one({"salon_id": salon_id}, {"_id": 0})
    if not config:
        return {
            "salon_id": salon_id,
            "mode": "all",
            "global_plan": None,
            "assigned_barber_ids": [],
            "individual_plans": {},
        }
    return config


@api_router.post("/salons/{salon_id}/reward-plan")
async def save_reward_plan(salon_id: str, body: RewardPlanCreate, current_user=Depends(get_current_salon_user)):
    """Save the salon's reward plan configuration (admin only)."""
    role = (current_user or {}).get("role")
    if role not in ("admin", "salon", "salon_admin"):
        raise HTTPException(status_code=403, detail="Only admin can configure reward plan")

    if body.mode not in ("all", "individual", "partial"):
        raise HTTPException(status_code=400, detail="mode must be one of: all, individual, partial")

    doc = {
        "salon_id": salon_id,
        "mode": body.mode,
        "global_plan": body.global_plan.dict() if body.global_plan else None,
        "assigned_barber_ids": body.assigned_barber_ids or [],
        "individual_plans": {bid: cfg.dict() for bid, cfg in (body.individual_plans or {}).items()},
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }
    await db.salon_reward_plans.update_one(
        {"salon_id": salon_id}, {"$set": doc}, upsert=True
    )
    return {"message": "Reward plan saved", "config": doc}


@api_router.get("/salons/{salon_id}/reward-plan/eligible-barbers")
async def get_eligible_barbers(salon_id: str, current_user=Depends(get_current_salon_user)):
    """List barbers that can be assigned to a reward plan (those marked Visible to Customers)."""
    cursor = db.barbers.find(
        {"salon_id": salon_id, "is_barber": True},
        {"_id": 0, "id": 1, "name": 1, "compensation": 1, "is_barber": 1, "designation": 1}
    )
    items = []
    async for b in cursor:
        items.append(b)
    return {"barbers": items}


@api_router.get("/salons/{salon_id}/reward-plan/incentives")
async def list_incentives(
    salon_id: str,
    month: Optional[str] = None,    # YYYY-MM
    barber_id: Optional[str] = None,
    current_user=Depends(get_current_salon_user),
):
    """Recompute all eligible barbers for the month and return the latest payout rows.

    This computes on demand so the dashboard always reflects the latest sales.
    """
    if not month:
        month = datetime.now(timezone.utc).strftime("%Y-%m")

    # Get all eligible (is_barber=True) members
    barber_filter = {"salon_id": salon_id, "is_barber": True}
    if barber_id:
        barber_filter["id"] = barber_id

    barbers_cursor = db.barbers.find(barber_filter, {"_id": 0})
    rows = []
    async for b in barbers_cursor:
        payout = await _recompute_incentive_payout(salon_id, b["id"], month)
        if payout:
            rows.append(payout)

    # Also include any barbers who have payouts saved historically but might not be in barber_filter
    if not barber_id:
        existing_cursor = db.incentive_payouts.find(
            {"salon_id": salon_id, "month": month}, {"_id": 0}
        )
        seen = {r["barber_id"] for r in rows}
        async for p in existing_cursor:
            if p["barber_id"] not in seen:
                rows.append(p)

    return {"month": month, "incentives": rows}


@api_router.put("/salons/{salon_id}/reward-plan/incentives/{barber_id}/{month}/status")
async def update_incentive_status(
    salon_id: str,
    barber_id: str,
    month: str,
    body: IncentivePayoutStatusUpdate,
    current_user=Depends(get_current_salon_user),
):
    """Update payout status. On 'Paid', creates a financial expense entry and links it."""
    if body.status not in ("Pending", "Approved", "Paid", "Hold"):
        raise HTTPException(status_code=400, detail="Invalid status")

    # Only admin may change status
    role = (current_user or {}).get("role")
    if role not in ("admin", "salon", "salon_admin"):
        raise HTTPException(status_code=403, detail="Only admin can change payout status")

    payout = await db.incentive_payouts.find_one(
        {"salon_id": salon_id, "barber_id": barber_id, "month": month}, {"_id": 0}
    )
    if not payout:
        # Recompute if missing
        payout = await _recompute_incentive_payout(salon_id, barber_id, month)
        if not payout:
            raise HTTPException(status_code=404, detail="No incentive computed for this barber+month")

    update = {
        "status": body.status,
        "notes": body.notes if body.notes is not None else payout.get("notes", ""),
        "updated_at": datetime.now(timezone.utc).isoformat(),
    }

    # If the admin passed a manual_amount, persist it (None = clear back to auto).
    # Allowed only for Approved / Paid / Pending — not Hold.
    if body.manual_amount is not None:
        if float(body.manual_amount) < 0:
            raise HTTPException(status_code=400, detail="manual_amount cannot be negative")
        update["manual_amount"] = float(body.manual_amount)
    elif body.status in ("Approved", "Paid"):
        # Keep whatever was previously stored
        pass

    # Effective payout amount = manual override (if set) else auto-calculated
    effective_manual = (
        update.get("manual_amount")
        if "manual_amount" in update
        else payout.get("manual_amount")
    )
    effective_amount = (
        float(effective_manual)
        if effective_manual is not None
        else float(payout.get("incentive_earned") or 0)
    )

    # Handle "Paid" — must have payment_method, create expense entry
    if body.status == "Paid":
        if not body.payment_method:
            raise HTTPException(status_code=400, detail="payment_method is required when marking Paid")
        if body.payment_method not in ("cash", "upi", "bank"):
            raise HTTPException(status_code=400, detail="payment_method must be cash, upi or bank")

        # Strict idempotency: never create more than ONE financial txn per payout.id.
        # Even if linked_expense_id was somehow lost, look up by reference_id+type.
        existing_txn = None
        if payout.get("linked_expense_id"):
            existing_txn = await db.financial_transactions.find_one(
                {"id": payout["linked_expense_id"], "salon_id": salon_id}, {"_id": 0}
            )
        if not existing_txn:
            existing_txn = await db.financial_transactions.find_one(
                {
                    "salon_id": salon_id,
                    "reference_type": "incentive_payout",
                    "reference_id": payout.get("id"),
                },
                {"_id": 0},
            )

        if existing_txn:
            # Already booked — keep the existing entry; ensure the payout points at it.
            update["linked_expense_id"] = existing_txn["id"]
        elif effective_amount > 0:
            txn = {
                "id": str(uuid.uuid4()),
                "salon_id": salon_id,
                "type": "outflow",
                "category": "staff_incentive",
                "amount": effective_amount,
                "payment_mode": body.payment_method,
                "narration": f"Incentive payout to {payout.get('barber_name', '')} for {month}",
                "reference_id": payout.get("id"),
                "reference_type": "incentive_payout",
                "created_by": current_user.get("id") if isinstance(current_user, dict) else "admin",
                "date": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
                "created_at": datetime.now(timezone.utc).isoformat(),
            }
            await db.financial_transactions.insert_one(txn)
            update["linked_expense_id"] = txn["id"]

        update["payment_method"] = body.payment_method
        update["paid_at"] = datetime.now(timezone.utc).isoformat()
    else:
        # Reset paid fields if moved away from Paid
        if payout.get("status") == "Paid":
            # Keep linked expense (admin can manually delete it from Financials if needed)
            pass

    await db.incentive_payouts.update_one(
        {"salon_id": salon_id, "barber_id": barber_id, "month": month}, {"$set": update}
    )
    fresh = await db.incentive_payouts.find_one(
        {"salon_id": salon_id, "barber_id": barber_id, "month": month}, {"_id": 0}
    )
    return {"message": "Status updated", "payout": fresh}


# ============ ANALYTICS ROUTES (continued) ============

@api_router.get("/analytics/day-wise-sales")
async def get_day_wise_sales(
    salon_id: str,
    start_date: str,
    end_date: Optional[str] = None,
    current_salon=Depends(get_current_salon_user)
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
    current_salon=Depends(get_current_salon_user)
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
    current_salon=Depends(get_current_salon_user)
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
    current_salon=Depends(get_current_salon_user)
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
    current_salon=Depends(get_current_salon_user)
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
    """Verify payment (manual for UPI) - salon admin"""
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

# ============ CUSTOMER PAYMENT CONFIRM ============

@api_router.post("/payments/customer-confirm-upi")
async def customer_confirm_upi(body: dict):
    """Customer confirms UPI payment was done"""
    token_id = body.get("token_id")
    upi_ref = body.get("upi_reference", "")
    
    if not token_id:
        raise HTTPException(status_code=400, detail="Token ID required")
    
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    
    await db.tokens.update_one(
        {"id": token_id},
        {"$set": {
            "payment_status": "paid",
            "payment_mode": "upi",
            "upi_transaction_id": upi_ref or "Customer confirmed"
        }}
    )
    
    return {"message": "Payment confirmed", "token_id": token_id}

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

@api_router.get("/customers/{phone}/active-bookings")
async def get_customer_active_bookings(phone: str):
    """Get active bookings for a customer by phone, enriched with live queue context."""
    # Normalize phone
    if not phone.startswith("+91"):
        phone = f"+91{phone}"
    
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    
    # Get active bookings (waiting or in_service)
    tokens = await db.tokens.find(
        {
            "phone": phone,
            "date": today,
            "status": {"$in": ["waiting", "called", "in_progress", "in_service"]},
            "$or": [{"cancelled": False}, {"cancelled": {"$exists": False}}]
        },
        {"_id": 0}
    ).sort("created_at", 1).to_list(10)
    
    # Enrich with salon + live queue details
    for token in tokens:
        salon = await db.salons.find_one({"id": token["salon_id"]}, {"_id": 0})
        if salon:
            token["salon_details"] = {
                "salon_name": salon.get("salon_name"),
                "address": salon.get("address"),
                "city": salon.get("city"),
                "logo_url": salon.get("logo_url")
            }
        # Live queue context (customer-facing only)
        try:
            q = await compute_queue_status_for_token(token)
            # Inject fields the frontend already reads, plus new ones
            token["queue_position"] = q["people_before"]       # "N ahead of you"
            token["people_before"] = q["people_before"]
            token["barber_position"] = q["position"]            # 1-indexed, #3 style
            token["estimated_wait_minutes"] = q["estimated_wait_minutes"]
            token["queue_status_message"] = q["status_message"]
            token["currently_serving"] = q["currently_serving"]
            token["approx_finish_minutes"] = q["approx_finish_minutes"]
        except Exception as e:
            logger.error(f"Queue enrichment failed for token {token.get('id')}: {e}")

    return {"active_bookings": tokens, "count": len(tokens)}


@api_router.get("/tokens/{token_id}/queue-status")
async def get_token_queue_status(token_id: str):
    """Customer-facing queue status for a single token.

    Returns total token, barber name, barber-queue position, people before,
    estimated wait time (75% rule), live serving info, and a status message.
    """
    token = await db.tokens.find_one({"id": token_id}, {"_id": 0})
    if not token:
        raise HTTPException(status_code=404, detail="Token not found")
    try:
        q = await compute_queue_status_for_token(token)
    except Exception as e:
        logger.error(f"Error computing queue status: {e}")
        raise HTTPException(status_code=500, detail="Unable to compute queue status")
    return q


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

# Moved app.include_router to end of all routes (before scheduler)

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

# ============================================================================
# MEMBERSHIP EXPIRY NOTIFICATIONS — runs daily to notify customers whose
# membership expires in 30 or 7 days. Honors customer notification settings.
# ============================================================================
async def notify_expiring_memberships():
    """Send 30-days-before and 7-days-before expiry reminders."""
    try:
        now = datetime.now(timezone.utc)
        # Fetch all active, non-cancelled memberships with an expiry date
        cursor = db.customer_memberships.find(
            {"is_active": True, "$or": [{"cancelled": False}, {"cancelled": {"$exists": False}}]},
            {"_id": 0},
        )
        async for m in cursor:
            try:
                expiry = datetime.fromisoformat(str(m["expiry_date"]).replace("Z", "+00:00"))
            except Exception:
                continue
            days_left = (expiry - now).days
            phone = m.get("customer_phone")
            if not phone:
                continue

            # 30-day reminder
            if 28 <= days_left <= 30 and not m.get("notified_1m_expiry"):
                await _send_expiry_reminder(m, days_left, "1m")
                await db.customer_memberships.update_one(
                    {"id": m["id"]}, {"$set": {"notified_1m_expiry": True}}
                )
            # 7-day reminder
            if 6 <= days_left <= 7 and not m.get("notified_1w_expiry"):
                await _send_expiry_reminder(m, days_left, "1w")
                await db.customer_memberships.update_one(
                    {"id": m["id"]}, {"$set": {"notified_1w_expiry": True}}
                )
    except Exception as e:
        logger.error(f"notify_expiring_memberships failed: {e}")


async def _send_expiry_reminder(m: Dict[str, Any], days_left: int, key: str):
    phone = m["customer_phone"]
    salon_id = m.get("salon_id", "")
    name = m.get("membership_name", "Membership")
    label = "30 days" if key == "1m" else "7 days"
    title = f"Your {name} membership expires in ~{label}"
    body = (
        f"Your {name} membership will expire in about {label}. "
        f"Renew with the salon to keep your wallet benefits."
    )
    try:
        await create_in_app_notification(
            user_type="customer",
            user_id=phone,
            title=title,
            message=body,
            notification_type="membership_expiry",
            setting_key="membership_expiry",
            salon_id=salon_id,
            related_id=m.get("id", ""),
        )
    except Exception as e:
        logger.error(f"in-app expiry notification failed: {e}")

    # WhatsApp (respects customer's whatsapp_membership_expiry setting)
    try:
        if await should_send_customer_whatsapp(phone, "whatsapp_membership_expiry"):
            msg = (
                f"Hi {m.get('customer_name','')}, your {name} membership expires in ~{label} "
                f"(on {str(m.get('expiry_date',''))[:10]}). Please visit the salon to renew."
            )
            await send_whatsapp_notification(phone, msg, f"membership_expiry_{key}")
    except Exception as e:
        logger.error(f"whatsapp expiry notification failed: {e}")


# ============ STAFF ATTENDANCE ENDPOINTS ============

async def calculate_barber_attendance_for_date(salon_id: str, barber_id: str, date_str: str) -> dict:
    """Calculate attendance for a barber on a specific date based on completed bookings.
    
    Rules:
    - Present: 2+ bookings in different shifts (morning + noon/evening)
    - Half Day: Bookings completed in only 1 shift
    - Absent: No bookings or less than required
    """
    # Get completed bookings for this barber on this date
    start_of_day = f"{date_str}T00:00:00"
    end_of_day = f"{date_str}T23:59:59"
    
    completed_bookings = await db.tokens.find({
        "salon_id": salon_id,
        "barber_id": barber_id,
        "status": "completed",
        "completed_at": {"$gte": start_of_day, "$lte": end_of_day}
    }, {"_id": 0, "shift": 1, "token_number": 1}).to_list(100)
    
    bookings_count = len(completed_bookings)
    
    # Check which shifts have bookings
    shifts_with_bookings = set()
    for booking in completed_bookings:
        shift = booking.get("shift", "").lower()
        if shift:
            shifts_with_bookings.add(shift)
    
    morning_shift = "morning" in shifts_with_bookings
    noon_evening_shift = "noon" in shifts_with_bookings or "evening" in shifts_with_bookings
    
    # Determine attendance status
    if bookings_count >= 2 and morning_shift and noon_evening_shift:
        status = "present"
    elif bookings_count >= 1 and len(shifts_with_bookings) >= 1:
        status = "half_day"
    else:
        status = "absent"
    
    return {
        "status": status,
        "bookings_count": bookings_count,
        "morning_shift_completed": morning_shift,
        "noon_evening_shift_completed": noon_evening_shift
    }


@api_router.get("/salons/{salon_id}/staff-attendance/month/{month}")
async def get_monthly_attendance(
    salon_id: str, 
    month: str,  # YYYY-MM format
    barber_id: Optional[str] = None
):
    """Get attendance records for a month. If barber_id specified, returns only that barber's records."""
    # Validate month format
    try:
        year, mon = month.split("-")
        year, mon = int(year), int(mon)
    except:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    
    # Get all barbers for this salon if no specific barber requested
    query = {"salon_id": salon_id}
    if barber_id:
        query["barber_id"] = barber_id
    
    # Get existing attendance records
    records = await db.attendance.find({
        **query,
        "date": {"$regex": f"^{month}"}
    }, {"_id": 0}).to_list(1000)
    
    # Get barbers
    barber_query = {"salon_id": salon_id, "is_barber": True, "is_active": True}
    if barber_id:
        barber_query["id"] = barber_id
    barbers = await db.barbers.find(barber_query, {"_id": 0, "id": 1, "name": 1, "compensation": 1}).to_list(100)
    
    # Build response
    response = {
        "month": month,
        "barbers": []
    }
    
    for barber in barbers:
        barber_records = [r for r in records if r.get("barber_id") == barber["id"]]
        response["barbers"].append({
            "barber_id": barber["id"],
            "barber_name": barber["name"],
            "compensation": barber.get("compensation", 0),
            "attendance": barber_records
        })
    
    return response


@api_router.post("/salons/{salon_id}/staff-attendance/calculate/{date}")
async def calculate_daily_attendance(
    salon_id: str,
    date: str,  # YYYY-MM-DD format
    current_user=Depends(get_current_salon_user)
):
    """Calculate attendance for all barbers for a specific date based on completed bookings."""
    # Verify admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Get all active barbers
    barbers = await db.barbers.find({
        "salon_id": salon_id,
        "is_barber": True,
        "is_active": True
    }, {"_id": 0, "id": 1, "name": 1}).to_list(100)
    
    results = []
    for barber in barbers:
        # Check if already has an override
        existing = await db.attendance.find_one({
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": date,
            "auto_calculated": False  # Manual override exists
        }, {"_id": 0})
        
        if existing:
            results.append(existing)
            continue
        
        # Calculate attendance
        calc = await calculate_barber_attendance_for_date(salon_id, barber["id"], date)
        
        # Create or update record
        record_id = f"{salon_id}_{barber['id']}_{date}"
        record = {
            "id": record_id,
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": date,
            "status": calc["status"],
            "auto_calculated": True,
            "morning_shift_completed": calc["morning_shift_completed"],
            "noon_evening_shift_completed": calc["noon_evening_shift_completed"],
            "bookings_count": calc["bookings_count"],
            "created_at": datetime.now(timezone.utc).isoformat(),
            "updated_at": datetime.now(timezone.utc).isoformat()
        }
        
        await db.attendance.update_one(
            {"id": record_id},
            {"$set": record},
            upsert=True
        )
        results.append(record)
    
    return {"date": date, "attendance": results}


@api_router.put("/salons/{salon_id}/staff-attendance/override/{barber_id}/{date}")
async def override_attendance(
    salon_id: str,
    barber_id: str,
    date: str,  # YYYY-MM-DD format
    body: AttendanceOverride,
    current_user=Depends(get_current_salon_user)
):
    """Admin override for attendance. Click on calendar date to change status."""
    # Verify admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    # Validate status
    if body.status not in ["present", "half_day", "absent", "holiday"]:
        raise HTTPException(status_code=400, detail="Invalid status. Use: present, half_day, absent, holiday")
    
    record_id = f"{salon_id}_{barber_id}_{date}"
    
    # Check if record exists
    existing = await db.attendance.find_one({"id": record_id}, {"_id": 0})
    
    now = datetime.now(timezone.utc).isoformat()
    
    if existing:
        # Update existing record
        await db.attendance.update_one(
            {"id": record_id},
            {"$set": {
                "status": body.status,
                "auto_calculated": False,
                "override_by": current_user.get("id"),
                "override_note": body.note,
                "updated_at": now
            }}
        )
    else:
        # Create new record
        record = {
            "id": record_id,
            "salon_id": salon_id,
            "barber_id": barber_id,
            "date": date,
            "status": body.status,
            "auto_calculated": False,
            "morning_shift_completed": False,
            "noon_evening_shift_completed": False,
            "bookings_count": 0,
            "override_by": current_user.get("id"),
            "override_note": body.note,
            "created_at": now,
            "updated_at": now
        }
        await db.attendance.insert_one(record)
    
    updated = await db.attendance.find_one({"id": record_id}, {"_id": 0})
    return updated


@api_router.get("/salons/{salon_id}/staff-salary/month/{month}")
async def get_monthly_salary(
    salon_id: str,
    month: str,  # YYYY-MM format
    barber_id: Optional[str] = None
):
    """Calculate and return salary for all barbers for a month based on attendance."""
    # Validate month format
    try:
        year, mon = month.split("-")
        year, mon = int(year), int(mon)
    except:
        raise HTTPException(status_code=400, detail="Invalid month format. Use YYYY-MM")
    
    # Get working days in month (excluding Sundays as default holidays)
    num_days = calendar.monthrange(year, mon)[1]
    
    # Get barbers
    barber_query = {"salon_id": salon_id, "is_barber": True, "is_active": True}
    if barber_id:
        barber_query["id"] = barber_id
    barbers = await db.barbers.find(barber_query, {"_id": 0, "id": 1, "name": 1, "compensation": 1}).to_list(100)
    
    results = []
    for barber in barbers:
        # Get attendance records for this month
        attendance_records = await db.attendance.find({
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "date": {"$regex": f"^{month}"}
        }, {"_id": 0}).to_list(100)
        
        # Count attendance
        present_days = sum(1 for r in attendance_records if r.get("status") == "present")
        half_days = sum(1 for r in attendance_records if r.get("status") == "half_day")
        absent_days = sum(1 for r in attendance_records if r.get("status") == "absent")
        holidays = sum(1 for r in attendance_records if r.get("status") == "holiday")
        
        # Calculate working days (total days - holidays)
        working_days = num_days - holidays
        
        # Calculate salary
        base_salary = float(barber.get("compensation", 0))
        daily_rate = base_salary / num_days if num_days > 0 else 0
        
        # Present = full day, Half day = 0.5 day
        effective_days = present_days + (half_days * 0.5)
        calculated_salary = round(daily_rate * effective_days, 2)
        
        # Get incentive amount for this month
        incentive = await db.incentive_payouts.find_one({
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "month": month,
            "status": {"$in": ["Approved", "Paid"]}
        }, {"_id": 0, "incentive_earned": 1})
        incentive_amount = incentive.get("incentive_earned", 0) if incentive else 0
        
        total_payable = calculated_salary + incentive_amount
        
        # Check if salary record exists
        salary_record = await db.salary_records.find_one({
            "salon_id": salon_id,
            "barber_id": barber["id"],
            "month": month
        }, {"_id": 0})
        
        # Create or get salary record
        salary_id = f"{salon_id}_{barber['id']}_{month}"
        if not salary_record:
            salary_record = {
                "id": salary_id,
                "salon_id": salon_id,
                "barber_id": barber["id"],
                "barber_name": barber["name"],
                "month": month,
                "base_salary": base_salary,
                "working_days": working_days,
                "present_days": present_days,
                "half_days": half_days,
                "absent_days": absent_days,
                "holidays": holidays,
                "calculated_salary": calculated_salary,
                "incentive_amount": incentive_amount,
                "total_payable": total_payable,
                "is_paid": False,
                "created_at": datetime.now(timezone.utc).isoformat(),
                "updated_at": datetime.now(timezone.utc).isoformat()
            }
            await db.salary_records.insert_one(salary_record)
        else:
            # Update calculated values
            salary_record.update({
                "base_salary": base_salary,
                "working_days": working_days,
                "present_days": present_days,
                "half_days": half_days,
                "absent_days": absent_days,
                "holidays": holidays,
                "calculated_salary": calculated_salary,
                "incentive_amount": incentive_amount,
                "total_payable": total_payable if not salary_record.get("is_paid") else salary_record.get("total_payable"),
                "updated_at": datetime.now(timezone.utc).isoformat()
            })
            await db.salary_records.update_one({"id": salary_id}, {"$set": salary_record})
        
        salary_record["barber_name"] = barber["name"]
        results.append(salary_record)
    
    return {"month": month, "salary_records": results}


@api_router.post("/salons/{salon_id}/staff-salary/pay/{barber_id}/{month}")
async def mark_salary_paid(
    salon_id: str,
    barber_id: str,
    month: str,
    body: SalaryPaymentRequest,
    current_user=Depends(get_current_salon_user)
):
    """Mark salary as paid and create financial transaction."""
    # Verify admin
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    if body.payment_method not in ["cash", "upi", "bank"]:
        raise HTTPException(status_code=400, detail="Invalid payment method. Use: cash, upi, bank")
    
    salary_id = f"{salon_id}_{barber_id}_{month}"
    
    # Get salary record
    salary_record = await db.salary_records.find_one({"id": salary_id}, {"_id": 0})
    if not salary_record:
        raise HTTPException(status_code=404, detail="Salary record not found. Calculate salary first.")
    
    if salary_record.get("is_paid"):
        raise HTTPException(status_code=400, detail="Salary already paid")
    
    # Get barber name for narration
    barber = await db.barbers.find_one({"id": barber_id}, {"_id": 0, "name": 1})
    barber_name = barber.get("name", "Unknown") if barber else "Unknown"
    
    now = datetime.now(timezone.utc).isoformat()
    
    # Create financial transaction
    transaction_id = str(uuid.uuid4())
    transaction = {
        "id": transaction_id,
        "salon_id": salon_id,
        "type": "expense",
        "category": "staff_salary",
        "amount": salary_record["total_payable"],
        "payment_method": body.payment_method,
        "description": f"Salary payment for {barber_name} - {month}",
        "narration": f"Monthly salary paid to {barber_name} for {month}. Base: ₹{salary_record['calculated_salary']}, Incentive: ₹{salary_record['incentive_amount']}",
        "linked_salary_id": salary_id,
        "created_at": now,
        "updated_at": now
    }
    await db.financial_transactions.insert_one(transaction)
    
    # Update salary record
    await db.salary_records.update_one(
        {"id": salary_id},
        {"$set": {
            "is_paid": True,
            "paid_at": now,
            "payment_method": body.payment_method,
            "financial_transaction_id": transaction_id,
            "updated_at": now
        }}
    )
    
    updated = await db.salary_records.find_one({"id": salary_id}, {"_id": 0})
    updated["barber_name"] = barber_name
    updated["transaction"] = transaction
    
    return updated


@api_router.get("/salons/{salon_id}/staff-holidays")
async def get_salon_holidays(salon_id: str, year: Optional[int] = None):
    """Get marked holidays for a salon."""
    if not year:
        year = datetime.now().year
    
    holidays = await db.salon_holidays.find({
        "salon_id": salon_id,
        "date": {"$regex": f"^{year}"}
    }, {"_id": 0}).to_list(365)
    
    return {"year": year, "holidays": holidays}


@api_router.post("/salons/{salon_id}/staff-holidays")
async def add_salon_holiday(
    salon_id: str,
    date: str,  # YYYY-MM-DD
    description: Optional[str] = None,
    current_user=Depends(get_current_salon_user)
):
    """Add a holiday for the salon."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    holiday_id = f"{salon_id}_{date}"
    
    holiday = {
        "id": holiday_id,
        "salon_id": salon_id,
        "date": date,
        "description": description or "Holiday",
        "created_at": datetime.now(timezone.utc).isoformat()
    }
    
    await db.salon_holidays.update_one(
        {"id": holiday_id},
        {"$set": holiday},
        upsert=True
    )
    
    # Also mark all barbers as holiday for this date
    barbers = await db.barbers.find({
        "salon_id": salon_id,
        "is_barber": True,
        "is_active": True
    }, {"_id": 0, "id": 1}).to_list(100)
    
    for barber in barbers:
        record_id = f"{salon_id}_{barber['id']}_{date}"
        await db.attendance.update_one(
            {"id": record_id},
            {"$set": {
                "id": record_id,
                "salon_id": salon_id,
                "barber_id": barber["id"],
                "date": date,
                "status": "holiday",
                "auto_calculated": False,
                "updated_at": datetime.now(timezone.utc).isoformat()
            }},
            upsert=True
        )
    
    return holiday


@api_router.delete("/salons/{salon_id}/staff-holidays/{date}")
async def remove_salon_holiday(
    salon_id: str,
    date: str,
    current_user=Depends(get_current_salon_user)
):
    """Remove a holiday."""
    if current_user.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin access required")
    
    await db.salon_holidays.delete_one({"id": f"{salon_id}_{date}"})
    
    # Remove holiday status from attendance records
    await db.attendance.update_many(
        {"salon_id": salon_id, "date": date, "status": "holiday"},
        {"$set": {"status": "absent", "auto_calculated": True, "updated_at": datetime.now(timezone.utc).isoformat()}}
    )
    
    return {"message": "Holiday removed"}


# Include router - MUST be after ALL @api_router routes are defined
app.include_router(api_router)

# Scheduler for token allocation
scheduler = AsyncIOScheduler()
scheduler.add_job(allocate_future_tokens, 'cron', hour=5, minute=30)  # Run at 5:30 AM daily
# Membership expiry reminders (once daily at 9:00 AM UTC)
scheduler.add_job(notify_expiring_memberships, 'cron', hour=9, minute=0)

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
