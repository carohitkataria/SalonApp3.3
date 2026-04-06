import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import { Star, User, MessageSquare, ArrowLeft, Camera, Send, Calendar, Clock } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { toast } from 'sonner';
import { useAuth } from '@/contexts/AuthContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function BarberProfilePage() {
  const { salonId, barberId } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  
  const [barber, setBarber] = useState(null);
  const [barberProfile, setBarberProfile] = useState(null);
  const [salon, setSalon] = useState(null);
  const [loading, setLoading] = useState(true);
  
  // Review form state
  const [showReviewForm, setShowReviewForm] = useState(false);
  const [reviewRating, setReviewRating] = useState(0);
  const [reviewText, setReviewText] = useState('');
  const [submittingReview, setSubmittingReview] = useState(false);

  useEffect(() => {
    fetchData();
  }, [salonId, barberId]);

  const fetchData = async () => {
    try {
      const [barberRes, profileRes, salonRes] = await Promise.all([
        axios.get(`${API}/salons/${salonId}/barbers`),
        axios.get(`${API}/salons/${salonId}/barbers/${barberId}/profile`),
        axios.get(`${API}/salons/${salonId}`)
      ]);
      
      const foundBarber = barberRes.data.find(b => b.id === barberId);
      setBarber(foundBarber);
      setBarberProfile(profileRes.data);
      setSalon(salonRes.data);
    } catch (error) {
      console.error('Error fetching barber data:', error);
      toast.error('Failed to load barber profile');
    } finally {
      setLoading(false);
    }
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
      await axios.post(`${API}/barbers/${barberId}/reviews`, {
        user_id: user?.id,
        user_name: user?.name || 'Anonymous',
        rating: reviewRating,
        review: reviewText
      });
      
      toast.success('Review submitted successfully!');
      setShowReviewForm(false);
      setReviewRating(0);
      setReviewText('');
      fetchData();
    } catch (error) {
      if (error.response?.status === 404) {
        toast.info('Thank you for your feedback!');
        setShowReviewForm(false);
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

  const renderStars = (rating, interactive = false, onSelect = null) => (
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

  const handleBookNow = () => {
    navigate(`/book/${salonId}?barber=${barberId}`);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gold"></div>
      </div>
    );
  }

  if (!barber) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <p className="text-foreground mb-4">Barber not found</p>
          <Button onClick={() => navigate(`/salon/${salonId}`)}>Back to Salon</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-2xl mx-auto flex items-center p-4 gap-4">
          <button 
            onClick={() => navigate(`/salon/${salonId}`)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="font-bold text-foreground">{barber.name}</h1>
            <p className="text-xs text-muted-foreground">{salon?.salon_name}</p>
          </div>
          <Button 
            onClick={handleBookNow}
            className="bg-gold text-black hover:bg-gold/90"
            size="sm"
          >
            <Calendar className="w-4 h-4 mr-1" />
            Book Now
          </Button>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Hero Section */}
        <div className="relative h-64 bg-gradient-to-br from-gold/30 to-gold/5">
          {barber.photo_url ? (
            <img 
              src={barber.photo_url} 
              alt={barber.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <User className="w-32 h-32 text-gold/40" />
            </div>
          )}
          
          {/* Overlay Info */}
          <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-6">
            <h2 className="text-3xl font-bold text-white">{barber.name}</h2>
            <p className="text-gold text-lg">{barber.specialization || 'Master Stylist'}</p>
            <div className="flex items-center gap-4 mt-3">
              <div className="flex items-center gap-1 bg-black/50 px-3 py-1 rounded-full">
                <Star className="w-4 h-4 text-yellow-500 fill-yellow-500" />
                <span className="text-white font-bold">
                  {barberProfile?.average_rating || barber.rating || '4.5'}
                </span>
              </div>
              <span className="text-white/70">
                {barberProfile?.total_reviews || 0} reviews
              </span>
              <span className="text-white/70">•</span>
              <span className="text-white/70">{barber.experience || 0}+ years exp</span>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Quick Stats */}
          <div className="grid grid-cols-3 gap-4">
            <div className="bg-card rounded-xl p-4 text-center border border-border">
              <p className="text-2xl font-bold text-gold">{barber.experience || 0}+</p>
              <p className="text-xs text-muted-foreground">Years Exp</p>
            </div>
            <div className="bg-card rounded-xl p-4 text-center border border-border">
              <p className="text-2xl font-bold text-foreground">{barberProfile?.total_reviews || 0}</p>
              <p className="text-xs text-muted-foreground">Reviews</p>
            </div>
            <div className="bg-card rounded-xl p-4 text-center border border-border">
              <div className="flex items-center justify-center gap-1">
                <Star className="w-5 h-5 text-yellow-500 fill-yellow-500" />
                <p className="text-2xl font-bold text-foreground">{barberProfile?.average_rating || '4.5'}</p>
              </div>
              <p className="text-xs text-muted-foreground">Rating</p>
            </div>
          </div>

          {/* My Story */}
          {(barber.intro || barber.bio) && (
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center">
                <MessageSquare className="w-5 h-5 mr-2 text-gold" />
                My Story
              </h3>
              <p className="text-muted-foreground leading-relaxed">
                {barber.intro || barber.bio}
              </p>
            </div>
          )}

          {/* Portfolio */}
          {barber.gallery && barber.gallery.length > 0 && (
            <div className="bg-card rounded-xl p-5 border border-border">
              <h3 className="text-lg font-bold text-foreground mb-3 flex items-center">
                <Camera className="w-5 h-5 mr-2 text-gold" />
                Portfolio
              </h3>
              <div className="grid grid-cols-3 gap-2">
                {barber.gallery.map((photo, idx) => (
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
          <div className="bg-card rounded-xl p-5 border border-border">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-bold text-foreground flex items-center">
                <Star className="w-5 h-5 mr-2 text-gold" />
                Customer Reviews
              </h3>
              <Button
                onClick={() => setShowReviewForm(!showReviewForm)}
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
                    placeholder="Share your experience..."
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
                      {submittingReview ? 'Submitting...' : 'Submit'}
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
                  <div key={review.id} className="bg-background rounded-xl p-4 border border-border">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                          <User className="w-4 h-4 text-gold" />
                        </div>
                        <span className="font-medium text-foreground">{review.user_name}</span>
                      </div>
                      {renderStars(review.rating)}
                    </div>
                    <p className="text-muted-foreground text-sm">{review.review}</p>
                    <p className="text-xs text-muted-foreground mt-2">{formatDate(review.created_at)}</p>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8 bg-muted/30 rounded-xl">
                <MessageSquare className="w-12 h-12 text-muted-foreground/30 mx-auto mb-3" />
                <p className="text-muted-foreground">No reviews yet</p>
                <p className="text-sm text-muted-foreground">Be the first to review!</p>
              </div>
            )}
          </div>

          {/* Book Now CTA */}
          <div className="sticky bottom-4">
            <Button 
              onClick={handleBookNow}
              className="w-full bg-gold text-black hover:bg-gold/90 py-6 text-lg font-bold rounded-xl shadow-lg"
            >
              <Calendar className="w-5 h-5 mr-2" />
              Book Appointment with {barber.name}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
