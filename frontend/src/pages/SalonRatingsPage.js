import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import axios from 'axios';
import { Button } from '@/components/ui/button';
import { ArrowLeft, Star, User, Calendar } from 'lucide-react';
import { motion } from 'framer-motion';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function SalonRatingsPage() {
  const { salonId } = useParams();
  const navigate = useNavigate();
  const { isUserLoggedIn } = useAuth();
  
  const [ratingsData, setRatingsData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!isUserLoggedIn) {
      navigate('/user/login');
      return;
    }
    fetchRatings();
  }, [salonId, isUserLoggedIn]);

  const fetchRatings = async () => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}/ratings?limit=100`);
      setRatingsData(response.data);
    } catch (error) {
      console.error('Error fetching ratings:', error);
    } finally {
      setLoading(false);
    }
  };

  const renderStars = (rating) => {
    return (
      <div className="flex items-center gap-0.5">
        {[1, 2, 3, 4, 5].map((star) => (
          <Star
            key={star}
            className={`w-4 h-4 ${
              star <= rating ? 'text-gold fill-gold' : 'text-muted-foreground/30'
            }`}
          />
        ))}
      </div>
    );
  };

  const formatDate = (dateStr) => {
    try {
      const date = new Date(dateStr);
      return date.toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'short',
        year: 'numeric'
      });
    } catch {
      return '';
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="text-center">
          <Star className="w-12 h-12 text-gold animate-pulse mx-auto mb-4" />
          <p className="text-foreground">Loading ratings...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card border-b border-border sticky top-0 z-20">
        <div className="max-w-4xl mx-auto flex items-center p-3 gap-3">
          <button
            onClick={() => navigate(`/salon/${salonId}`)}
            className="p-2 rounded-full hover:bg-muted transition-colors"
          >
            <ArrowLeft className="w-5 h-5 text-foreground" />
          </button>
          <div className="flex-1">
            <h1 className="text-lg font-playfair font-bold text-foreground">
              Ratings & Reviews
            </h1>
            <p className="text-xs text-muted-foreground">
              {ratingsData?.salon_name || 'Salon'}
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto p-4">
        {/* Rating Summary */}
        <div className="bg-card rounded-xl p-6 border border-border mb-6">
          <div className="flex items-center gap-6">
            <div className="text-center">
              <p className="text-5xl font-bold text-foreground">
                {ratingsData?.average_rating || '-'}
              </p>
              <div className="flex items-center justify-center mt-1">
                {ratingsData?.average_rating > 0 ? renderStars(Math.round(ratingsData.average_rating)) : (
                  <span className="text-sm text-muted-foreground">No ratings</span>
                )}
              </div>
              <p className="text-sm text-muted-foreground mt-1">
                {ratingsData?.total_reviews || 0} review{ratingsData?.total_reviews !== 1 ? 's' : ''}
              </p>
            </div>
            
            {/* Rating Distribution */}
            {ratingsData?.total_reviews > 0 && (
              <div className="flex-1">
                {[5, 4, 3, 2, 1].map((star) => {
                  const count = ratingsData.reviews.filter(r => r.rating === star).length;
                  const percentage = ratingsData.total_reviews > 0 ? (count / ratingsData.total_reviews) * 100 : 0;
                  return (
                    <div key={star} className="flex items-center gap-2 mb-1">
                      <span className="text-xs text-muted-foreground w-3">{star}</span>
                      <Star className="w-3 h-3 text-gold fill-gold" />
                      <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-gold rounded-full transition-all"
                          style={{ width: `${percentage}%` }}
                        />
                      </div>
                      <span className="text-xs text-muted-foreground w-6 text-right">{count}</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Reviews List */}
        {ratingsData?.reviews && ratingsData.reviews.length > 0 ? (
          <div className="space-y-3">
            <h3 className="font-bold text-foreground">All Reviews ({ratingsData.total_reviews})</h3>
            {ratingsData.reviews.map((review, index) => (
              <motion.div
                key={review.id}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: index * 0.05 }}
                className="bg-card rounded-xl p-4 border border-border"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-full bg-gold/20 flex items-center justify-center">
                      <User className="w-4 h-4 text-gold" />
                    </div>
                    <div>
                      <p className="font-medium text-foreground text-sm">{review.user_name || 'Customer'}</p>
                      <p className="text-xs text-muted-foreground">
                        For: {review.barber_name || 'Barber'}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    {renderStars(review.rating)}
                    <p className="text-[10px] text-muted-foreground mt-0.5 flex items-center justify-end gap-0.5">
                      <Calendar className="w-2.5 h-2.5" />
                      {formatDate(review.created_at)}
                    </p>
                  </div>
                </div>
                {review.review && (
                  <p className="text-sm text-muted-foreground mt-2 pl-10">
                    "{review.review}"
                  </p>
                )}
              </motion.div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <Star className="w-16 h-16 text-muted-foreground/20 mx-auto mb-4" />
            <p className="text-lg font-medium text-foreground">No ratings available</p>
            <p className="text-sm text-muted-foreground">
              This salon hasn't received any reviews yet.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
