import { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, User, MessageSquare, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonBarbersTab({ salonId }) {
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [expandedBarber, setExpandedBarber] = useState(null);
  const [barberProfiles, setBarberProfiles] = useState({});

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

  const fetchBarberProfile = async (barberId) => {
    if (barberProfiles[barberId]) return;
    
    try {
      const response = await axios.get(`${API}/salons/${salonId}/barbers/${barberId}/profile`);
      setBarberProfiles(prev => ({
        ...prev,
        [barberId]: response.data
      }));
    } catch (error) {
      console.error('Error fetching barber profile:', error);
    }
  };

  const handleExpandBarber = (barberId) => {
    if (expandedBarber === barberId) {
      setExpandedBarber(null);
    } else {
      setExpandedBarber(barberId);
      fetchBarberProfile(barberId);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating 
                ? 'text-yellow-500 fill-yellow-500' 
                : 'text-gray-300'
            }`}
          />
        ))}
      </div>
    );
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

      {/* Barbers List */}
      <div className="space-y-4">
        {barbers.length > 0 ? (
          barbers.map((barber) => {
            const profile = barberProfiles[barber.id];
            const isExpanded = expandedBarber === barber.id;

            return (
              <div
                key={barber.id}
                className="bg-card rounded-xl border border-border overflow-hidden"
              >
                {/* Barber Header */}
                <div
                  onClick={() => handleExpandBarber(barber.id)}
                  className="p-4 cursor-pointer hover:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-4">
                    {/* Profile Image */}
                    <div className="w-16 h-16 rounded-full overflow-hidden bg-muted flex-shrink-0 border-2 border-gold/30">
                      {barber.photo_url ? (
                        <img 
                          src={barber.photo_url} 
                          alt={barber.name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center bg-gradient-to-br from-gold/20 to-gold/40">
                          <User className="w-8 h-8 text-gold" />
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1">
                      <div className="flex items-center justify-between">
                        <h3 className="text-lg font-bold text-foreground">{barber.name}</h3>
                        <div className="flex items-center gap-2">
                          <div className="flex items-center bg-yellow-500/10 px-2 py-1 rounded">
                            <Star className="w-4 h-4 text-yellow-500 fill-yellow-500 mr-1" />
                            <span className="text-sm font-medium text-foreground">
                              {barber.rating || profile?.average_rating || '4.5'}
                            </span>
                          </div>
                          {isExpanded ? (
                            <ChevronUp className="w-5 h-5 text-muted-foreground" />
                          ) : (
                            <ChevronDown className="w-5 h-5 text-muted-foreground" />
                          )}
                        </div>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {barber.specialization || 'General Styling'}
                      </p>
                      <div className="flex items-center gap-4 mt-1 text-xs text-muted-foreground">
                        <span>{barber.experience || 0} years exp</span>
                        {(barber.total_reviews || profile?.total_reviews > 0) && (
                          <span>• {barber.total_reviews || profile?.total_reviews} reviews</span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Expanded Content */}
                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      transition={{ duration: 0.2 }}
                      className="overflow-hidden"
                    >
                      <div className="p-4 border-t border-border bg-muted/30">
                        {profile ? (
                          <div className="space-y-6">
                            {/* Services */}
                            {profile.services && profile.services.length > 0 && (
                              <div>
                                <h4 className="font-bold text-foreground mb-3">Services Offered</h4>
                                <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
                                  {profile.services.map((service) => (
                                    <div
                                      key={service.id}
                                      className="bg-background rounded-lg p-3 border border-border"
                                    >
                                      <p className="text-sm font-medium text-foreground">{service.service_name}</p>
                                      <p className="text-gold font-bold">₹{service.barber_price}</p>
                                    </div>
                                  ))}
                                </div>
                              </div>
                            )}

                            {/* Reviews */}
                            <div>
                              <h4 className="font-bold text-foreground mb-3 flex items-center">
                                <MessageSquare className="w-4 h-4 mr-2 text-gold" />
                                Customer Reviews
                                {profile.total_reviews > 0 && (
                                  <span className="ml-2 text-sm font-normal text-muted-foreground">
                                    ({profile.total_reviews} reviews)
                                  </span>
                                )}
                              </h4>
                              
                              {profile.recent_reviews && profile.recent_reviews.length > 0 ? (
                                <div className="space-y-3">
                                  {profile.recent_reviews.map((review) => (
                                    <div
                                      key={review.id}
                                      className="bg-background rounded-lg p-4 border border-border"
                                    >
                                      <div className="flex items-center justify-between mb-2">
                                        <div className="flex items-center gap-2">
                                          <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                                            <User className="w-4 h-4 text-gold" />
                                          </div>
                                          <span className="font-medium text-foreground">
                                            {review.user_name}
                                          </span>
                                        </div>
                                        <div className="flex items-center gap-2">
                                          {renderStars(review.rating)}
                                          <span className="text-xs text-muted-foreground">
                                            {formatDate(review.created_at)}
                                          </span>
                                        </div>
                                      </div>
                                      <p className="text-sm text-muted-foreground">{review.review}</p>
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <p className="text-sm text-muted-foreground text-center py-4">
                                  No reviews yet. Be the first to review!
                                </p>
                              )}
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center justify-center py-8">
                            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-gold"></div>
                          </div>
                        )}
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            );
          })
        ) : (
          <div className="text-center py-12">
            <User className="w-16 h-16 text-muted-foreground/30 mx-auto mb-4" />
            <p className="text-muted-foreground">No barbers available</p>
          </div>
        )}
      </div>
    </div>
  );
}
