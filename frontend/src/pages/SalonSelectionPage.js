import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import ActiveBookingTracker from '@/components/ActiveBookingTracker';
import { 
  MapPin, List, Navigation, Scissors, Search, Star, ChevronLeft, ChevronRight, Map as MapIcon, Crosshair
} from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
import SalonHubLogo from '@/components/SalonHubLogo';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// Custom user location icon (blue pulsing dot)
const userLocationIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div style="
    width: 20px; height: 20px; 
    background: #3b82f6; 
    border: 3px solid white; 
    border-radius: 50%; 
    box-shadow: 0 0 0 8px rgba(59,130,246,0.25), 0 2px 6px rgba(0,0,0,0.3);
  "></div>`,
  iconSize: [20, 20],
  iconAnchor: [10, 10],
  popupAnchor: [0, -12],
});

// Custom salon marker icon (gold with label)
const createSalonIcon = (name) => L.divIcon({
  className: 'custom-salon-marker',
  html: `<div style="display:flex;flex-direction:column;align-items:center;min-width:max-content;">
    <div style="
      background: #b8860b; 
      color: white; 
      font-size: 10px; 
      font-weight: 700; 
      padding: 2px 6px; 
      border-radius: 4px; 
      white-space: nowrap; 
      box-shadow: 0 2px 6px rgba(0,0,0,0.3);
      max-width: 140px;
      overflow: hidden;
      text-overflow: ellipsis;
    ">${name}</div>
    <div style="
      width: 0; height: 0; 
      border-left: 6px solid transparent; 
      border-right: 6px solid transparent; 
      border-top: 6px solid #b8860b;
    "></div>
    <div style="
      width: 10px; height: 10px; 
      background: #b8860b; 
      border: 2px solid white; 
      border-radius: 50%; 
      box-shadow: 0 1px 4px rgba(0,0,0,0.3);
      margin-top: -2px;
    "></div>
  </div>`,
  iconSize: [120, 40],
  iconAnchor: [60, 40],
  popupAnchor: [0, -42],
});

// Component to fly to user location
function FlyToMyLocation({ userLocation }) {
  const map = useMap();
  
  const handleClick = () => {
    if (userLocation) {
      map.flyTo([userLocation.lat, userLocation.lng], 14, { duration: 1.5 });
    }
  };

  return (
    <div className="leaflet-top leaflet-right" style={{ top: '10px', right: '10px' }}>
      <div className="leaflet-control">
        <button
          onClick={handleClick}
          style={{
            background: 'white',
            border: '2px solid rgba(0,0,0,0.2)',
            borderRadius: '6px',
            padding: '6px 10px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            fontSize: '12px',
            fontWeight: '600',
            color: '#3b82f6',
            boxShadow: '0 2px 6px rgba(0,0,0,0.15)',
          }}
          title="Go to my location"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#3b82f6" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <circle cx="12" cy="12" r="4"/>
            <line x1="12" y1="2" x2="12" y2="6"/>
            <line x1="12" y1="18" x2="12" y2="22"/>
            <line x1="2" y1="12" x2="6" y2="12"/>
            <line x1="18" y1="12" x2="22" y2="12"/>
          </svg>
          My Location
        </button>
      </div>
    </div>
  );
}

