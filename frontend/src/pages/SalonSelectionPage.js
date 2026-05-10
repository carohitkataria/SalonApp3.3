import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, Tooltip, useMap } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MapPin, List, Navigation, Scissors, Search, Star, ChevronLeft, ChevronRight, Map as MapIcon, Crosshair
} from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { motion } from 'framer-motion';
// SalonHubLogo removed: header redesigned with eyebrow + title

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

// User location pin — sage pulse
const userLocationIcon = L.divIcon({
  className: 'custom-user-marker',
  html: `<div style="
    width: 18px; height: 18px;
    background: #7E8B7A;
    border: 3px solid #F4ECDD;
    border-radius: 50%;
    box-shadow: 0 0 0 8px rgba(126,139,122,0.22), 0 2px 6px rgba(0,0,0,0.35);
  "></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
  popupAnchor: [0, -12],
});

// Salon marker — brass label flag
const createSalonIcon = (name) => L.divIcon({
  className: 'custom-salon-marker',
  html: `<div style="display:flex;flex-direction:column;align-items:center;min-width:max-content;">
    <div style="
      background: #C9A961;
      color: #1A1814;
      font-family: 'Manrope', sans-serif;
      font-size: 10px;
      font-weight: 700;
      letter-spacing: 0.04em;
      padding: 3px 8px;
      border-radius: 9999px;
      white-space: nowrap;
      box-shadow: 0 4px 10px rgba(0,0,0,0.3);
      max-width: 160px;
      overflow: hidden;
      text-overflow: ellipsis;
    ">${name}</div>
    <div style="
      width: 0; height: 0;
      border-left: 5px solid transparent;
      border-right: 5px solid transparent;
      border-top: 5px solid #C9A961;
      margin-top: -1px;
    "></div>
    <div style="
      width: 9px; height: 9px;
      background: #C9A961;
      border: 2px solid #F4ECDD;
      border-radius: 50%;
      box-shadow: 0 2px 6px rgba(0,0,0,0.35);
      margin-top: -1px;
    "></div>
  </div>`,
  iconSize: [140, 40],
  iconAnchor: [70, 40],
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
            background: '#F7F2E8',
            border: '1px solid rgba(168,132,56,0.35)',
            borderRadius: '9999px',
            padding: '6px 12px',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '11px',
            fontWeight: '600',
            letterSpacing: '0.04em',
            textTransform: 'uppercase',
            color: '#A88438',
            boxShadow: '0 4px 10px rgba(0,0,0,0.18)',
          }}
          title="Go to my location"
        >
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="#A88438" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
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
      const response = await axios.get(`${API}/public/salon-locations?lat=${lat}&lng=${lng}&radius=5`);
      setSalons(response.data || []);
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
      const response = await axios.get(`${API}/public/salon-locations`);
      setSalons(response.data || []);
      setAllSalons(response.data || []);
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
        let url = `${API}/public/salon-locations?name=${encodeURIComponent(query)}`;
        if (selectedCity) {
          url += `&city=${encodeURIComponent(selectedCity)}`;
        }
        const response = await axios.get(url);
        setSalons(response.data || []);
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
      let url = `${API}/public/salon-locations?city=${encodeURIComponent(city)}`;
      const response = await axios.get(url);
      let results = response.data || [];
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
    // Each row is one branch; carry both salon_id (URL) + branch_id (query) so
    // every downstream call can scope to the chosen branch.
    const branchId = salon.branch_id || salon.id;
    const salonId = salon.salon_id || salon.id;
    navigate(`/salon/${salonId}?branch=${branchId}`);
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
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        whileHover={{ y: -2 }}
        className="lux-card group bg-card rounded-2xl overflow-hidden cursor-pointer"
        onClick={() => handleSelectSalon(salon)}
        data-testid={`salon-card-${salon.id}`}
      >
        {/* Image Carousel */}
        <div className="relative h-32 overflow-hidden">
          <img
            src={images[currentImageIndex]}
            alt={salon.salon_name}
            className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-105"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/40 via-transparent to-transparent pointer-events-none" />

          {salon.logo_url && (
            <div className="absolute top-2 left-2 w-9 h-9 bg-card rounded-full p-0.5 ring-1 ring-brass/40 shadow-lux">
              <img
                src={salon.logo_url}
                alt="Logo"
                className="w-full h-full object-contain rounded-full"
              />
            </div>
          )}

          {/* Status badge */}
          {salon.manual_toggle?.is_overridden && (
            <>
              {salon.manual_toggle.is_open ? (
                <div className="absolute top-2 right-2 pill-open inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-sage animate-pulse"></span>
                  Open
                </div>
              ) : salon.manual_toggle.closed_mode === 'online_only' ? (
                <div className="absolute top-2 right-2 pill-amber inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase" title="Closed Online — Visit Salon">
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Visit Only
                </div>
              ) : (
                <div className="absolute top-2 right-2 pill-closed inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[9px] font-bold tracking-widest uppercase">
                  <span className="w-1.5 h-1.5 rounded-full bg-current"></span>
                  Closed
                </div>
              )}
            </>
          )}

          {/* Carousel Controls */}
          {images.length > 1 && (
            <>
              <button
                onClick={prevImage}
                className="absolute left-1.5 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-cream p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Previous image"
              >
                <ChevronLeft className="w-3 h-3" />
              </button>
              <button
                onClick={nextImage}
                className="absolute right-1.5 top-1/2 -translate-y-1/2 bg-black/50 backdrop-blur-sm text-cream p-1 rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                aria-label="Next image"
              >
                <ChevronRight className="w-3 h-3" />
              </button>
              <div className="absolute bottom-1.5 left-1/2 -translate-x-1/2 flex gap-1">
                {images.map((_, index) => (
                  <button
                    key={index}
                    onClick={(e) => goToImage(e, index)}
                    className={`h-1 rounded-full transition-all ${
                      index === currentImageIndex ? 'w-3 bg-cream' : 'w-1 bg-cream/50'
                    }`}
                    aria-label={`Go to image ${index + 1}`}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Content */}
        <div className="p-3">
          <h3 className="font-fraunces font-medium text-[15px] leading-tight text-foreground mb-1 truncate">
            {salon.salon_name}
            {salon.gender_tag && <span className="text-muted-foreground text-xs ml-1 font-normal">({salon.gender_tag})</span>}
          </h3>
          <p className="text-[11px] text-muted-foreground flex items-center mb-2 truncate">
            <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-brass/70" strokeWidth={1.5} />
            {salon.address}
            {salon.distance && <span className="ml-1 text-brass">· {salon.distance} km</span>}
          </p>
          <div className="flex items-center gap-1.5">
            {hasRating ? (
              <div className="flex items-center pill-brass px-1.5 py-0.5 rounded-full">
                <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                <span className="font-semibold text-[11px]">{salon.rating}</span>
              </div>
            ) : (
              <span className="text-[10px] text-muted-foreground italic">No ratings yet</span>
            )}
            {salon.city && (
              <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{salon.city}</span>
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
        whileHover={{ x: 4 }}
        className="group bg-card rounded-2xl overflow-hidden border border-border cursor-pointer hover:border-brass/50 transition-all"
        onClick={() => handleSelectSalon(salon)}
        data-testid={`salon-list-item-${salon.id}`}
      >
        <div className="flex items-center p-3 gap-3">
          <div className="w-16 h-16 flex-shrink-0 rounded-xl overflow-hidden ring-1 ring-border group-hover:ring-brass/40 transition-all">
            <img
              src={image}
              alt={salon.salon_name}
              className="w-full h-full object-cover"
            />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-fraunces font-medium text-[16px] text-foreground truncate leading-tight">
              {salon.salon_name}
              {salon.gender_tag && <span className="text-muted-foreground text-xs ml-1 font-normal">({salon.gender_tag})</span>}
            </h3>
            <p className="text-xs text-muted-foreground flex items-center mt-1 truncate">
              <MapPin className="w-3 h-3 mr-1 flex-shrink-0 text-brass/70" strokeWidth={1.5} />
              {salon.address}
              {salon.distance && <span className="ml-1 text-brass">· {salon.distance} km</span>}
            </p>
            <div className="flex items-center gap-1.5 mt-2">
              {hasRating ? (
                <div className="flex items-center pill-brass px-2 py-0.5 rounded-full">
                  <Star className="w-2.5 h-2.5 mr-0.5 fill-current" />
                  <span className="font-semibold text-[11px]">{salon.rating}</span>
                </div>
              ) : (
                <span className="text-[10px] text-muted-foreground italic">No ratings yet</span>
              )}
              {salon.city && (
                <span className="text-[10px] text-muted-foreground bg-muted px-2 py-0.5 rounded-full">{salon.city}</span>
              )}
              {salon.manual_toggle?.is_overridden && (
                <>
                  {salon.manual_toggle.is_open ? (
                    <span className="text-[9px] pill-open font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 tracking-widest uppercase">
                      <span className="w-1 h-1 rounded-full bg-current animate-pulse"></span>
                      Open
                    </span>
                  ) : salon.manual_toggle.closed_mode === 'online_only' ? (
                    <span className="text-[9px] pill-amber font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 tracking-widest uppercase" title="Closed Online — Visit Salon">
                      <span className="w-1 h-1 rounded-full bg-current"></span>
                      Visit Only
                    </span>
                  ) : (
                    <span className="text-[9px] pill-closed font-bold px-2 py-0.5 rounded-full inline-flex items-center gap-1 tracking-widest uppercase">
                      <span className="w-1 h-1 rounded-full bg-current"></span>
                      Closed
                    </span>
                  )}
                </>
              )}
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-muted-foreground/60 group-hover:text-brass flex-shrink-0 transition-colors" strokeWidth={1.5} />
        </div>
      </motion.div>
    );
  };

  if (loading && salons.length === 0) {
    return (
      <div className="min-h-screen bg-background bg-grain flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-12 h-12 text-brass animate-spin mx-auto mb-4" strokeWidth={1.4} />
          <p className="eyebrow">Finding salons</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Header */}
      <div className="bg-card/70 glass-warm border-b border-border/60 sticky top-0 z-30">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4 ml-14 mr-14">
            <div>
              <span className="eyebrow-brass">Discover</span>
              <h1 className="font-fraunces text-2xl mt-1 font-medium leading-none">Salons near you</h1>
            </div>
            <div className="flex items-center bg-muted rounded-full p-1 border border-border">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('list')}
                data-testid="view-list-btn"
                className={`h-8 px-3 rounded-full ${view === 'list' ? 'bg-brass text-espresso hover:bg-brass-hover' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
              >
                <List className="w-4 h-4" strokeWidth={1.6} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('chips')}
                data-testid="view-grid-btn"
                className={`h-8 px-3 rounded-full ${view === 'chips' ? 'bg-brass text-espresso hover:bg-brass-hover' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
              >
                <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></svg>
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setView('map')}
                data-testid="view-map-btn"
                className={`h-8 px-3 rounded-full ${view === 'map' ? 'bg-brass text-espresso hover:bg-brass-hover' : 'text-muted-foreground hover:text-foreground hover:bg-transparent'}`}
              >
                <MapIcon className="w-4 h-4" strokeWidth={1.6} />
              </Button>
            </div>
          </div>

          {/* Search Bar & Filters */}
          <div className="space-y-3">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Search className="absolute left-3.5 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" strokeWidth={1.6} />
                <Input
                  type="text"
                  placeholder="Search by salon name..."
                  value={searchQuery}
                  onChange={(e) => handleSearchByName(e.target.value)}
                  data-testid="salon-search-input"
                  className="pl-10 h-11 rounded-full border-border focus-visible:border-brass focus-visible:ring-brass bg-card"
                />
              </div>
              {/* Searchable City Dropdown */}
              <div className="relative">
                <button
                  onClick={() => setShowCityDropdown(!showCityDropdown)}
                  data-testid="city-dropdown-btn"
                  className="h-11 px-4 bg-card border border-border rounded-full text-foreground text-sm flex items-center gap-1.5 min-w-[130px] whitespace-nowrap hover:border-brass/50 transition-colors"
                >
                  <MapPin className="w-3.5 h-3.5 flex-shrink-0 text-brass/70" strokeWidth={1.6} />
                  {selectedCity || 'All Cities'}
                  <ChevronRight className={`w-3 h-3 ml-auto transition-transform ${showCityDropdown ? 'rotate-90' : ''}`} />
                </button>
                {showCityDropdown && (
                  <div className="absolute right-0 top-full mt-2 lux-card bg-card rounded-2xl shadow-lux-lg z-50 w-60 max-h-72 overflow-hidden">
                    <div className="p-2 border-b border-border/60">
                      <Input
                        type="text"
                        placeholder="Search city..."
                        value={citySearchQuery}
                        onChange={(e) => setCitySearchQuery(e.target.value)}
                        className="h-9 text-sm rounded-lg"
                        autoFocus
                      />
                    </div>
                    <div className="max-h-52 overflow-y-auto py-1">
                      <button
                        onClick={() => handleCityFilter('')}
                        className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${!selectedCity ? 'bg-brass-soft text-brass font-semibold' : 'text-foreground'}`}
                      >
                        All Cities
                      </button>
                      {filteredCities.map(city => (
                        <button
                          key={city}
                          onClick={() => handleCityFilter(city)}
                          className={`w-full text-left px-3 py-2 text-sm hover:bg-muted transition-colors ${selectedCity === city ? 'bg-brass-soft text-brass font-semibold' : 'text-foreground'}`}
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
                  data-testid="near-me-btn"
                  className="h-9 rounded-full bg-transparent border-border hover:border-brass/50 hover:bg-transparent text-foreground"
                >
                  <Navigation className="w-3.5 h-3.5 mr-2" strokeWidth={1.6} />
                  Near me
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={() => { setSearchQuery(''); setSelectedCity(''); setSalons(allSalons); setSearchType('nearby'); }}
                data-testid="all-salons-btn"
                className="h-9 rounded-full bg-transparent border-border hover:border-brass/50 hover:bg-transparent text-foreground"
              >
                <List className="w-3.5 h-3.5 mr-2" strokeWidth={1.6} />
                All salons
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
      <div className="max-w-7xl mx-auto p-4 sm:p-6">
        {view === 'list' ? (
          <>
            <p className="eyebrow mb-4">
              {searchType === 'nearby' && 'Salons near you'}
              {searchType === 'name' && `Results for "${searchQuery}"`}
              {searchType === 'city' && `In ${selectedCity}`}
              {' · '}{salons.length} found
            </p>
            <div className="space-y-2.5">
              {salons.map((salon) => (
                <SalonListItem key={salon.id} salon={salon} />
              ))}
            </div>
            {salons.length === 0 && (
              <div className="text-center py-20">
                <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.4} />
                <p className="font-fraunces text-lg text-foreground">No salons found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search.</p>
              </div>
            )}
          </>
        ) : view === 'chips' ? (
          <>
            <p className="eyebrow mb-4">
              {searchType === 'nearby' && 'Salons near you'}
              {searchType === 'name' && `Results for "${searchQuery}"`}
              {searchType === 'city' && `In ${selectedCity}`}
              {' · '}{salons.length} found
            </p>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
              {salons.map((salon) => (
                <SalonCard key={salon.id} salon={salon} />
              ))}
            </div>
            {salons.length === 0 && (
              <div className="text-center py-20">
                <Scissors className="w-12 h-12 text-muted-foreground/30 mx-auto mb-4" strokeWidth={1.4} />
                <p className="font-fraunces text-lg text-foreground">No salons found</p>
                <p className="text-sm text-muted-foreground mt-1">Try a different search.</p>
              </div>
            )}
          </>
        ) : (
          <div className="h-[600px] rounded-2xl overflow-hidden relative border border-border">
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
