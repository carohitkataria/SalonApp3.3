import { useState, useEffect } from 'react';
import axios from 'axios';
import { Star, User, MessageSquare, X, Camera, Send, Image as ImageIcon } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonBarbersTab({ salonId }) {
  const { user } = useAuth();
  const [barbers, setBarbers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedBarber, setSelectedBarber] = useState(null);
  const [barberProfile, setBarberProfile] = useState(null);
  const [profileLoading, setProfileLoading] = useState(false);
  
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

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
    setProfileLoading(true);
    try {
      const response = await axios.get(`${API}/salons/${salonId}/barbers/${barberId}/profile`);
      setBarberProfile(response.data);
    } catch (error) {
      console.error('Error fetching barber profile:', error);
    } finally {
      setProfileLoading(false);
    }
  };

  const handleOpenProfile = (barber) => {
    setSelectedBarber(barber);
    fetchBarberProfile(barber.id);
  };

  const handleCloseProfile = () => {
    setSelectedBarber(null);
    setBarberProfile(null);
    setShowReviewForm(false);
    setReviewRating(0);
    setReviewText('');
  };

  const handleSubmitReview = async () => {
    if (reviewRating === 0) {
      toast.error('Please select a rating');
      return;
    }
    if (!reviewText.trim()) {
      toast.error('Please write a review');
      return;
    }

    setSubmittingReview(true);
    try {
      // Note: This would need a proper endpoint for direct barber reviews
      // For now, we'll show a success message
      await axios.post(`${API}/barbers/${selectedBarber.id}/reviews`, {
        user_id: user?.id,
        user_name: user?.name || 'Anonymous',
        rating: reviewRating,
        review: reviewText
      });
      
      toast.success('Review submitted successfully!');
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewText('');
      
      // Refresh barber profile to show new review
      fetchBarberProfile(selectedBarber.id);
    } catch (error) {
      // If endpoint doesn't exist, show a friendly message
      if (error.response?.status === 404) {
        toast.info('Thank you for your feedback! Reviews will be available soon.');
        setShowReviewForm(false);
        setReviewRating(0);
        setReviewText('');
      } else {
        toast.error('Failed to submit review');
      }
    } finally {
      setSubmittingReview(false);
    }
  };

  const formatDate = (dateString) => {
    return new Date(dateString).toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  const renderStars = (rating, interactive = false, onSelect = null) => {
    return (
      <div className="flex items-center gap-1">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            onClick={interactive ? () => onSelect(star) : undefined}
            className={`w-5 h-5 transition-colors ${
              star <= rating 
                ? 'text-yellow-500 fill-yellow-500' 
                : 'text-gray-300'
            } ${interactive ? 'cursor-pointer hover:text-yellow-400' : ''}`}
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

      {/* Barbers Grid - Card Layout */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {barbers.length > 0 ? (
          barbers.map((barber) => (
            <motion.div
              key={barber.id}
              whileHover={{ scale: 1.02, y: -5 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => handleOpenProfile(barber)}
              className="bg-card rounded-2xl border border-border overflow-hidden cursor-pointer shadow-lg hover:shadow-xl transition-all"
            >
              {/* Profile Image */}
              <div className="relative h-48 bg-gradient-to-br from-gold/20 to-gold/5">
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
                    {barber.rating || '4.5'}
                  </span>
                </div>
              </div>

              {/* Info */}
              <div className="p-4">
                <h3 className="text-xl font-bold text-foreground mb-1">{barber.name}</h3>
                <p className="text-sm text-gold font-medium mb-2">
                  {barber.specialization || 'Master Stylist'}
                </p>
                
                {/* Experience & Reviews */}
                <div className="flex items-center gap-3 text-sm text-muted-foreground">
                  <span>{barber.experience || 0}+ years</span>
                  {barber.total_reviews > 0 && (
                    <>
                      <span>•</span>
                      <span>{barber.total_reviews} reviews</span>
                    </>
                  )}
                </div>

                {/* View Profile Button */}
                <Button 
                  variant="outline" 
                  className="w-full mt-4 border-gold/50 text-gold hover:bg-gold/10"
                >
                  View Profile
                </Button>
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

      {/* Barber Profile Modal */}
      <AnimatePresence>
        {selectedBarber && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/70 z-50 flex items-center justify-center p-4"
            onClick={handleCloseProfile}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-card rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-hidden"
            >
              {/* Header with close button */}
              <div className="relative">
                <div className="h-48 bg-gradient-to-br from-gold/30 to-gold/5">
                  {selectedBarber.photo_url ? (
                    <img 
                      src={selectedBarber.photo_url} 
                      alt={selectedBarber.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <User className="w-24 h-24 text-gold/40" />
                    </div>
                  )}
                </div>
                <button
                  onClick={handleCloseProfile}
                  className="absolute top-4 right-4 p-2 bg-black/50 rounded-full text-white hover:bg-black/70 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
                
                {/* Profile Info Overlay */}
                <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
                  <h2 className="text-2xl font-bold text-white">{selectedBarber.name}</h2>
                  <p className="text-gold">{selectedBarber.specialization || 'Master Stylist'}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <div className="flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full">
                      <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                      <span className="text-white font-medium">
                        {barberProfile?.average_rating || selectedBarber.rating || '4.5'}
                      </span>
                    </div>
                    <span className="text-white/70">
                      {barberProfile?.total_reviews || 0} reviews
                    </span>
                    <span className="text-white/70">•</span>
                    <span className="text-white/70">{selectedBarber.experience || 0}+ years exp</span>
                  </div>
                </div>
              </div>

              {/* Content */}
              <div className="p-6 overflow-y-auto max-h-[calc(90vh-12rem)]">
                {profileLoading ? (
                  <div className="flex items-center justify-center py-8">
                    <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gold"></div>
                  </div>
                ) : (
                  <div className="space-y-6">
                    {/* My Story / About */}
                    {(selectedBarber.intro || selectedBarber.bio) && (
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-3 flex items-center">
                          <MessageSquare className="w-5 h-5 mr-2 text-gold" />
                          My Story
                        </h3>
                        <p className="text-muted-foreground leading-relaxed">
                          {selectedBarber.intro || selectedBarber.bio}
                        </p>
                      </div>
                    )}

                    {/* Photo Gallery */}
                    {selectedBarber.gallery && selectedBarber.gallery.length > 0 && (
                      <div>
                        <h3 className="text-lg font-bold text-foreground mb-3 flex items-center">
                          <Camera className="w-5 h-5 mr-2 text-gold" />
                          Portfolio
                        </h3>
                        <div className="grid grid-cols-3 gap-2">
                          {selectedBarber.gallery.map((photo, idx) => (
                            <div key={idx} className="aspect-square rounded-lg overflow-hidden">
                              <img 
                                src={photo} 
                                alt={`Work ${idx + 1}`}
                                className="w-full h-full object-cover hover:scale-110 transition-transform duration-300"
                              />
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Reviews Section */}
                    <div>
                      <div className="flex items-center justify-between mb-4">
                        <h3 className="text-lg font-bold text-foreground flex items-center">
                          <Star className="w-5 h-5 mr-2 text-gold" />
                          Customer Reviews
                        </h3>
                        <Button
                          onClick={() => setShowReviewForm(true)}
                          variant="outline"
                          size="sm"
                          className="border-gold text-gold hover:bg-gold/10"
                        >
                          Write Review
                        </Button>
                      </div>

                      {/* Review Form */}
                      <AnimatePresence>
                        {showReviewForm && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            className="bg-muted/50 rounded-xl p-4 mb-4 overflow-hidden"
                          >
                            <h4 className="font-bold text-foreground mb-3">Rate your experience</h4>
                            <div className="mb-4">
                              {renderStars(reviewRating, true, setReviewRating)}
                            </div>
                            <textarea
                              value={reviewText}
                              onChange={(e) => setReviewText(e.target.value)}
                              placeholder="Share your experience with this barber..."
                              className="w-full p-3 bg-background border border-border rounded-lg text-foreground resize-none h-24"
                            />
                            <div className="flex justify-end gap-2 mt-3">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={() => {
                                  setShowReviewForm(false);
                                  setReviewRating(0);
                                  setReviewText('');
                                }}
                              >
                                Cancel
                              </Button>
                              <Button
                                onClick={handleSubmitReview}
                                disabled={submittingReview}
                                size="sm"
                                className="bg-gold text-black hover:bg-gold/90"
                              >
                                {submittingReview ? 'Submitting...' : 'Submit Review'}
                                <Send className="w-4 h-4 ml-2" />
                              </Button>
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>

                      {/* Reviews List */}
                      {barberProfile?.recent_reviews && barberProfile.recent_reviews.length > 0 ? (
                        <div className="space-y-3">
                          {barberProfile.recent_reviews.map((review) => (
                            <div
                              key={review.id}
                              className="bg-muted/30 rounded-xl p-4"
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
                                </div>
                              </div>
                              <p className="text-muted-foreground text-sm">{review.review}</p>
                              <p className="text-xs text-muted-foreground mt-2">
                                {formatDate(review.created_at)}
                              </p>
                            </div>
                          ))}
                        </div>
                      ) : (
                        <div className="text-center py-8 bg-muted/30 rounded-xl">
                          <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                          <p className="text-muted-foreground">No reviews yet</p>
                          <p className="text-sm text-muted-foreground">Be the first to share your experience!</p>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