export default function SalonSelectionPage() {
  const navigate = useNavigate();
  const { isUserLoggedIn } = useAuth();
  
  const [salons, setSalons] = useState([]);
  const [allSalons, setAllSalons] = useState([]);
  const [cities, setCities] = useState([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [view, setView] = useState('list'); // 'list', 'chips', or 'map'
  const [userLocation, setUserLocation] = useState(null);
  const [loading, setLoading] = useState(true);
  const [searchType, setSearchType] = useState('nearby'); // 'nearby', 'name', 'city'
  const [citySearchQuery, setCitySearchQuery] = useState('');
  const [showCityDropdown, setShowCityDropdown] = useState(false);
  
  // Get user info from session
  const [userInfo, setUserInfo] = useState(null);

  useEffect(() => {
    // Load user info from localStorage (not sessionStorage)
    try {
      const user = localStorage.getItem('salon_user');
      if (user) {
        const parsedUser = JSON.parse(user);
        console.log('[SalonSelectionPage] Loaded user from localStorage:', parsedUser);
        setUserInfo(parsedUser);
      } else {
        console.log('[SalonSelectionPage] No user found in localStorage');
      }
    } catch (error) {
      console.error('[SalonSelectionPage] Error loading user info:', error);
    }
  }, []);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }

    // Load all salons immediately for faster initial display
    fetchAllSalons();
    fetchCities();
    // Then try to get user location in background
    getUserLocationInBackground();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUserLoggedIn]);

  const fetchCities = async () => {
    try {
      const response = await axios.get(`${API}/cities`);
      setCities(response.data.cities || []);
    } catch (error) {
      console.error('Error fetching cities:', error);
    }
  };

  const getUserLocationInBackground = () => {
    if (navigator.geolocation) {
      // Use a timeout to prevent long waits for location
      const timeoutId = setTimeout(() => {
        // If location takes too long, just keep showing all salons
        console.log('Location request timed out, showing all salons');
      }, 5000);

      navigator.geolocation.getCurrentPosition(
        (position) => {
          clearTimeout(timeoutId);
          const location = {
            lat: position.coords.latitude,
            lng: position.coords.longitude
          };
          setUserLocation(location);
          // Update with nearby salons after getting location
          fetchNearbySalons(location.lat, location.lng);
        },
        (error) => {
          clearTimeout(timeoutId);
          console.error('Error getting location:', error);
          // Keep showing all salons, no need to fetch again
        },
        { timeout: 5000, enableHighAccuracy: false, maximumAge: 300000 }
      );
    }
  };

  const fetchNearbySalons = async (lat, lng) => {
    try {
      const response = await axios.get(`${API}/salons?lat=${lat}&lng=${lng}&radius=5`);
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
      setAllSalons(response.data);
    } catch (error) {
      console.error('Error fetching salons:', error);
      toast.error('Failed to load salons');
    } finally {
      setLoading(false);
    }
  };

  const handleSearchByName = async (query) => {
    setSearchQuery(query);
    // Client-side filtering for instant results
    if (!query || query.length < 1) {
      // Reset to all/nearby salons with city filter applied
      if (selectedCity) {
        const filtered = allSalons.filter(s => 
          s.city && s.city.toLowerCase().includes(selectedCity.toLowerCase())
        );
        setSalons(filtered);
        setSearchType('city');
      } else if (userLocation) {
        fetchNearbySalons(userLocation.lat, userLocation.lng);
      } else {
        setSalons(allSalons);
        setSearchType('nearby');
      }
      return;
    }

    setSearchType('name');
    // Filter from allSalons for instant response, plus apply city filter if active
    let filtered = allSalons.filter(s => 
      s.salon_name.toLowerCase().includes(query.toLowerCase())
    );
    if (selectedCity) {
      filtered = filtered.filter(s => 
        s.city && s.city.toLowerCase().includes(selectedCity.toLowerCase())
      );
    }
    setSalons(filtered);

    // Also fire server search for comprehensive results
    if (query.length >= 2) {
      try {
        let url = `${API}/salons/search?name=${encodeURIComponent(query)}`;
        if (selectedCity) {
          url += `&city=${encodeURIComponent(selectedCity)}`;
        }
        const response = await axios.get(url);
        setSalons(response.data.salons || []);
      } catch (error) {
        // Client-side results are already shown
      }
    }
  };

  const handleCityFilter = async (city) => {
    setSelectedCity(city);
    setShowCityDropdown(false);
    setCitySearchQuery('');
    
    if (!city) {
      if (searchQuery) {
        // Re-apply name search without city filter
        const filtered = allSalons.filter(s => 
          s.salon_name.toLowerCase().includes(searchQuery.toLowerCase())
        );
        setSalons(filtered);
        setSearchType('name');
      } else if (userLocation) {
        fetchNearbySalons(userLocation.lat, userLocation.lng);
      } else {
        setSalons(allSalons);
        setSearchType('nearby');
      }
      return;
    }

    setSearchType('city');
    // Client-side first
    let filtered = allSalons.filter(s => 
      s.city && s.city.toLowerCase().includes(city.toLowerCase())
    );
    if (searchQuery) {
      filtered = filtered.filter(s => 
        s.salon_name.toLowerCase().includes(searchQuery.toLowerCase())
      );
    }
    setSalons(filtered);

    // Also server-side
    try {
      let url = `${API}/salons/by-city?city=${encodeURIComponent(city)}`;
      const response = await axios.get(url);
      let results = response.data.salons || [];
      if (searchQuery) {
        results = results.filter(s => 
          s.salon_name.toLowerCase().includes(searchQuery.toLowerCase())
        );
      }
      setSalons(results);
    } catch (error) {
      // Client-side results are already shown  
    }
  };

  const filteredCities = cities.filter(city => 
    city.toLowerCase().includes(citySearchQuery.toLowerCase())
  );

  const handleSelectSalon = (salon) => {
    navigate(`/salon/${salon.id}`);
  };

  const SalonCard = ({ salon }) => {
    const [currentImageIndex, setCurrentImageIndex] = useState(0);
    
    const images = salon.photo_gallery && salon.photo_gallery.length > 0 
      ? salon.photo_gallery 
      : [salon.logo_url || 'https://images.pexels.com/photos/3993293/pexels-photo-3993293.jpeg?auto=compress&cs=tinysrgb&w=400'];

    const nextImage = (e) => {
      e.stopPropagation();
      setCurrentImageIndex((prev) => (prev + 1) % images.length);
    };

    const prevImage = (e) => {
      e.stopPropagation();
      setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
    };

    const goToImage = (e, index) => {
      e.stopPropagation();
      setCurrentImageIndex(index);
    };

    const hasRating = salon.rating && salon.rating > 0 && salon.total_reviews > 0;
      
    return (
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ scale: 1.02 }}
        className="bg-card rounded-xl overflow-hidden shadow-md hover:shadow-xl transition-all border border-border cursor-pointer"
        onClick={() => handleSelectSalon(salon)}
      >
        {/* Image Carousel */}
        <div className="relative h-24 sm:h-28 overflow-hidden group">
          <img 
            src={images[currentImageIndex]}
            alt={salon.salon_name}
            className="w-full h-full object-cover transition-opacity duration-300"
          />
          {salon.logo_url && (
            <div className="absolute top-1.5 left-1.5 w-8 h-8 bg-white rounded-full p-0.5 shadow-lg">
              <img 
                src={salon.logo_url}
                alt="Logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          )}
          
          {/* Manual Toggle Badge */}
          {salon.manual_toggle?.is_overridden && (
            <>
              {salon.manual_toggle.is_open ? (
                <div className="absolute top-1.5 right-1.5 bg-green-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full animate-pulse"></span>
                  OPEN
                </div>
              ) : (
                <div className="absolute top-1.5 right-1.5 bg-red-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full shadow-lg flex items-center gap-1">
                  <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                  CLOSED
                </div>
              )}
            </>
          )}
          
          {/* Carousel Controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-1 top-1/2 -translate-y-1/2 bg-black/50 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-1 top-1/2 -translate-y-1/2 bg-black/50 text-white p-0.5 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1 left-1/2 -translate-x-1/2 flex space-x-1">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => goToImage(e, index)}
                    className={`w-1 h-1 rounded-full transition-all ${
                      index === currentImageIndex ? 'bg-white w-2' : 'bg-white/50'
                    }`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-2.5">
          <h3 className="font-bold text-sm text-foreground mb-0.5 truncate">
            {salon.salon_name} {salon.gender_tag && `(${salon.gender_tag})`}
          </h3>
          <p className="text-[10px] text-muted-foreground flex items-center mb-1.5 truncate">
            <MapPin className="w-2.5 h-2.5 mr-0.5 flex-shrink-0" />
            {salon.address}
            {salon.distance && ` | ${salon.distance} Kms`}
          </p>
          <div className="flex items-center space-x-1">
            {hasRating ? (
              <div className="flex items-center bg-green-600 text-white px-1.5 py-0.5 rounded text-xs">
                <Star className="w-2.5 h-2.5 mr-0.5 fill-white" />
                <span className="font-bold">{salon.rating}</span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground">No ratings yet</span>
            )}
            {salon.city && (
              <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{salon.city}</span>
            )}
          </div>
        </div>
      </motion.div>
    );
  };

  const SalonListItem = ({ salon }) => {
    const image = salon.logo_url || 
      (salon.photo_gallery && salon.photo_gallery.length > 0 ? salon.photo_gallery[0] : null) ||
      'https://images.pexels.com/photos/3993293/pexels-photo-3993293.jpeg?auto=compress&cs=tinysrgb&w=400';
    const hasRating = salon.rating && salon.rating > 0 && salon.total_reviews > 0;

    return (
      <motion.div
        initial={{ opacity: 0, x: -10 }}
        animate={{ opacity: 1, x: 0 }}
        className="bg-card rounded-xl overflow-hidden border border-border cursor-pointer hover:border-gold/50 hover:shadow-md transition-all"
        onClick={() => handleSelectSalon(salon)}
      >
        <div className="flex items-center p-3 gap-3">
          <div className="w-14 h-14 flex-shrink-0 rounded-lg overflow-hidden">
            <img 
              src={image}
              alt={salon.salon_name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-bold text-sm text-foreground truncate">
              {salon.salon_name} {salon.gender_tag && `(${salon.gender_tag})`}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center truncate">
              <MapPin className="w-3 h-3 mr-0.5 flex-shrink-0" />
              {salon.address}
              {salon.distance && ` | ${salon.distance} Kms`}
            </p>
            <div className="flex items-center gap-2 mt-1">
              {hasRating ? (
                <div className="flex items-center bg-green-600 text-white px-1.5 py-0.5 rounded text-xs">
                  <Star className="w-2.5 h-2.5 mr-0.5 fill-white" />
                  <span className="font-bold">{salon.rating}</span>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground">No ratings yet</span>
              )}
              {salon.city && (
                <span className="text-[10px] text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{salon.city}</span>
              )}
              {/* Manual Toggle Badge */}
              {salon.manual_toggle?.is_overridden && (
                <>
                  {salon.manual_toggle.is_open ? (
                    <span className="text-[10px] bg-green-500 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1 h-1 bg-white rounded-full animate-pulse"></span>
                      OPEN
                    </span>
                  ) : (
                    <span className="text-[10px] bg-red-500 text-white font-bold px-2 py-0.5 rounded-full flex items-center gap-1">
                      <span className="w-1 h-1 bg-white rounded-full"></span>
                      CLOSED
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
        </div>
      </motion.div>
    );
  };

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
      {/* Active Booking Tracker */}
      {userInfo && (
        <ActiveBookingTracker 
          userPhone={userInfo.phone} 
          userName={userInfo.name}
        />
      )}
      
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4 ml-14 mr-14">
            <SalonHubLogo size={36} showText={true} />
            <div className="flex space-x-1 flex-wrap justify-end gap-y-1">
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('list')}
                className={view === 'list' ? 'bg-gold text-black' : ''}
              >
                <List className="w-4 h-4" />
              </Button>
              <Button
                variant={view === 'chips' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('chips')}
                className={view === 'chips' ? 'bg-gold text-black' : ''}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
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
              {/* Searchable City Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCityDropdown(!showCityDropdown)}
                  className="px-3 py-2 bg-background border border-border rounded-md text-foreground text-sm flex items-center gap-1 min-w-[120px] whitespace-nowrap"
                >
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  {selectedCity || 'All Cities'}
                  <ChevronRight className={`w-3 h-3 transition-transform ${showCityDropdown ? 'rotate-90' : ''}`} />
                </button>
                {showCityDropdown && (
                  <div className="absolute right-0 top-full mt-1 bg-card border border-border rounded-lg shadow-xl z-50 w-56 max-h-64 overflow-hidden">
                    <div className="p-2 border-b border-border">
                      <Input
                        type="text"
                        placeholder="Search city..."
                        value={citySearchQuery}
                        onChange={(e) => setCitySearchQuery(e.target.value)}
                        className="h-8 text-sm"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-48 overflow-y-auto">
                      <button
                        onClick={() => handleCityFilter('')}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${!selectedCity ? 'bg-gold/10 text-gold font-bold' : 'text-foreground'}`}
                      >
                        All Cities
                      </button>
                      {filteredCities.map(city => (
                        <button
                          key={city}
                          onClick={() => handleCityFilter(city)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedCity === city ? 'bg-gold/10 text-gold font-bold' : 'text-foreground'}`}
                        >
                          {city}
                        </button>
                      ))}
                      {filteredCities.length === 0 && citySearchQuery && (
                        <p className="text-sm text-muted-foreground text-center py-3">No cities found</p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="flex gap-2">
              {userLocation && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => { setSearchQuery(''); setSelectedCity(''); fetchNearbySalons(userLocation.lat, userLocation.lng); }}
                  className="border-gold/30"
                >
                  <Navigation className="w-4 h-4 mr-2" />
                  Near Me
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(''); setSelectedCity(''); setSalons(allSalons); setSearchType('nearby'); }}
                className="border-gold/30"
              >
                <List className="w-4 h-4 mr-2" />
                All Salons
              </Button>
            </div>
          </div>
        </div>
      </div>

      {/* Close city dropdown on outside click */}
      {showCityDropdown && (
        <div className="fixed inset-0 z-20" onClick={() => setShowCityDropdown(false)} />
      )}

      {/* Content */}
      <div className="max-w-7xl mx-auto p-4">
        {view === 'list' ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {searchType === 'nearby' && 'Salons near you'}
              {searchType === 'name' && `Search results for "${searchQuery}"`}
              {searchType === 'city' && `Salons in ${selectedCity}`}
              {' '}({salons.length} found)
            </p>
            <div className="space-y-2">
              {salons.map((salon) => (
                <SalonListItem key={salon.id} salon={salon} />
              ))}
            </div>
            {salons.length === 0 && (
              <div className="text-center py-12">
                <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4 opacity-30" />
                <p className="text-muted-foreground">No salons found</p>
              </div>
            )}
          </>
        ) : view === 'chips' ? (
          <>
            <p className="text-sm text-muted-foreground mb-3">
              {searchType === 'nearby' && 'Salons near you'}
              {searchType === 'name' && `Search results for "${searchQuery}"`}
              {searchType === 'city' && `Salons in ${selectedCity}`}
              {' '}({salons.length} found)
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
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
          <div className="h-[600px] rounded-lg overflow-hidden relative">
            {(userLocation || salons.length > 0) ? (
              <MapContainer
                center={userLocation 
                  ? [userLocation.lat, userLocation.lng] 
                  : salons.length > 0 
                    ? [salons[0].latitude, salons[0].longitude]
                    : [12.9716, 77.5946]
                }
                zoom={13}
                style={{ height: '100%', width: '100%' }}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />
                
                {userLocation && <FlyToMyLocation userLocation={userLocation} />}
                
                {/* User location marker - blue dot */}
                {userLocation && (
                  <Marker position={[userLocation.lat, userLocation.lng]} icon={userLocationIcon}>
                    <Popup>
                      <div style={{textAlign:'center', fontWeight:'600', color:'#3b82f6'}}>
                        📍 You are here
                      </div>
                    </Popup>
                  </Marker>
                )}

                {/* Salon markers - gold with name label */}
                {salons.map((salon) => (
                  <Marker
                    key={salon.id}
                    position={[salon.latitude, salon.longitude]}
                    icon={createSalonIcon(salon.salon_name)}
                    eventHandlers={{
                      click: () => handleSelectSalon(salon)
                    }}
                  >
                    <Popup>
                      <div className="text-center" style={{minWidth:'120px'}}>
                        <strong style={{fontSize:'14px'}}>{salon.salon_name}</strong>
                        {salon.gender_tag && <span style={{fontSize:'10px', color:'#888'}}> ({salon.gender_tag})</span>}
                        <p style={{fontSize:'12px', color:'#666', margin:'4px 0'}}>{salon.address}</p>
                        {salon.distance && <p style={{fontSize:'11px', color:'#b8860b', fontWeight:'600'}}>{salon.distance} km away</p>}
                        <p style={{fontSize:'11px', color:'#3b82f6', marginTop:'4px', cursor:'pointer'}}>Tap to view →</p>
                      </div>
                    </Popup>
                  </Marker>
                ))}
              </MapContainer>
            ) : (
              <div className="h-full flex items-center justify-center bg-muted/30 rounded-lg">
                <div className="text-center">
                  <MapPin className="w-12 h-12 text-muted-foreground mx-auto mb-3 opacity-40" />
                  <p className="text-muted-foreground font-medium">No salons to display on map</p>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
