import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MapPin, List, Navigation, Scissors, Search, Star, Clock, 
  Menu, X, Home, History, User, HelpCircle, Bug, LogOut, Map as MapIcon
} from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

export default function SalonSelectionPage() {
  const navigate = useNavigate();
  const { user, isUserLoggedIn, logoutUser } = useAuth();
  
  const [salons, setSalons] = useState([]);
  const [cities, setCities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [view, setView] = useState('grid'); // 'grid' or 'map'
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [searchType, setSearchType] = useState('nearby'); // 'nearby', 'name', 'city'

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }

    fetchCities();
    getUserLocation();
  }, [isUserLoggedIn]);

  const fetchCities = async () => {
    try {
      const response = await axios.get(`${API}/cities`);
      setCities(response.data.cities || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const getUserLocation = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          fetchNearbySalons(location.lat, location.lng);
        },
        (error) => {
          console.error('Error getting location:', error);
          toast.info('Showing all salons');
          fetchAllSalons();
        }
      );
    } else {
      fetchAllSalons();
    }
  };

  const fetchNearbySalons = async (lat, lng) => {
    try {
      const response = await axios.get(`${API}/salons?lat=${lat}&lng=${lng}&radius=50`);
      setSalons(response.data);
      setSearchType('nearby');
    } catch (error) {
      console.error('Error fetching salons:', error);
      toast.error('Failed to load salons');
    } finally {
      setLoading(false);
    }
  };

  const fetchAllSalons = async () => {
    try {
      const response = await axios.get(`${API}/salons`);
      setSalons(response.data);
    } catch (error) {
      console.error('Error fetching salons:', error);
      toast.error('Failed to load salons');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchByName = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      if (userLocation) {
        fetchNearbySalons(userLocation.lat, userLocation.lng);
      } else {
        fetchAllSalons();
      }
      return;
    }

    setLoading(true);
    setSearchType('name');
    try {
      const response = await axios.get(`${API}/salons/search?name=${query}`);
      setSalons(response.data.salons || []);
    } catch (error) {
      console.error('Error searching salons:', error);
      toast.error('Failed to search salons');
    } finally {
      setLoading(false);
    }
  };

  const handleCityFilter = async (city) => {
    setSelectedCity(city);
    if (!city) {
      if (userLocation) {
        fetchNearbySalons(userLocation.lat, userLocation.lng);
      } else {
        fetchAllSalons();
      }
      return;
    }

    setLoading(true);
    setSearchType('city');
    try {
      const response = await axios.get(`${API}/salons/by-city?city=${city}`);
      setSalons(response.data.salons || []);
    } catch (error) {
      console.error('Error filtering by city:', error);
      toast.error('Failed to filter salons');
    } finally {
      setLoading(false);
    }
  };

  const handleSelectSalon = (salon) => {
    navigate(`/book/${salon.id}`);
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/user/login');
  };

  const SalonCard = ({ salon }) => {
    const firstImage = salon.photo_gallery && salon.photo_gallery.length > 0 
      ? salon.photo_gallery[0] 
      : salon.logo_url || 'https://images.pexels.com/photos/3993293/pexels-photo-3993293.jpeg?auto=compress&cs=tinysrgb&w=400';
      
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        className="bg-card rounded-2xl overflow-hidden shadow-lg hover:shadow-2xl transition-all border border-border cursor-pointer"
        onClick={() => handleSelectSalon(salon)}
      >
        {/* Image */}
        <div className="relative h-48 overflow-hidden">
          <img 
            src={firstImage}
            alt={salon.salon_name}
            className="w-full h-full object-cover"
          />
          {salon.logo_url && (
            <div className="absolute top-3 left-3 w-12 h-12 bg-white rounded-full p-1 shadow-lg">
              <img 
                src={salon.logo_url}
                alt="Logo"
                className="w-full h-full object-contain"
              />
            </div>
          )}
          {/* Optional Offer Banner */}
          <div className="absolute bottom-0 left-0 right-0 bg-blue-600 text-white text-center py-2 text-sm font-semibold">
            Book Now via App
          </div>
        </div>

        {/* Content */}
        <div className="p-4">
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h3 className="font-bold text-lg text-foreground mb-1">{salon.salon_name}</h3>
              <p className="text-xs text-muted-foreground flex items-center mb-2">
                <MapPin className="w-3 h-3 mr-1" />
                {salon.address}
                {salon.distance && ` | ${salon.distance} Kms`}
              </p>
            </div>
            <div className="flex items-center space-x-1 ml-2">
              <span className="text-xs text-muted-foreground">{salon.gender_tag || 'Unisex'}</span>
              <span className="text-xs text-muted-foreground">| ₹₹</span>
            </div>
          </div>

          {/* Rating */}
          <div className="flex items-center space-x-2">
            <div className="flex items-center bg-green-600 text-white px-2 py-1 rounded">
              <span className="w-2 h-2 bg-white rounded-full mr-1"></span>
              <span className="text-sm font-bold">{salon.rating || 4.5}</span>
            </div>
          </div>
        </div>
      </motion.div>
    );
  };

  const menuItems = [
    { icon: Home, label: 'Find My Salon', path: '/salons', action: () => {} },
    { icon: History, label: 'My History', path: '/history', action: () => navigate('/history') },
    { icon: User, label: 'My Profile', path: '/profile', action: () => toast.info('Profile coming soon') },
    { icon: HelpCircle, label: 'Help', path: '/help', action: () => toast.info('Help section coming soon') },
    { icon: Bug, label: 'Report Bug', path: '/report', action: () => toast.info('Bug report form coming soon') },
  ];

  if (loading && salons.length === 0) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
          <p className="text-foreground">Finding salons...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <Scissors className="w-8 h-8 text-gold" />
                    <div>
                      <h2 className="font-bold text-foreground">Menu</h2>
                      <p className="text-xs text-muted-foreground">{user?.name}</p>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)}>
                    <X className="w-6 h-6 text-foreground" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {menuItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          item.action();
                          setSidebarOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gold/10 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-gold" />
                        <span className="text-foreground">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="absolute bottom-6 left-6 right-6">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-semibold">Logout</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center space-x-3">
              <button onClick={() => setSidebarOpen(true)}>
                <Menu className="w-6 h-6 text-foreground" />
              </button>
              <Scissors className="w-8 h-8 text-gold" />
              <div>
                <h1 className="text-xl font-playfair font-bold text-foreground">Find Salons</h1>
                <p className="text-xs text-muted-foreground">Discover the best near you</p>
              </div>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={view === 'grid' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('grid')}
                className={view === 'grid' ? 'bg-gold text-black' : ''}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('map')}
                className={view === 'map' ? 'bg-gold text-black' : ''}
              >
                <MapIcon className="w-4 h-4" />
              </Button>
            </div>
          </div>

          {/* Search Bar & Filters */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                <Input
                  type="text"
                  placeholder="Search salon by name..."
                  value={searchQuery}
                  onChange={(e) => handleSearchByName(e.target.value)}
                  className="pl-10"
                />
              </div>
              <select
                value={selectedCity}
                onChange={(e) => handleCityFilter(e.target.value)}
                className="px-4 py-2 bg-background border border-border rounded-md text-foreground"
              >
                <option value="">All Cities</option>
                {cities.map(city => (
                  <option key={city} value={city}>{city}</option>
                ))}
              </select>
            </div>

            {userLocation && (
              <Button
                variant="outline"
                size="sm"
                onClick={() => fetchNearbySalons(userLocation.lat, userLocation.lng)}
                className="border-gold/30"
              >
                <Navigation className="w-4 h-4 mr-2" />
                Find Salons Near Me
              </Button>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {view === 'grid' ? (
          <>
            <p className="text-sm text-muted-foreground mb-4">
              {searchType === 'nearby' && 'Salons near you'}
              {searchType === 'name' && `Search results for "${searchQuery}"`}
              {searchType === 'city' && `Salons in ${selectedCity}`}
              {' '}({salons.length} found)
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {salons.map((salon) => (
                <SalonCard key={salon.id} salon={salon} />
              ))}
            </div>
            {salons.length === 0 && (
              <div className="text-center py-12">
                <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No salons found</p>
              </div>
            )}
          </>
        ) : (
          <div className="h-[600px] rounded-lg overflow-hidden">
            {userLocation && (
              <MapContainer
                center={[userLocation.lat, userLocation.lng]}
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                <Marker position={[userLocation.lat, userLocation.lng]}>
                  <Popup>Your Location</Popup>
                </Marker>

                {salons.map((salon) => (
                  <Marker
                    key={salon.id}
                    position={[salon.latitude, salon.longitude]}
                    eventHandlers={{
                      click: () => handleSelectSalon(salon)
                    }}
                  >
                    <Popup>
                      <div className="text-center">
                        <strong>{salon.salon_name}</strong>
                        <p className="text-sm">{salon.address}</p>
                        {salon.distance && <p className="text-xs text-gold">{salon.distance} km away</p>}
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
