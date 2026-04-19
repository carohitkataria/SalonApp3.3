import { useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { 
  Scissors, Clock, Bell, Star, Users, Calendar, 
  Smartphone, MapPin, TrendingUp, CheckCircle, Sparkles,
  MessageSquare, Shield, Zap
} from 'lucide-react';
import { motion } from 'framer-motion';
import SalonHubLogo from '@/components/SalonHubLogo';

// Google Color Palette
const colors = {
  blue: '#4285F4',
  red: '#EA4335',
  yellow: '#FBBC05',
  green: '#34A853'
};

export default function LandingPage() {
  const navigate = useNavigate();

  const features = [
    {
      icon: Clock,
      title: 'Real-Time Queue Management',
      description: 'Skip the wait! Get live token updates and know exactly when it\'s your turn.',
      color: colors.blue,
      gradient: 'from-blue-500 to-blue-600'
    },
    {
      icon: Bell,
      title: 'WhatsApp Notifications',
      description: 'Receive instant booking confirmations and queue updates right on WhatsApp.',
      color: colors.green,
      gradient: 'from-green-500 to-green-600'
    },
    {
      icon: Users,
      title: 'Choose Your Barber',
      description: 'Book with your favorite barber or discover new talent. View ratings and specialties.',
      color: colors.red,
      gradient: 'from-red-500 to-red-600'
    },
    {
      icon: Sparkles,
      title: 'Membership & Rewards',
      description: 'Unlock exclusive benefits with salon membership plans and loyalty rewards.',
      color: colors.yellow,
      gradient: 'from-yellow-500 to-yellow-600'
    },
    {
      icon: MapPin,
      title: 'Find Salons Nearby',
      description: 'Discover top-rated salons near you with interactive maps and filters.',
      color: colors.blue,
      gradient: 'from-blue-500 to-cyan-500'
    },
    {
      icon: Star,
      title: 'Reviews & Ratings',
      description: 'Make informed choices with authentic reviews and detailed barber ratings.',
      color: colors.green,
      gradient: 'from-green-500 to-emerald-600'
    }
  ];

  const stats = [
    { label: 'Active Salons', value: '500+', color: colors.blue },
    { label: 'Happy Customers', value: '50K+', color: colors.red },
    { label: 'Bookings Daily', value: '2K+', color: colors.yellow },
    { label: 'Avg Rating', value: '4.8★', color: colors.green }
  ];

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 via-white to-gray-100">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-white/80 backdrop-blur-lg border-b border-gray-200 shadow-sm">
        <div className="container mx-auto px-4 py-4 flex items-center justify-between">
          <SalonHubLogo size={40} showText={true} />
          <Button 
            onClick={() => navigate('/login')}
            className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-semibold px-6 py-2 rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
          >
            Login
          </Button>
        </div>
      </header>

      {/* Hero Section */}
      <section className="relative overflow-hidden py-20 px-4">
        <div className="absolute inset-0 bg-gradient-to-br from-blue-50 via-green-50 to-yellow-50 opacity-50"></div>
        <div className="container mx-auto relative z-10">
          <motion.div 
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8 }}
            className="text-center max-w-4xl mx-auto"
          >
            <div className="inline-flex items-center gap-2 bg-gradient-to-r from-blue-500/10 to-green-500/10 border border-blue-200 rounded-full px-4 py-2 mb-6">
              <Zap size={16} className="text-blue-600" />
              <span className="text-sm font-medium text-gray-700">Smart Salon Booking Platform</span>
            </div>
            
            <h1 className="text-4xl sm:text-5xl lg:text-6xl font-extrabold mb-6 leading-tight">
              <span className="bg-gradient-to-r from-blue-600 via-green-600 to-red-600 bg-clip-text text-transparent">
                Book Your Perfect
              </span>
              <br />
              <span className="text-gray-800">Salon Experience</span>
            </h1>
            
            <p className="text-base sm:text-lg text-gray-600 mb-8 max-w-2xl mx-auto leading-relaxed">
              Skip the queues, choose your barber, and get real-time updates. 
              Discover the smartest way to book salon appointments with live queue management and WhatsApp notifications.
            </p>
            
            <div className="flex flex-col sm:flex-row gap-4 justify-center items-center">
              <Button 
                onClick={() => navigate('/login')}
                size="lg"
                className="bg-gradient-to-r from-blue-500 to-blue-600 hover:from-blue-600 hover:to-blue-700 text-white font-bold px-8 py-6 text-lg rounded-full shadow-xl hover:shadow-2xl transition-all duration-300 transform hover:scale-105"
              >
                <Smartphone className="mr-2" size={20} />
                Get Started
              </Button>
              <Button 
                onClick={() => navigate('/salon/login')}
                size="lg"
                variant="outline"
                className="border-2 border-green-500 text-green-600 hover:bg-green-50 font-bold px-8 py-6 text-lg rounded-full shadow-lg hover:shadow-xl transition-all duration-300"
              >
                <Scissors className="mr-2" size={20} />
                For Salons
              </Button>
            </div>
          </motion.div>

          {/* Stats Bar */}
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.3 }}
            className="mt-16 grid grid-cols-2 md:grid-cols-4 gap-6 max-w-4xl mx-auto"
          >
            {stats.map((stat, idx) => (
              <div 
                key={idx}
                className="bg-white rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-xl transition-shadow duration-300"
              >
                <div className="text-3xl font-bold mb-1" style={{ color: stat.color }}>
                  {stat.value}
                </div>
                <div className="text-sm text-gray-600 font-medium">{stat.label}</div>
              </div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-20 px-4 bg-white">
        <div className="container mx-auto">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-800">
              Everything You Need in One App
            </h2>
            <p className="text-base text-gray-600 max-w-2xl mx-auto">
              A complete booking experience designed for modern salon-goers and businesses
            </p>
          </motion.div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8 max-w-6xl mx-auto">
            {features.map((feature, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 30 }}
                whileInView={{ opacity: 1, y: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.1 }}
                className="group bg-gradient-to-br from-white to-gray-50 rounded-2xl p-6 shadow-lg border border-gray-100 hover:shadow-2xl hover:border-gray-200 transition-all duration-300 cursor-pointer"
              >
                <div 
                  className={`w-14 h-14 rounded-xl bg-gradient-to-br ${feature.gradient} flex items-center justify-center mb-4 group-hover:scale-110 transition-transform duration-300 shadow-md`}
                >
                  <feature.icon size={28} className="text-white" />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-800 group-hover:text-gray-900">
                  {feature.title}
                </h3>
                <p className="text-sm text-gray-600 leading-relaxed">
                  {feature.description}
                </p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works Section */}
      <section className="py-20 px-4 bg-gradient-to-br from-blue-50 via-white to-green-50">
        <div className="container mx-auto max-w-5xl">
          <motion.div 
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            className="text-center mb-16"
          >
            <h2 className="text-3xl sm:text-4xl font-bold mb-4 text-gray-800">
              How It Works
            </h2>
            <p className="text-base text-gray-600">
              Get started in just three simple steps
            </p>
          </motion.div>

          <div className="grid md:grid-cols-3 gap-8">
            {[
              {
                step: '1',
                title: 'Find & Choose',
                description: 'Browse nearby salons, view services, and pick your favorite barber',
                icon: MapPin,
                color: colors.blue
              },
              {
                step: '2',
                title: 'Book Instantly',
                description: 'Select your services and confirm your booking in seconds',
                icon: Calendar,
                color: colors.red
              },
              {
                step: '3',
                title: 'Track Live',
                description: 'Get real-time queue updates and WhatsApp notifications',
                icon: MessageSquare,
                color: colors.green
              }
            ].map((item, idx) => (
              <motion.div
                key={idx}
                initial={{ opacity: 0, x: -20 }}
                whileInView={{ opacity: 1, x: 0 }}
                viewport={{ once: true }}
                transition={{ duration: 0.5, delay: idx * 0.15 }}
                className="relative bg-white rounded-2xl p-8 shadow-xl border border-gray-100 hover:shadow-2xl transition-all duration-300"
              >
                <div 
                  className="absolute -top-4 -left-4 w-12 h-12 rounded-full flex items-center justify-center text-white font-bold text-xl shadow-lg"
                  style={{ backgroundColor: item.color }}
                >
                  {item.step}
                </div>
                <div className="mb-4 mt-4">
                  <item.icon size={40} style={{ color: item.color }} />
                </div>
                <h3 className="text-xl font-bold mb-3 text-gray-800">{item.title}</h3>
                <p className="text-sm text-gray-600">{item.description}</p>
              </motion.div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 bg-gradient-to-r from-blue-600 via-green-600 to-blue-600">
        <div className="container mx-auto max-w-4xl text-center">
          <motion.div
            initial={{ opacity: 0, scale: 0.9 }}
            whileInView={{ opacity: 1, scale: 1 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
          >
            <h2 className="text-3xl sm:text-4xl font-bold text-white mb-6">
              Ready to Experience Hassle-Free Salon Booking?
            </h2>
            <p className="text-lg text-white/90 mb-8 max-w-2xl mx-auto">
              Join thousands of happy customers who save time and enjoy a seamless salon experience
            </p>
            <Button 
              onClick={() => navigate('/login')}
              size="lg"
              className="bg-white text-blue-600 hover:bg-gray-100 font-bold px-10 py-6 text-lg rounded-full shadow-2xl hover:shadow-3xl transition-all duration-300 transform hover:scale-105"
            >
              <Smartphone className="mr-2" size={20} />
              Start Booking Now
            </Button>
          </motion.div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-gray-900 text-white py-12 px-4">
        <div className="container mx-auto text-center">
          <div className="flex items-center justify-center gap-3 mb-4">
            <SalonHubLogo size={32} />
            <span className="text-xl font-bold">SalonHub</span>
          </div>
          <p className="text-gray-400 text-sm mb-4">
            Modern salon booking platform with real-time queue management
          </p>
          <div className="flex justify-center gap-6 text-sm text-gray-400">
            <button onClick={() => navigate('/login')} className="hover:text-white transition-colors">
              Customer Login
            </button>
            <span>•</span>
            <button onClick={() => navigate('/salon/login')} className="hover:text-white transition-colors">
              Salon Login
            </button>
          </div>
          <div className="mt-6 text-xs text-gray-500">
            © 2024 SalonHub. All rights reserved.
          </div>
        </div>
      </footer>
    </div>
  );
}
