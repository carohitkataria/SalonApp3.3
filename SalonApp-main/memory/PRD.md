# The Looks Unisex Salon - Queue Management System

## Overview
A token-based queue management system for "The Looks Unisex Salon" supporting daily sequential tokens, future/walk-in booking, live queue display, and notifications.

## Core Requirements
- Multi-Salon/Multi-Branch architecture
- Barber-wise queues with dynamic services and pricing
- Location-based salon discovery (Leaflet maps)
- 2-hour time slots
- Mandatory OTP login for salons
- Single-page booking flow
- Light/dark mode
- UPI QR code payments

## User Personas
1. **Customers**: Book tokens, view queue status, receive notifications
2. **Salon Staff**: Manage queue (call/skip/recall), view daily appointments
3. **Salon Owners**: Register salon, manage barbers and services

## Tech Stack
- **Frontend**: React, Tailwind CSS, shadcn/ui, Leaflet.js, framer-motion
- **Backend**: FastAPI, WebSockets (python-socketio), PyMongo
- **Database**: MongoDB

## Key API Endpoints
- `GET /api/salons` - List all salons
- `GET /api/salons/nearby` - Location-based discovery
- `POST /api/salon/register` - New salon registration
- `POST /api/salon/send-otp` / `verify-otp` - Salon OTP auth
- `POST /api/user/login` - User login (name + phone)
- `POST /api/bookings` - Create booking/token
- `GET /api/salons/{id}/barbers` - Get salon barbers
- `POST /api/salons/{id}/barbers` - Add barber
- `PUT /api/barbers/{id}` - Update barber
- `DELETE /api/barbers/{id}` - Delete barber
- `GET /api/barbers/{id}/services` - Get barber-specific pricing
- `PUT /api/barbers/{id}/services` - Bulk assign services to barber
- `GET /api/services` - List all services
- `POST /api/services` - Create service
- `PUT /api/services/{id}` - Update service
- `DELETE /api/services/{id}` - Delete service
- `POST /api/tokens/{id}/call|skip|recall` - Queue controls

## Database Schema
- `salons`: {name, address, location, upi_id, phone, is_active}
- `barbers`: {salon_id, name, experience, category, mobile, queue_status}
- `services`: {service_name, description, duration, base_price}
- `barber_services`: {barber_id, service_id, price, is_available}
- `tokens`: {salon_id, barber_id, user_phone, date, time_slot, status, token_number}
- `users`: {phone, name, created_at}

---

## Implementation Status

### Completed (March 2026)
- [x] Multi-Salon Architecture with barber-wise queues
- [x] Location-based salon discovery with Leaflet maps
- [x] Single-page booking flow (date, slot, barber, services)
- [x] Salon OTP Login with hardcoded "123456" for testing
- [x] Salon Signup flow with "New Salon? Register here" link
- [x] Enhanced Salon Dashboard with 4 tabs (Queue, Barbers, Services, Salon Info)
- [x] Light/Dark theme toggle
- [x] User login with redirect preservation
- [x] **Barber Management** - Full CRUD (Add/Edit/Delete barbers)
- [x] **Service Assignment** - Checkbox + editable price per barber
- [x] **Service Management** - Full CRUD for services
- [x] Improved geolocation with better error handling
- [x] Removed payment timing from registration

### Mocked/Pending Integration
- [ ] SMS OTP Gateway (currently returns "123456")
- [ ] WhatsApp Notifications (logged to console)
- [ ] UPI Payment Verification (manual verification only)

### Known Issues Fixed (March 26, 2026)
1. Salon signup route missing in App.js - FIXED
2. Barbers not linked to salon (salon_id was null) - FIXED
3. Duplicate phone registration allowed - FIXED
4. User redirect after login lost booking context - FIXED
5. Geolocation "Use my current Location" not working - FIXED (better error handling)

---

## Upcoming Tasks (P1)
- [ ] Smart Token Allocation Logic (Daily at 5-6 AM for future bookings)
- [ ] Salon Profile Management (Logo upload, Gallery images)
- [ ] Map Improvements (Salon names on pins, different colors for user/salon)
- [ ] Service Selection UI (Dropdown + top 4 popular quick-select)
- [ ] Back Button on all screens

## Future/Backlog (P2)
- [ ] Real Twilio WhatsApp Integration (when user provides keys)
- [ ] Analytics Dashboard with charts
- [ ] Customer notification preferences
- [ ] Multi-language support

---

## Testing Credentials
- **Salon OTP**: 123456 (hardcoded for dev)
- **Default Salon Phone**: +919876543210
- **User Login**: Any name + 10-digit phone

## Preview URL
https://elegant-salon-ui.preview.emergentagent.com

## Key Files
- `/app/backend/server.py` - Main API (50+ endpoints)
- `/app/frontend/src/components/BarberManagement.js` - Barber CRUD with service assignment
- `/app/frontend/src/components/ServiceManagement.js` - Service CRUD
- `/app/frontend/src/pages/EnhancedSalonDashboard.js` - Dashboard with 4 tabs
- `/app/frontend/src/pages/SinglePageBooking.js` - Booking flow
- `/app/frontend/src/pages/SalonSignupPage.js` - Salon registration
