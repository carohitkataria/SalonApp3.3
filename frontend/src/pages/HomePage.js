import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Button } from '@/components/ui/button';
import { Scissors, MapPin, Calendar, User as UserIcon } from 'lucide-react';
import { motion } from 'framer-motion';
import ThemeToggle from '@/components/ThemeToggle';

export default function HomePage() {
  const navigate = useNavigate();
  const { user, isUserLoggedIn, logoutUser } = useAuth();

  return (
    <div className="min-h-screen bg-background">
      {/* Hero Section */}
      <div className="relative h-[60vh] bg-gradient-to-b from-obsidian to-background flex items-center justify-center overflow-hidden">
        <div className="absolute inset-0 opacity-10">
          <div className="absolute inset-0" style={{
            backgroundImage: `url('https://images.unsplash.com/photo-1585747860715-2ba37e788b70?w=1200&q=80')`,
            backgroundSize: 'cover',
            backgroundPosition: 'center'
          }} />
        </div>
        
        <div className="relative z-10 text-center px-4">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6 }}
          >
            <Scissors className="w-20 h-20 text-gold mx-auto mb-6" />
            <h1 className="text-5xl md:text-7xl font-playfair font-bold text-white mb-4">
              The Looks
            </h1>
            <p className="text-xl md:text-2xl text-zinc-300 mb-8 tracking-widest uppercase">
              Unisex Salon
            </p>
            <Button
              onClick={() => navigate('/salons')}
              size="lg"
              className="bg-gold text-black hover:bg-gold/90 text-lg px-12 py-6"
            >
              <MapPin className="mr-2" /> Find Salon Near You
            </Button>
          </motion.div>
        </div>
      </div>

      {/* User Info & Actions */}
      <div className="max-w-7xl mx-auto px-4 py-12">
        <div className="bg-card border border-border rounded-lg p-6 mb-8" data-testid="home-user-card">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-gold/20 rounded-full flex items-center justify-center">
                <UserIcon className="w-6 h-6 text-gold" />
              </div>
              {isUserLoggedIn && user ? (
                <div>
                  <p className="text-sm text-muted-foreground">Welcome back,</p>
                  <p className="text-lg font-bold text-foreground">{user.name}</p>
                  <p className="text-xs text-muted-foreground">{user.phone}</p>
                </div>
              ) : (
                <div>
                  <p className="text-sm text-muted-foreground">Welcome,</p>
                  <p className="text-lg font-bold text-foreground">Browse salons freely</p>
                  <p className="text-xs text-muted-foreground">Sign in for faster bookings &amp; history</p>
                </div>
              )}
            </div>
            <div className="flex items-center space-x-2">
              <ThemeToggle />
              {isUserLoggedIn ? (
                <Button onClick={logoutUser} variant="outline" size="sm" data-testid="home-logout-btn">
                  Logout
                </Button>
              ) : (
                <Button onClick={() => navigate('/login')} size="sm" className="bg-gold text-black hover:bg-gold/90" data-testid="home-signin-btn">
                  Sign In
                </Button>
              )}
            </div>
          </div>
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.2 }}
          >
            <button
              onClick={() => navigate('/salons')}
              className="w-full bg-card border-2 border-border hover:border-gold p-8 rounded-lg text-left transition-all group"
            >
              <MapPin className="w-12 h-12 text-gold mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-playfair font-bold text-foreground mb-2">Find Salons</h3>
              <p className="text-muted-foreground">Discover salons near you with live queue info</p>
            </button>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <button
              onClick={() => navigate('/history')}
              className="w-full bg-card border-2 border-border hover:border-gold p-8 rounded-lg text-left transition-all group"
            >
              <Calendar className="w-12 h-12 text-gold mb-4 group-hover:scale-110 transition-transform" />
              <h3 className="text-2xl font-playfair font-bold text-foreground mb-2">My Bookings</h3>
              <p className="text-muted-foreground">View your booking history and active tokens</p>
            </button>
          </motion.div>
        </div>

        {/* Features */}
        <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6 text-center">
          <div className="p-6">
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <MapPin className="w-8 h-8 text-gold" />
            </div>
            <h4 className="font-bold text-foreground mb-2">Location Based</h4>
            <p className="text-sm text-muted-foreground">Find salons within 2km radius</p>
          </div>
          <div className="p-6">
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Scissors className="w-8 h-8 text-gold" />
            </div>
            <h4 className="font-bold text-foreground mb-2">Multiple Services</h4>
            <p className="text-sm text-muted-foreground">Choose from 10+ salon services</p>
          </div>
          <div className="p-6">
            <div className="w-16 h-16 bg-gold/10 rounded-full flex items-center justify-center mx-auto mb-4">
              <Calendar className="w-8 h-8 text-gold" />
            </div>
            <h4 className="font-bold text-foreground mb-2">Easy Booking</h4>
            <p className="text-sm text-muted-foreground">Book for today or tomorrow</p>
          </div>
        </div>
      </div>
    </div>
  );
}