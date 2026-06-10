# Guest Booking Implementation - Remaining Steps

## ✅ COMPLETED:

### Backend:
1. ✅ Added `customer_gender` and `is_guest` fields to BookingCreate model
2. ✅ Modified `create_booking` to automatically create customer accounts for guests
3. ✅ Added `last_booking_salon_id` tracking for smart routing
4. ✅ Added `/api/customer/{phone}/last-salon` endpoint for smart routing

### Frontend:
1. ✅ Modified LandingPage "Get Started" button with smart routing logic
2. ✅ Added salon visit tracking in SinglePageBooking component

---

## 🔄 REMAINING IMPLEMENTATION:

### Frontend: Guest/Login Choice at Checkout

**File:** `/app/frontend/src/pages/SinglePageBooking.js`

**Location:** Around line 1400 (before payment methods section)

**Add the following state variables at the top:**

```javascript
const [bookingMode, setBookingMode] = useState(null); // 'guest' or 'login'
const [guestData, setGuestData] = useState({
  mobile: '',
  name: '',
  gender: 'Men'
});
const [showAuthModal, setShowAuthModal] = useState(false);
```

**Add Guest/Login Selection UI (before payment section):**

```jsx
{/* Step 1: Choose Booking Mode - Guest or Login */}
{!bookingMode && (
  <div className="space-y-4">
    <h3 className="text-xl font-bold text-foreground">How would you like to book?</h3>
    
    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => setBookingMode('guest')}
      className="w-full p-6 rounded-xl border-2 border-border hover:border-gold bg-card transition-all text-left"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-purple-500/10 rounded-full">
          <Smartphone className="w-6 h-6 text-purple-600" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg text-foreground">Book as Guest</p>
          <p className="text-sm text-muted-foreground mt-1">
            Quick booking with just your mobile number and name. 
            No account creation needed.
          </p>
        </div>
      </div>
    </motion.button>

    <motion.button
      whileHover={{ scale: 1.01 }}
      whileTap={{ scale: 0.99 }}
      onClick={() => setBookingMode('login')}
      className="w-full p-6 rounded-xl border-2 border-border hover:border-gold bg-card transition-all text-left"
    >
      <div className="flex items-start gap-4">
        <div className="p-3 bg-gold/10 rounded-full">
          <User className="w-6 h-6 text-gold" />
        </div>
        <div className="flex-1">
          <p className="font-bold text-lg text-foreground">Login to Book</p>
          <p className="text-sm text-muted-foreground mt-1">
            Access your booking history, wallet, and exclusive member benefits.
          </p>
        </div>
      </div>
    </motion.button>
  </div>
)}

{/* Step 2: Guest Booking Form */}
{bookingMode === 'guest' && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-bold text-foreground">Guest Details</h3>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => setBookingMode(null)}
      >
        Change
      </Button>
    </div>

    <div className="space-y-3">
      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Mobile Number</label>
        <Input
          type="tel"
          placeholder="+91 XXXXX XXXXX"
          value={guestData.mobile}
          onChange={(e) => setGuestData({...guestData, mobile: e.target.value})}
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Name</label>
        <Input
          type="text"
          placeholder="Your name"
          value={guestData.name}
          onChange={(e) => setGuestData({...guestData, name: e.target.value})}
          className="w-full"
        />
      </div>

      <div>
        <label className="text-sm font-medium text-foreground mb-2 block">Gender</label>
        <div className="flex gap-2">
          {['Men', 'Women', 'Other'].map(g => (
            <Button
              key={g}
              type="button"
              variant={guestData.gender === g ? 'default' : 'outline'}
              onClick={() => setGuestData({...guestData, gender: g})}
              className="flex-1"
            >
              {g}
            </Button>
          ))}
        </div>
      </div>
    </div>

    {/* Payment methods appear here after guest data is filled */}
  </div>
)}

{/* Step 3: Login/Signup Modal */}
{bookingMode === 'login' && (
  <div className="space-y-4">
    <div className="flex items-center justify-between">
      <h3 className="text-xl font-bold text-foreground">Login Required</h3>
      <Button 
        variant="ghost" 
        size="sm"
        onClick={() => setBookingMode(null)}
      >
        Book as Guest Instead
      </Button>
    </div>

    {/* Show CustomerOtpVerification component or create new auth modal */}
    <CustomerOtpVerification
      purpose="booking"
      onVerificationSuccess={(customer) => {
        loginUser(customer);
        setBookingMode('logged_in');
        toast.success('Login successful!');
      }}
    />
  </div>
)}
```

**Modify the booking confirmation to handle guest bookings:**

```javascript
// Update the booking API call (around line 896)
const bookingData = {
  salon_id: salonId,
  branch_id: branchId || undefined,
  user_id: bookingMode === 'guest' ? 'guest' : customer.id,
  customer_name: bookingMode === 'guest' ? guestData.name : (bookingForSelf ? customer.name : otherPersonName),
  phone: bookingMode === 'guest' ? guestData.mobile : (bookingForSelf ? customer.phone : otherPersonPhone),
  date: formData.date,
  shift: formData.shift,
  barber_id: fastestAvailable ? 'any' : formData.barberId,
  selected_services: formData.selectedServices,
  source: source,
  booking_type: formData.bookingType,
  booking_for_self: bookingForSelf,
  customer_gender: bookingMode === 'guest' ? guestData.gender : (bookingForSelf ? (customer.gender || 'Men') : otherPersonGender),
  is_guest: bookingMode === 'guest',
  payment_mode: paymentMode
};

// Store customer phone for future smart routing
if (bookingMode === 'guest') {
  localStorage.setItem('customer_phone', guestData.mobile);
}
```

