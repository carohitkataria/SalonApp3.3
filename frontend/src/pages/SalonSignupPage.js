import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Scissors, MapPin, Phone, Mail, User, Building, CreditCard, Lock, Eye, EyeOff, Users } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonSignupPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const phoneFromLogin = location.state?.phone || '';

  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [confirmPassword, setConfirmPassword] = useState('');
  const [formData, setFormData] = useState({
    salon_name: '',
    owner_name: '',
    phone: phoneFromLogin,
    email: '',
    address: '',
    city: '',
    latitude: 0,
    longitude: 0,
    upi_id: '',
    password: '',
    gender_tag: 'Unisex'
  });

  const handleGetLocation = () => {
    if (!navigator.geolocation) {
      toast.error('Geolocation not supported by your browser');
      return;
    }
    
    toast.info('Getting your location...');
    
    navigator.geolocation.getCurrentPosition(
      (position) => {
        setFormData(prev => ({
          ...prev,
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        }));
        toast.success(`Location captured! (${position.coords.latitude.toFixed(4)}, ${position.coords.longitude.toFixed(4)})`);
      },
      (error) => {
        console.error('Geolocation error:', error);
        let errorMsg = 'Could not get location. ';
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMsg += 'Please allow location access in your browser settings.';
            break;
          case error.POSITION_UNAVAILABLE:
            errorMsg += 'Location information unavailable.';
            break;
          case error.TIMEOUT:
            errorMsg += 'Request timed out. Try again.';
            break;
          default:
            errorMsg += 'Please enter coordinates manually.';
        }
        toast.error(errorMsg);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0
      }
    );
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (formData.phone.length < 10) {
      toast.error('Please enter a valid phone number');
      return;
    }

    if (!formData.password || formData.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (formData.password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setLoading(true);
    try {
      await axios.post(`${API}/salon/register`, formData);
      toast.success('Salon registered successfully!');
      toast.info('You can now login with your password');
      navigate('/salon/login', { state: { phone: formData.phone } });
    } catch (error) {
      const raw = error.response?.data?.detail;
      const detailStr = typeof raw === 'string'
        ? raw
        : (raw && typeof raw === 'object' ? (raw.message || raw.detail || JSON.stringify(raw)) : '');
      toast.error(detailStr || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-2xl">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-8"
        >
          <Scissors className="w-16 h-16 text-gold mx-auto mb-4" />
          <h1 className="text-4xl font-playfair font-bold text-foreground mb-2">Register Your Salon</h1>
          <p className="text-muted-foreground">Join our platform and manage your salon digitally</p>
        </motion.div>

        <motion.form
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          onSubmit={handleSubmit}
          className="bg-card border border-border rounded-lg p-8 space-y-6"
        >
          {/* Salon Details */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-card-foreground flex items-center">
              <Building className="w-5 h-5 mr-2 text-gold" />
              Salon Details
            </h3>

            <div>
              <Label htmlFor="salon_name">Salon Name *</Label>
              <Input
                id="salon_name"
                type="text"
                value={formData.salon_name}
                onChange={(e) => setFormData({ ...formData, salon_name: e.target.value })}
                placeholder="The Looks Unisex Salon"
                required
              />
            </div>

            <div>
              <Label htmlFor="owner_name">Owner Name *</Label>
              <Input
                id="owner_name"
                type="text"
                value={formData.owner_name}
                onChange={(e) => setFormData({ ...formData, owner_name: e.target.value })}
                placeholder="John Doe"
                required
              />
            </div>

            <div>
              <Label htmlFor="phone">
                <Phone className="inline w-4 h-4 mr-1" />
                Mobile Number *
              </Label>
              <div className="flex items-center">
                <span className="text-foreground mr-2">+91</span>
                <Input
                  id="phone"
                  type="tel"
                  value={formData.phone}
                  onChange={(e) => setFormData({ ...formData, phone: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                  placeholder="10-digit mobile number"
                  required
                />
              </div>
            </div>

            <div>
              <Label htmlFor="email">
                <Mail className="inline w-4 h-4 mr-1" />
                Email (Optional)
              </Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                placeholder="salon@example.com"
              />
            </div>

            {/* Gender Tag / Salon Type */}
            <div>
              <Label>
                <Users className="inline w-4 h-4 mr-1" />
                Salon Type *
              </Label>
              <div className="grid grid-cols-3 gap-3 mt-2">
                {['Unisex', 'Men', 'Women'].map((type) => (
                  <button
                    key={type}
                    type="button"
                    onClick={() => setFormData({ ...formData, gender_tag: type })}
                    className={`py-3 px-4 rounded-lg border-2 font-semibold transition-all ${
                      formData.gender_tag === type
                        ? 'border-gold bg-gold/10 text-gold'
                        : 'border-border text-muted-foreground hover:border-gold/50'
                    }`}
                  >
                    {type}
                  </button>
                ))}
              </div>
            </div>
          </div>

          {/* Password Section */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-card-foreground flex items-center">
              <Lock className="w-5 h-5 mr-2 text-gold" />
              Set Password
            </h3>

            <div>
              <Label htmlFor="password">Password *</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={formData.password}
                  onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                  placeholder="Min 6 characters"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <Label htmlFor="confirmPassword">Confirm Password *</Label>
              <div className="relative">
                <Input
                  id="confirmPassword"
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter password"
                  required
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                >
                  {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-card-foreground flex items-center">
              <MapPin className="w-5 h-5 mr-2 text-gold" />
              Location
            </h3>

            <div>
              <Label htmlFor="address">Full Address *</Label>
              <Input
                id="address"
                type="text"
                value={formData.address}
                onChange={(e) => setFormData({ ...formData, address: e.target.value })}
                placeholder="123 Main Street, City, State, PIN"
                required
              />
            </div>

            <div>
              <Label htmlFor="city">City *</Label>
              <Input
                id="city"
                type="text"
                value={formData.city}
                onChange={(e) => setFormData({ ...formData, city: e.target.value })}
                placeholder="e.g., Bangalore, Mumbai, Delhi"
                required
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="latitude">Latitude *</Label>
                <Input
                  id="latitude"
                  type="number"
                  step="0.0001"
                  value={formData.latitude}
                  onChange={(e) => setFormData({ ...formData, latitude: parseFloat(e.target.value) || 0 })}
                  placeholder="12.9716"
                  required
                />
              </div>
              <div>
                <Label htmlFor="longitude">Longitude *</Label>
                <Input
                  id="longitude"
                  type="number"
                  step="0.0001"
                  value={formData.longitude}
                  onChange={(e) => setFormData({ ...formData, longitude: parseFloat(e.target.value) || 0 })}
                  placeholder="77.5946"
                  required
                />
              </div>
            </div>

            <Button type="button" onClick={handleGetLocation} variant="outline" className="w-full">
              <MapPin className="mr-2 w-4 h-4" />
              Use My Current Location
            </Button>
          </div>

          {/* Payment */}
          <div className="space-y-4">
            <h3 className="text-lg font-bold text-card-foreground flex items-center">
              <CreditCard className="w-5 h-5 mr-2 text-gold" />
              Payment Details (Optional)
            </h3>

            <div>
              <Label htmlFor="upi_id">UPI ID</Label>
              <Input
                id="upi_id"
                type="text"
                value={formData.upi_id}
                onChange={(e) => setFormData({ ...formData, upi_id: e.target.value })}
                placeholder="yourname@upi"
              />
            </div>
          </div>

          <Button
            type="submit"
            disabled={loading}
            className="w-full bg-gold text-black hover:bg-gold/90 py-6"
          >
            {loading ? 'Registering...' : 'Register Salon'}
          </Button>

          <div className="text-center">
            <button
              type="button"
              onClick={() => navigate('/salon/login')}
              className="text-sm text-muted-foreground hover:text-gold transition-colors"
            >
              Already registered? Login here
            </button>
          </div>
        </motion.form>
      </div>
    </div>
  );
}
