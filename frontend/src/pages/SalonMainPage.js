import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { 
  Scissors, Calendar, User, ShoppingBag, MapPin, Image, 
  Home, Star, Phone, Mail, Clock, ChevronRight, ArrowLeft
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Tab Components
import SalonDashboardTab from './salon-tabs/SalonDashboardTab';
import SalonServicesTab from './salon-tabs/SalonServicesTab';
import SalonBarbersTab from './salon-tabs/SalonBarbersTab';
import SalonGalleryTab from './salon-tabs/SalonGalleryTab';
import SalonProfileTab from './salon-tabs/SalonProfileTab';
import SalonShopTab from './salon-tabs/SalonShopTab';

export default function SalonMainPage() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { isUserLoggedIn } = useAuth();
  
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const tabs = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'booking', label: 'Book Appointment', icon: Calendar },
    { id: 'services', label: 'Services', icon: Scissors },
    { id: 'barbers', label: 'Our Barbers', icon: User },
    { id: 'shop', label: 'Shop', icon: ShoppingBag },
    { id: 'gallery', label: 'Gallery', icon: Image },
    { id: 'profile', label: 'About Us', icon: MapPin },
  ];

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login', { state: { from: `/salon/${salonId}` } });
      return;
    }
    fetchSalonData();
  }, [isUserLoggedIn, salonId]);

  const fetchSalonData = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}`);
      setSalon(response.data);
    } catch (error) {
      console.error('Error fetching salon:', error);
      toast.error('Failed to load salon information');
      navigate('/salons');
    } finally {
      setLoading(false);
    }
  };

  const handleTabClick = (tabId) => {
    if (tabId === 'booking') {
      navigate(`/book/${salonId}`);
    } else {
      setActiveTab(tabId);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
          <p className="text-foreground">Loading salon...</p>
        </div>
      </div>
    );
  }

  if (!salon) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground">Salon not found</p>
          <Button onClick={() => navigate('/salons')} className="mt-4">
            Back to Salons
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-7xl mx-auto">
          {/* Back button and salon info */}
          <div className="flex items-center p-4 gap-4">
            <button 
              onClick={() => navigate('/salons')}
              className="p-2 rounded-full hover:bg-muted transition-colors"
            >
              <ArrowLeft className="w-5 h-5 text-foreground" />
            </button>
            
            <div className="flex items-center gap-3 flex-1">
              {salon.logo_url ? (
                <img 
                  src={salon.logo_url} 
                  alt={salon.salon_name}
                  className="w-12 h-12 rounded-full object-cover border-2 border-gold"
                />
              ) : (
                <div className="w-12 h-12 rounded-full bg-gold/20 flex items-center justify-center">
                  <Scissors className="w-6 h-6 text-gold" />
                </div>
              )}
              <div>
                <h1 className="text-xl font-playfair font-bold text-foreground">
                  {salon.salon_name}
                </h1>
                <div className="flex items-center text-sm text-muted-foreground">
                  <MapPin className="w-3 h-3 mr-1" />
                  <span className="truncate max-w-[200px]">{salon.address}</span>
                </div>
              </div>
            </div>

            {/* Quick Book Button */}
            <Button 
              onClick={() => navigate(`/book/${salonId}`)}
              className="bg-gold text-black hover:bg-gold/90"
            >
              <Calendar className="w-4 h-4 mr-2" />
              Book Now
            </Button>
          </div>

          {/* Navigation Tabs */}
          <div className="flex overflow-x-auto scrollbar-hide border-t border-border">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabClick(tab.id)}
                  className={`flex items-center gap-2 px-4 py-3 whitespace-nowrap transition-colors border-b-2 ${
                    activeTab === tab.id
                      ? 'border-gold text-gold'
                      : 'border-transparent text-muted-foreground hover:text-foreground'
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span className="text-sm font-medium">{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
      </div>

      {/* Tab Content */}
      <div className="max-w-7xl mx-auto p-4">
        <AnimatePresence mode="wait">
          <motion.div
            key={activeTab}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.2 }}
          >
            {activeTab === 'dashboard' && <SalonDashboardTab salon={salon} salonId={salonId} />}
            {activeTab === 'services' && <SalonServicesTab salonId={salonId} />}
            {activeTab === 'barbers' && <SalonBarbersTab salonId={salonId} />}
            {activeTab === 'shop' && <SalonShopTab salonId={salonId} />}
            {activeTab === 'gallery' && <SalonGalleryTab salon={salon} />}
            {activeTab === 'profile' && <SalonProfileTab salon={salon} />}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  );
}