---

## 📱 CUSTOMER AUTH MODAL (ENHANCED)

**Option 1:** Enhance existing CustomerOtpVerification component
**Option 2:** Create new comprehensive auth modal

### New Component: CustomerAuthModal.js

```jsx
import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { toast } from 'sonner';
import axios from 'axios';

const API_URL = process.env.REACT_APP_BACKEND_URL;

export default function CustomerAuthModal({ open, onClose, onSuccess }) {
  const [mode, setMode] = useState('login'); // 'login' or 'signup'
  const [loginMethod, setLoginMethod] = useState('password'); // 'password' or 'otp'
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [name, setName] = useState('');
  const [gender, setGender] = useState('Men');
  const [loading, setLoading] = useState(false);

  const handlePasswordLogin = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/customer/login`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        password
      });
      toast.success('Login successful!');
      onSuccess(response.data.customer);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleSendOTP = async () => {
    try {
      setLoading(true);
      await axios.post(`${API_URL}/api/customer/send-otp-v2`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        purpose: mode === 'login' ? 'authentication' : 'signup'
      });
      setOtpSent(true);
      toast.success('OTP sent to your mobile');
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Failed to send OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleOTPLogin = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/customer/verify-otp-v2`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        otp,
        purpose: 'authentication'
      });
      toast.success('Login successful!');
      onSuccess(response.data.customer);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Invalid OTP');
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async () => {
    try {
      setLoading(true);
      const response = await axios.post(`${API_URL}/api/customer/verify-otp-v2`, {
        phone: phone.startsWith('+91') ? phone : `+91${phone}`,
        otp,
        purpose: 'signup',
        name,
        gender,
        password
      });
      toast.success('Account created successfully!');
      onSuccess(response.data.customer);
      onClose();
    } catch (error) {
      toast.error(error.response?.data?.detail || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customer Authentication</DialogTitle>
        </DialogHeader>

        <Tabs value={mode} onValueChange={setMode}>
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="login">Login</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <Input
              type="tel"
              placeholder="Mobile Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />

            <div className="flex gap-2">
              <Button
                variant={loginMethod === 'password' ? 'default' : 'outline'}
                onClick={() => setLoginMethod('password')}
                className="flex-1"
              >
                Password
              </Button>
              <Button
                variant={loginMethod === 'otp' ? 'default' : 'outline'}
                onClick={() => setLoginMethod('otp')}
                className="flex-1"
              >
                OTP
              </Button>
            </div>

            {loginMethod === 'password' ? (
              <>
                <Input
                  type="password"
                  placeholder="Password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                />
                <Button onClick={handlePasswordLogin} disabled={loading} className="w-full">
                  {loading ? 'Logging in...' : 'Login'}
                </Button>
                <Button variant="link" className="w-full">
                  Forgot Password?
                </Button>
              </>
            ) : (
              <>
                {!otpSent ? (
                  <Button onClick={handleSendOTP} disabled={loading} className="w-full">
                    {loading ? 'Sending...' : 'Send OTP'}
                  </Button>
                ) : (
                  <>
                    <Input
                      type="text"
                      placeholder="Enter OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                      maxLength={6}
                    />
                    <Button onClick={handleOTPLogin} disabled={loading} className="w-full">
                      {loading ? 'Verifying...' : 'Verify OTP'}
                    </Button>
                  </>
                )}
              </>
            )}
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <Input
              type="tel"
              placeholder="Mobile Number"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
            <Input
              type="text"
              placeholder="Full Name"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <div className="flex gap-2">
              {['Men', 'Women', 'Other'].map(g => (
                <Button
                  key={g}
                  variant={gender === g ? 'default' : 'outline'}
                  onClick={() => setGender(g)}
                  className="flex-1"
                >
                  {g}
                </Button>
              ))}
            </div>
            <Input
              type="password"
              placeholder="Set Password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {!otpSent ? (
              <Button onClick={handleSendOTP} disabled={loading} className="w-full">
                {loading ? 'Sending...' : 'Send OTP'}
              </Button>
            ) : (
              <>
                <Input
                  type="text"
                  placeholder="Enter OTP"
                  value={otp}
                  onChange={(e) => setOtp(e.target.value)}
                  maxLength={6}
                />
                <Button onClick={handleSignup} disabled={loading} className="w-full">
                  {loading ? 'Creating Account...' : 'Create Account'}
                </Button>
              </>
            )}
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
```

---

## ✅ CASHFREE CONFIGURATION

**File:** `/app/backend/.env`

Add these credentials:

```env
CASHFREE_APP_ID=127446912a2e6a73b94b026dabc9644721
CASHFREE_SECRET_KEY=cfsk_ma_prod_16297438908d2358e700396c94ce74c6_4542e6c4
CASHFREE_ENVIRONMENT=production
```

**File:** `/app/backend/cashfree_service.py`

The file already exists. Verify the credentials are loaded from environment variables.

---

## 📊 SUMMARY:

### ✅ Completed (Backend + Partial Frontend):
1. Backend guest booking support
2. Smart routing logic
3. Salon visit tracking

### 🔄 Remaining (Frontend UI):
1. Guest/Login choice UI at checkout
2. Guest details form
3. Enhanced auth modal with password/OTP options
4. Integration of guest data into booking flow

### 💳 Cashfree:
1. Add credentials to .env
2. Test payment flow

---

**Estimated Time to Complete Remaining: 2-3 hours**

**The core logic is implemented. The remaining work is primarily UI/UX integration.**
