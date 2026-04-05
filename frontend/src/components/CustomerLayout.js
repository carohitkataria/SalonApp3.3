import React, { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Menu, X, Home, History, User, HelpCircle, Bug, LogOut, Scissors,
  ChevronDown, ChevronRight, Calendar, ShoppingBag, MapPin, Image as ImageIcon,
  Pin, PinOff
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SalonHubLogo from './SalonHubLogo';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logoutUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    // Load pinned state from localStorage
    const saved = localStorage.getItem('sidebarPinned');
    return saved === 'true';
  });
  const [salonExpanded, setSalonExpanded] = useState(true);
  const [currentSalon, setCurrentSalon] = useState(null);
  const [currentSalonId, setCurrentSalonId] = useState(null);

  // Extract salonId from URL
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    let salonId = null;
    
    // Check for /salon/:salonId or /book/:salonId patterns
    if (pathParts[1] === 'salon' && pathParts[2]) {
      salonId = pathParts[2];
    } else if (pathParts[1] === 'book' && pathParts[2]) {
      salonId = pathParts[2];
    }
    
    if (salonId && salonId !== currentSalonId) {
      setCurrentSalonId(salonId);
      fetchSalonInfo(salonId);
    } else if (!salonId) {
      setCurrentSalonId(null);
      setCurrentSalon(null);
    }
  }, [location.pathname]);

  // Open sidebar automatically if pinned
  useEffect(() => {
    if (isPinned) {
      setSidebarOpen(true);
    }
  }, [isPinned]);

  // Save pinned state to localStorage
  useEffect(() => {
    localStorage.setItem('sidebarPinned', isPinned.toString());
  }, [isPinned]);

  const fetchSalonInfo = async (salonId) => {
    try {
      const response = await axios.get(`${API}/salons/${salonId}`);
      setCurrentSalon(response.data);
    } catch (error) {
      console.error('Error fetching salon info:', error);
    }
  };

  const handleLogout = () => {
    logoutUser();
    navigate('/user/login');
  };

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
    if (!isPinned) {
      setSidebarOpen(true);
    }
  };

  const closeSidebar = () => {
    if (!isPinned) {
      setSidebarOpen(false);
    }
  };

  const menuItems = [
    { icon: Home, label: 'Find New Salon', path: '/salons', action: () => navigate('/salons') },
  ];

  const bottomMenuItems = [
    { icon: History, label: 'My History', path: '/history', action: () => navigate('/history') },
    { icon: User, label: 'My Profile', path: '/profile', action: () => navigate('/profile') },
    { icon: HelpCircle, label: 'Help', path: '/help', action: () => toast.info('Help section coming soon') },
    { icon: Bug, label: 'Report Bug', path: '/report', action: () => toast.info('Bug report form coming soon') },
  ];

  const salonMenuItems = currentSalonId ? [
    { icon: Home, label: 'Dashboard', action: () => navigate(`/salon/${currentSalonId}`) },
    { icon: Calendar, label: 'Book Appointment', action: () => navigate(`/book/${currentSalonId}`) },
    { icon: Scissors, label: 'Services', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'services' })), 100); } },
    { icon: User, label: 'Our Barbers', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'barbers' })), 100); } },
    { icon: ShoppingBag, label: 'Shop', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'shop' })), 100); } },
    { icon: ImageIcon, label: 'Gallery', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'gallery' })), 100); } },
    { icon: MapPin, label: 'About Us', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'profile' })), 100); } },
  ] : [];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop - only show when not pinned */}
            {!isPinned && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={closeSidebar}
                className="fixed inset-0 bg-black/50 z-40"
              />
            )}
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className={`fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 shadow-2xl ${isPinned ? '' : ''}`}
            >
              <div className="p-6 h-full flex flex-col">
                <div className="flex items-center justify-between mb-6">
                  <SalonHubLogo size={32} showText={true} />
                  <div className="flex items-center space-x-2">
                    {/* Pin Button */}
                    <button 
                      onClick={handleTogglePin}
                      className={`p-1.5 rounded-lg transition-colors ${isPinned ? 'bg-gold/20 text-gold' : 'hover:bg-muted text-muted-foreground'}`}
                      title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                    >
                      {isPinned ? <Pin className="w-5 h-5" /> : <PinOff className="w-5 h-5" />}
                    </button>
                    {/* Close Button - only show when not pinned */}
                    {!isPinned && (
                      <button onClick={closeSidebar}>
                        <X className="w-6 h-6 text-foreground" />
                      </button>
                    )}
                  </div>
                </div>
                
                {/* User Info */}
                <div className="mb-4 pb-4 border-b border-border">
                  <p className="text-xs text-muted-foreground">Welcome,</p>
                  <p className="font-medium text-foreground">{user?.name || user?.phone}</p>
                </div>

                <nav className="space-y-2 flex-1 overflow-y-auto">
                  {/* Find New Salon - Always at top */}
                  {menuItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          item.action();
                          closeSidebar();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gold/10 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-gold" />
                        <span className="text-foreground">{item.label}</span>
                      </button>
                    );
                  })}

                  {/* Salon Section - Right below Find New Salon */}
                  {currentSalon && (
                    <div className="mt-2">
                      <button
                        onClick={() => setSalonExpanded(!salonExpanded)}
                        className="w-full flex items-center justify-between px-4 py-3 rounded-lg hover:bg-gold/10 transition-colors bg-gold/5"
                      >
                        <div className="flex items-center space-x-3">
                          {currentSalon.logo_url ? (
                            <img 
                              src={currentSalon.logo_url} 
                              alt={currentSalon.salon_name}
                              className="w-6 h-6 rounded-full object-cover border border-gold"
                            />
                          ) : (
                            <Scissors className="w-5 h-5 text-gold" />
                          )}
                          <span className="text-foreground font-semibold truncate max-w-[140px]">
                            {currentSalon.salon_name}
                          </span>
                        </div>
                        {salonExpanded ? (
                          <ChevronDown className="w-5 h-5 text-muted-foreground" />
                        ) : (
                          <ChevronRight className="w-5 h-5 text-muted-foreground" />
                        )}
                      </button>

                      {/* Collapsible Salon Menu Items */}
                      <AnimatePresence>
                        {salonExpanded && (
                          <motion.div
                            initial={{ height: 0, opacity: 0 }}
                            animate={{ height: 'auto', opacity: 1 }}
                            exit={{ height: 0, opacity: 0 }}
                            transition={{ duration: 0.2 }}
                            className="overflow-hidden"
                          >
                            <div className="pl-4 mt-1 space-y-1">
                              {salonMenuItems.map((item, idx) => {
                                const Icon = item.icon;
                                return (
                                  <button
                                    key={idx}
                                    onClick={() => {
                                      item.action();
                                      closeSidebar();
                                    }}
                                    className="w-full flex items-center space-x-3 px-4 py-2.5 rounded-lg hover:bg-gold/10 transition-colors text-left"
                                  >
                                    <Icon className="w-4 h-4 text-gold/80" />
                                    <span className="text-foreground text-sm">{item.label}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  )}

                  {/* Separator */}
                  <div className="my-3 border-t border-border"></div>

                  {/* Bottom Menu Items */}
                  {bottomMenuItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          item.action();
                          closeSidebar();
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gold/10 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-gold" />
                        <span className="text-foreground">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="pt-4 border-t border-border">
                  <button
                    onClick={handleLogout}
                    className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                  >
                    <LogOut className="w-5 h-5 text-red-500" />
                    <span className="text-red-500 font-semibold">Logout</span>
                  </button>
                </div>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Hamburger Menu Button - Fixed Position (hidden when sidebar is pinned and open) */}
      {!(isPinned && sidebarOpen) && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-50 p-2 bg-gold/90 border border-gold rounded-lg shadow-lg hover:bg-gold transition-colors"
        >
          <Menu className="w-6 h-6 text-black" />
        </button>
      )}

      {/* Main Content - shift when pinned */}
      <div className={`w-full transition-all duration-300 ${isPinned && sidebarOpen ? 'pl-72' : ''}`}>
        {children}
      </div>
    </div>
  );
}
