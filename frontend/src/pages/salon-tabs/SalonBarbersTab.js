import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, User, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';
import { Button } from '@/components/ui/button';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonBarbersTab({ salonId }) {
  const navigate = useNavigate();
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBarbers();
  }, [salonId]);

  const fetchBarbers = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/barbers`);
      setBarbers(response.data);
    } catch (error) {
      console.error('Error fetching barbers:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewProfile = (barberId) => {
    navigate(`/salon/${salonId}/barber/${barberId}`);
  };

  const handleBookNow = (barberId) => {
    navigate(`/book/${salonId}?barber=${barberId}`);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-playfair font-bold text-foreground">Our Barbers</h2>
        <p className="text-muted-foreground">Meet our talented team of professionals</p>
      </div>

      {/* Barbers Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {barbers.length > 0 ? (
          barbers.map((barber) => (
            <motion.div
              key={barber.id}
              whileHover={{ scale: 1.02, y: -5 }}
              className="bg-card rounded-2xl border border-border overflow-hidden shadow-lg hover:shadow-xl transition-all"
            >
              {/* Profile Image */}
              <div 
                className="relative h-48 bg-gradient-to-br from-gold/20 to-gold/5 cursor-pointer"
                onClick={() => handleViewProfile(barber.id)}
              >
                {barber.photo_url ? (
                  <img 
                    src={barber.photo_url} 
                    alt={barber.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center">
                    <User className="w-20 h-20 text-gold/40" />
                  </div>
                )}
                {/* Rating Badge */}
                <div className="absolute top-3 right-3 bg-black/70 backdrop-blur-sm px-3 py-1 rounded-full flex items-center gap-1">
                  <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                  <span className="text-sm font-bold text-white">
                    {(barber.rating && barber.total_reviews > 0) ? barber.rating : 'New'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 
                  className="text-xl font-bold text-foreground mb-1 cursor-pointer hover:text-gold transition-colors"
                  onClick={() => handleViewProfile(barber.id)}
                >
                  {barber.name}
                </h3>
                <p className="text-sm text-gold font-medium mb-2">
                  {barber.specialization || 'Master Stylist'}
                </p>
                
                {/* Experience & Reviews */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground mb-4">
                  <span>{barber.experience || 0}+ years</span>
                  {barber.total_reviews > 0 && (
                    <>
                      <span>•</span>
                      <span>{barber.total_reviews} reviews</span>
                    </>
                  )}
                </div>

                {/* Action Buttons */}
                <div className="flex gap-2">
                  <Button 
                    variant="outline" 
                    className="flex-1 border-border hover:border-gold"
                    onClick={() => handleViewProfile(barber.id)}
                  >
                    View Profile
                  </Button>
                  <Button 
                    className="flex-1 bg-gold text-black hover:bg-gold/90"
                    onClick={() => handleBookNow(barber.id)}
                  >
                    <Calendar className="w-4 h-4 mr-1" />
                    Book Now
                  </Button>
                </div>
              </div>
            </motion.div>
          ))
        ) : (
          <div className="col-span-full text-center py-12">
            <User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No barbers available</p>
          </div>
        )}
      </div>
    </div>
  );
}
