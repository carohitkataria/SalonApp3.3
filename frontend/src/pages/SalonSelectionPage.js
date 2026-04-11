import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { 
  MapPin, List, Navigation, Scissors, Search, Star, ChevronLeft, ChevronRight, Map as MapIcon
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
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-30 shadow-sm">
        <div className="max-w-7xl mx-auto p-4">
          <div className="flex items-center justify-between mb-4 ml-14">
            <SalonHubLogo size={36} showText={true} />
            <div className="flex space-x-1">
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
