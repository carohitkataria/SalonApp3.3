import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Calendar, Users, Clock, TrendingUp, Star } from 'lucide-react';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonDashboardTab({ salon, salonId }) {
  const navigate = useNavigate();
  const [liveStatus, setLiveStatus] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchLiveStatus();
    const interval = setInterval(fetchLiveStatus, 30000);
    return () => clearInterval(interval);
  }, [salonId]);

  const fetchLiveStatus = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/live-status`);
      setLiveStatus(response.data);
    } catch (error) {
      console.error('Error fetching live status:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-gold/20 to-gold/5 rounded-2xl p-6 border border-gold/30">
        <h2 className="text-2xl font-playfair font-bold text-foreground mb-2">
          Welcome to {salon.salon_name}
        </h2>
        <p className="text-muted-foreground mb-4">
          {salon.description || 'Your trusted destination for premium grooming services.'}
        </p>
        <Button 
          onClick={() => navigate(`/book/${salonId}`)}
          className="bg-gold text-black hover:bg-gold/90"
        >
          <Calendar className="w-4 h-4 mr-2" />
          Book Your Appointment
        </Button>
      </div>

      {/* Live Status Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-blue-500/10 rounded-lg">
              <Users className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Current Queue</p>
              <p className="text-2xl font-bold text-foreground">
                {liveStatus?.overall?.waiting_count || 0}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-500/10 rounded-lg">
              <Clock className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Now Serving</p>
              <p className="text-2xl font-bold text-foreground">
                {liveStatus?.overall?.current_token || '-'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-gold/10 rounded-lg">
              <Star className="w-5 h-5 text-gold" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Rating</p>
              <p className="text-2xl font-bold text-foreground">
                {salon.rating || '4.5'}
              </p>
            </div>
          </div>
        </div>

        <div className="bg-card rounded-xl p-4 border border-border">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-purple-500/10 rounded-lg">
              <TrendingUp className="w-5 h-5 text-purple-500" />
            </div>
            <div>
              <p className="text-xs text-muted-foreground">Barbers</p>
              <p className="text-2xl font-bold text-foreground">
                {liveStatus?.barbers?.length || 0}
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Active Barbers */}
      {liveStatus?.barbers && liveStatus.barbers.length > 0 && (
        <div className="bg-card rounded-xl p-6 border border-border">
          <h3 className="text-lg font-bold text-foreground mb-4">Active Barbers Today</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {liveStatus.barbers.map((barber) => (
              <div 
                key={barber.barber_id}
                className="flex items-center gap-3 p-3 bg-background rounded-lg border border-border"
              >
                <div className="w-10 h-10 rounded-full bg-gold/20 flex items-center justify-center">
                  <Users className="w-5 h-5 text-gold" />
                </div>
                <div className="flex-1">
                  <p className="font-medium text-foreground">{barber.barber_name}</p>
                  <p className="text-xs text-muted-foreground">
                    {barber.waiting_count} waiting • {barber.total_tokens_today || 0} served today
                  </p>
                </div>
                {barber.current_token && (
                  <div className="px-2 py-1 bg-green-500/10 rounded text-green-500 text-sm font-medium">
                    #{barber.current_token}
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Quick Links */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        <button
          onClick={() => navigate(`/book/${salonId}`)}
          className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
        >
          <Calendar className="w-6 h-6 text-gold mb-2" />
          <p className="font-medium text-foreground">Book Appointment</p>
          <p className="text-xs text-muted-foreground">Schedule your visit</p>
        </button>
        
        <button
          onClick={() => navigate(`/salon/${salonId}/queue`)}
          className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
        >
          <Clock className="w-6 h-6 text-gold mb-2" />
          <p className="font-medium text-foreground">Live Queue</p>
          <p className="text-xs text-muted-foreground">Check wait times</p>
        </button>

        <button
          onClick={() => navigate(`/salon/${salonId}/services`)}
          className="p-4 bg-card rounded-xl border border-border hover:border-gold transition-colors text-left"
        >
          <Star className="w-6 h-6 text-gold mb-2" />
          <p className="font-medium text-foreground">Our Services</p>
          <p className="text-xs text-muted-foreground">Browse all services</p>
        </button>
      </div>
    </div>
  );
}
