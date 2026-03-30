import React from 'react';
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { MapPin, List, Navigation, Scissors, Search, Star, Clock } from 'lucide-react';
import { toast } from 'sonner';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

// Fix Leaflet icon issue
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: require('leaflet/dist/images/marker-icon-2x.png'),
  iconUrl: require('leaflet/dist/images/marker-icon.png'),
  shadowUrl: require('leaflet/dist/images/marker-shadow.png'),
});

function LocationUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, 13);
    }
  }, [center, map]);
  return null;
}

export default function SalonSelectionPage() {
  const navigate = useNavigate();
  const { user, isUserLoggedIn } = useAuth();
  const [salons, setSalons] = useState([]);
  const [lastVisitedSalon, setLastVisitedSalon] = useState(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [view, setView] = useState('list'); // 'list' or 'map'
  const [userLocation, setUserLocation] = useState(null);
  const [radius, setRadius] = useState(2);
  const [loading, setLoading] = useState(true);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }

    fetchLastVisitedSalon();
    getUserLocation();
  }, [isUserLoggedIn]);

  const fetchLastVisitedSalon = async () => {
    try {
      if (user && user.phone) {
        const response = await axios.get(`${API}/users/last-salon?phone=${user.phone}`);
        if (response.data.salon) {
          setLastVisitedSalon(response.data.salon);
        }
      }
    } catch (error) {
      console.error('Error fetching last salon:', error);
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
      const response = await axios.get(`${API}/salons?lat=${lat}&lng=${lng}&radius=${radius}`);
      setSalons(response.data);
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

  const handleSearch = async (query) => {
    setSearchQuery(query);
    if (query.length < 2) {
      setSearchResults([]);
      return;
    }

    setSearching(true);
    try {
      const response = await axios.get(`${API}/salons/search?name=${query}`);
      setSearchResults(response.data.salons || []);
    } catch (error) {
      console.error('Error searching salons:', error);
      toast.error('Failed to search salons');
    } finally {
      setSearching(false);
    }
  };

  const handleRadiusChange = (newRadius) => {
    setRadius(newRadius);
    if (userLocation) {
      setLoading(true);
      fetchNearbySalons(userLocation.lat, userLocation.lng);
    }
  };

  const handleSelectSalon = (salon) => {
    navigate(`/book/${salon.id}`);
  };

  const SalonCard = ({ salon, isLastVisited = false }) => (
    <div
      className={`bg-card border ${isLastVisited ? 'border-gold border-2' : 'border-border'} rounded-lg p-6 hover:shadow-lg transition-shadow cursor-pointer relative`}
      onClick={() => handleSelectSalon(salon)}
    >
      {isLastVisited && (
        <div className="absolute top-2 right-2 bg-gold text-black text-xs px-2 py-1 rounded flex items-center">
          <Clock className="w-3 h-3 mr-1" />
          Last Visited
        </div>
      )}
      <div className="flex items-start space-x-4">
        <Scissors className="w-10 h-10 text-gold" />
        <div className="flex-1">
          <h3 className="text-lg font-bold text-card-foreground mb-1">{salon.salon_name}</h3>
          <p className="text-sm text-muted-foreground mb-2">{salon.address}</p>
          {salon.distance && (
            <div className="flex items-center text-xs text-gold">
              <Navigation className="w-3 h-3 mr-1" />
              {salon.distance} km away
            </div>
          )}
        </div>
      </div>
      <Button className="w-full mt-4 bg-gold text-black hover:bg-gold/90">
        {isLastVisited ? 'Book Again' : 'Select Salon'}
      </Button>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Scissors className="w-16 h-16 text-gold animate-spin mx-auto mb-4" />
          <p className="text-foreground">Finding salons near you...</p>
        </div>
      </div>
    );
  }

  const displaySalons = searchQuery ? searchResults : salons;

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="border-b border-border p-4">
        <div className="max-w-7xl mx-auto">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h1 className="text-2xl font-playfair font-bold text-foreground">Select Salon</h1>
              <p className="text-sm text-muted-foreground">Choose a salon near you</p>
            </div>
            <div className="flex space-x-2">
              <Button
                variant={view === 'list' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('list')}
              >
                <List className="w-4 h-4 mr-2" /> List
              </Button>
              <Button
                variant={view === 'map' ? 'default' : 'outline'}
                size="sm"
                onClick={() => setView('map')}
              >
                <MapPin className="w-4 h-4 mr-2" /> Map
              </Button>
            </div>
          </div>

          {/* Search Bar */}
          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                type="text"
                placeholder="Search salon by name..."
                value={searchQuery}
                onChange={(e) => handleSearch(e.target.value)}
                className="pl-10"
              />
              {searching && (
                <div className="absolute right-3 top-1/2 transform -translate-y-1/2">
                  <Scissors className="w-4 h-4 text-gold animate-spin" />
                </div>
              )}
            </div>
          </div>

          {/* Radius Filter - only show when not searching */}
          {userLocation && !searchQuery && (
            <div className="flex items-center space-x-4">
              <label className="text-sm text-foreground">Radius: {radius} km</label>
              <Input
                type="range"
                min="1"
                max="10"
                value={radius}
                onChange={(e) => handleRadiusChange(parseInt(e.target.value))}
                className="w-48"
              />
            </div>
          )}
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-4">
        {/* Last Visited Salon */}
        {lastVisitedSalon && !searchQuery && (
          <div className="mb-6">
            <h2 className="text-lg font-semibold text-foreground mb-3 flex items-center">
              <Star className="w-5 h-5 text-gold mr-2" />
              Your Last Visit
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              <SalonCard salon={lastVisitedSalon} isLastVisited={true} />
            </div>
          </div>
        )}

        {/* Salons List/Map */}
        {view === 'list' ? (
          <>
            {!searchQuery && lastVisitedSalon && (
              <h2 className="text-lg font-semibold text-foreground mb-3 mt-6">
                {userLocation ? 'Nearby Salons' : 'All Salons'}
              </h2>
            )}
            {searchQuery && (
              <h2 className="text-lg font-semibold text-foreground mb-3">
                Search Results ({displaySalons.length})
              </h2>
            )}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {displaySalons.map((salon) => (
                <SalonCard 
                  key={salon.id} 
                  salon={salon} 
                  isLastVisited={false}
                />
              ))}
            </div>
            {displaySalons.length === 0 && (
              <div className="text-center py-12">
                <Scissors className="w-16 h-16 text-muted-foreground mx-auto mb-4" />
                <p className="text-muted-foreground">
                  {searchQuery ? 'No salons found matching your search' : 'No salons available'}
                </p>
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
                <LocationUpdater center={[userLocation.lat, userLocation.lng]} />
                
                {/* User location marker */}
                <Marker position={[userLocation.lat, userLocation.lng]}>
                  <Popup>Your Location</Popup>
                </Marker>

                {/* Salon markers */}
                {displaySalons.map((salon) => (
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
