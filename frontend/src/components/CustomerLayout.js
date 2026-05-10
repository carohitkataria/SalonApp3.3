import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import {
  Menu, X, Home, History, User, HelpCircle, Bug, LogOut, Scissors,
  ChevronDown, ChevronRight, Calendar, ShoppingBag, MapPin, Image as ImageIcon,
  Pin, PinOff, Wallet, Bell
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';
import axios from 'axios';
import SalonHubLogo from './SalonHubLogo';
import ThemeToggle from './ThemeToggle';
import NotificationOptInBanner from './NotificationOptInBanner';
import {
  showBrowserNotification,
  registerNotificationServiceWorker,
  getSeenIds,
  setSeenIds,
} from '@/utils/browserNotifications';
import { useWebSocket } from '@/contexts/WebSocketContext';

const BACKEND_URL = process.env.REACT_APP_BACKEND_URL;
const API = `${BACKEND_URL}/api`;

export default function CustomerLayout({ children }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { user, logoutUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [isPinned, setIsPinned] = useState(() => {
    const saved = localStorage.getItem('sidebarPinned');
    return saved === 'true';
  });
  const [salonExpanded, setSalonExpanded] = useState(true);
  const [currentSalon, setCurrentSalon] = useState(null);
  const [currentSalonId, setCurrentSalonId] = useState(null);
  const [unreadNotifCount, setUnreadNotifCount] = useState(0);

  // Extract salonId from URL and persist salon context
  useEffect(() => {
    const pathParts = location.pathname.split('/');
    let salonId = null;

    if (pathParts[1] === 'salon' && pathParts[2]) {
      salonId = pathParts[2];
    } else if (pathParts[1] === 'book' && pathParts[2]) {
      salonId = pathParts[2];
    }

    if (salonId && salonId !== currentSalonId) {
      setCurrentSalonId(salonId);
      fetchSalonInfo(salonId);
      localStorage.setItem('customer_current_salon_id', salonId);
    } else if (!salonId) {
      if (location.pathname === '/salons') {
        setCurrentSalonId(null);
        setCurrentSalon(null);
        localStorage.removeItem('customer_current_salon_id');
      } else {
        const savedSalonId = localStorage.getItem('customer_current_salon_id');
        if (savedSalonId && !currentSalonId) {
          setCurrentSalonId(savedSalonId);
          fetchSalonInfo(savedSalonId);
        }
      }
    }
  }, [location.pathname]);

  useEffect(() => {
    if (isPinned) setSidebarOpen(true);
  }, [isPinned]);

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

  const { subscribe, unsubscribe } = useWebSocket();
  useEffect(() => {
    const userPhone = user?.phone?.replace('+91', '') || '';
    if (userPhone) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        registerNotificationServiceWorker();
      }

      const storageKey = `seen_notif_customer_${userPhone}`;
      let initialised = false;

      const fetchNotifData = async () => {
        try {
          const countRes = await axios.get(`${API}/notifications/customer/${userPhone}/unread-count`);
          setUnreadNotifCount(countRes.data.unread_count || 0);
        } catch (error) {
          console.error('Error fetching notification count:', error);
        }
        try {
          const listRes = await axios.get(`${API}/notifications/customer/${userPhone}`);
          const notifs = Array.isArray(listRes.data) ? listRes.data : (listRes.data?.notifications || []);
          const seen = getSeenIds(storageKey);
          if (!initialised) {
            notifs.forEach(n => { if (n.id) seen.add(n.id); });
            setSeenIds(storageKey, seen);
            initialised = true;
            return;
          }
          const sorted = [...notifs].sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
          sorted.forEach(n => {
            if (!n.id || seen.has(n.id)) return;
            seen.add(n.id);
            if (n.is_read === false || n.read === false || n.is_read === undefined) {
              showBrowserNotification(
                n.title || 'New Notification',
                n.message || n.body || '',
                { tag: `cust-${n.id}` }
              );
            }
          });
          setSeenIds(storageKey, seen);
        } catch (error) {
          // silent
        }
      };
      fetchNotifData();
      const interval = setInterval(fetchNotifData, 30000);
      return () => clearInterval(interval);
    }
  }, [user]);

  useEffect(() => {
    const userPhone = user?.phone?.replace('+91', '') || '';
    if (!userPhone) return;
    const handleTokenCalled = (data) => {
      try {
        const tokenPhone = (data?.phone || '').replace('+91', '');
        if (!tokenPhone || tokenPhone !== userPhone) return;
        const tokenNo = data?.token_number ? `Token #${data.token_number}` : 'Your token';
        showBrowserNotification(
          'It\'s your turn!',
          `${tokenNo} has been called. Please head to the salon.`,
          { tag: `token-called-${data?.token_id || data?.id || 'na'}`, requireInteraction: true }
        );
      } catch (e) { /* ignore */ }
    };
    subscribe('token_called', handleTokenCalled);
    subscribe('token_recalled', handleTokenCalled);
    return () => {
      unsubscribe('token_called', handleTokenCalled);
      unsubscribe('token_recalled', handleTokenCalled);
    };
  }, [user, subscribe, unsubscribe]);

  const handleLogout = () => {
    logoutUser();
    navigate('/user/login');
  };

  const handleTogglePin = () => {
    setIsPinned(!isPinned);
    if (!isPinned) setSidebarOpen(true);
  };

  const closeSidebar = () => {
    if (!isPinned) setSidebarOpen(false);
  };

  const menuItems = [
    { icon: Home, label: 'Find a Salon', path: '/salons', action: () => navigate('/salons') },
  ];

  const bottomMenuItems = [
    { icon: History, label: 'My History', path: '/history', action: () => navigate('/history') },
    { icon: User, label: 'My Profile', path: '/profile', action: () => navigate('/profile') },
    { icon: HelpCircle, label: 'Help', path: '/help', action: () => toast.info('Help section coming soon') },
    { icon: Bug, label: 'Report Bug', path: '/report', action: () => toast.info('Bug report form coming soon') },
  ];

  const salonMenuItems = currentSalonId ? [
    { icon: Home, label: 'Overview', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'dashboard' })), 100); } },
    { icon: Calendar, label: 'Book Appointment', action: () => navigate(`/book/${currentSalonId}`) },
    { icon: Wallet, label: 'My Wallet', action: () => navigate(`/salon/${currentSalonId}/wallet`) },
    { icon: Scissors, label: 'Services', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'services' })), 100); } },
    { icon: User, label: 'Our Stylists', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'barbers' })), 100); } },
    { icon: ShoppingBag, label: 'Boutique', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'shop' })), 100); } },
    { icon: ImageIcon, label: 'Gallery', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'gallery' })), 100); } },
    { icon: MapPin, label: 'About', action: () => { navigate(`/salon/${currentSalonId}`); setTimeout(() => window.dispatchEvent(new CustomEvent('setTab', { detail: 'profile' })), 100); } },
  ] : [];

  const isActive = (path) => location.pathname === path;

  return (
    <div className="min-h-screen bg-background bg-grain">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {!isPinned && (
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2 }}
                onClick={closeSidebar}
                className="fixed inset-0 bg-black/60 backdrop-blur-sm z-40"
                data-testid="sidebar-backdrop"
              />
            )}

            <motion.aside
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 28, stiffness: 220 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 shadow-lux-lg flex flex-col"
              data-testid="customer-sidebar"
            >
              {/* Header */}
              <div className="px-6 pt-6 pb-4 flex items-center justify-between border-b border-border/60">
                <SalonHubLogo size={32} showText={true} />
                <div className="flex items-center gap-1">
                  <button
                    onClick={handleTogglePin}
                    className={`p-1.5 rounded-md transition-colors ${isPinned ? 'text-brass bg-brass-soft' : 'text-muted-foreground hover:text-brass'}`}
                    title={isPinned ? 'Unpin sidebar' : 'Pin sidebar'}
                    data-testid="sidebar-pin-btn"
                  >
                    {isPinned ? <Pin className="w-4 h-4" /> : <PinOff className="w-4 h-4" />}
                  </button>
                  {!isPinned && (
                    <button onClick={closeSidebar} className="p-1.5 rounded-md text-muted-foreground hover:text-foreground" data-testid="sidebar-close-btn">
                      <X className="w-5 h-5" />
                    </button>
                  )}
                </div>
              </div>

              {/* User Info */}
              <div className="px-6 py-4 border-b border-border/60">
                <p className="eyebrow">Welcome</p>
                <p className="font-fraunces text-lg text-foreground mt-0.5 truncate">
                  {user?.name || user?.phone || 'Guest'}
                </p>
              </div>

              <nav className="flex-1 overflow-y-auto px-3 py-4 space-y-1">
                {menuItems.map((item, idx) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={idx}
                      onClick={() => { item.action(); closeSidebar(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        active ? 'bg-brass-soft text-brass' : 'text-foreground hover:bg-muted'
                      }`}
                      data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}-btn`}
                    >
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}

                {currentSalon && (
                  <div className="pt-2">
                    <button
                      onClick={() => setSalonExpanded(!salonExpanded)}
                      className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg bg-brass-soft/50 hover:bg-brass-soft transition-colors"
                      data-testid="sidebar-salon-toggle-btn"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        {currentSalon.logo_url ? (
                          <img
                            src={currentSalon.logo_url}
                            alt={currentSalon.salon_name}
                            className="w-6 h-6 rounded-full object-cover ring-1 ring-brass/40"
                          />
                        ) : (
                          <Scissors className="w-[18px] h-[18px] text-brass" strokeWidth={1.6} />
                        )}
                        <span className="font-fraunces text-[15px] text-foreground truncate">
                          {currentSalon.salon_name}
                        </span>
                      </div>
                      {salonExpanded
                        ? <ChevronDown className="w-4 h-4 text-muted-foreground" />
                        : <ChevronRight className="w-4 h-4 text-muted-foreground" />}
                    </button>

                    <AnimatePresence>
                      {salonExpanded && (
                        <motion.div
                          initial={{ height: 0, opacity: 0 }}
                          animate={{ height: 'auto', opacity: 1 }}
                          exit={{ height: 0, opacity: 0 }}
                          transition={{ duration: 0.22 }}
                          className="overflow-hidden"
                        >
                          <div className="pl-4 mt-1 space-y-0.5 border-l border-border/60 ml-3">
                            {salonMenuItems.map((item, idx) => {
                              const Icon = item.icon;
                              return (
                                <button
                                  key={idx}
                                  onClick={() => { item.action(); closeSidebar(); }}
                                  className="w-full flex items-center gap-3 px-3 py-2 rounded-md hover:bg-muted text-left transition-colors group"
                                  data-testid={`sidebar-salon-${item.label.toLowerCase().replace(/ /g, '-')}-btn`}
                                >
                                  <Icon className="w-4 h-4 text-muted-foreground group-hover:text-brass" strokeWidth={1.6} />
                                  <span className="text-foreground text-[13px]">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </motion.div>
                      )}
                    </AnimatePresence>
                  </div>
                )}

                <div className="my-3 lux-divider"><span className="text-[10px]">·</span></div>

                {bottomMenuItems.map((item, idx) => {
                  const Icon = item.icon;
                  const active = isActive(item.path);
                  return (
                    <button
                      key={idx}
                      onClick={() => { item.action(); closeSidebar(); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                        active ? 'bg-brass-soft text-brass' : 'text-foreground hover:bg-muted'
                      }`}
                      data-testid={`sidebar-${item.label.toLowerCase().replace(/ /g, '-')}-btn`}
                    >
                      <Icon className="w-[18px] h-[18px]" strokeWidth={1.6} />
                      <span className="text-sm font-medium">{item.label}</span>
                    </button>
                  );
                })}
              </nav>

              {/* Footer with theme toggle + logout */}
              <div className="px-3 py-3 border-t border-border/60 flex items-center gap-2">
                <ThemeToggle />
                <button
                  onClick={handleLogout}
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-border hover:border-bronze hover:text-bronze transition-colors text-sm font-medium text-muted-foreground"
                  data-testid="sidebar-logout-btn"
                >
                  <LogOut className="w-4 h-4" strokeWidth={1.6} />
                  Sign out
                </button>
              </div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Floating chrome — luxury bar with hamburger + bell, top-right */}
      {!(isPinned && sidebarOpen) && (
        <button
          onClick={() => setSidebarOpen(true)}
          className="fixed top-4 left-4 z-40 inline-flex items-center justify-center h-10 w-10 rounded-full bg-card border border-border hover:border-brass/60 shadow-lux transition-colors"
          data-testid="sidebar-open-btn"
          aria-label="Open menu"
        >
          <Menu className="w-[18px] h-[18px] text-brass" strokeWidth={1.6} />
        </button>
      )}

      <button
        onClick={() => navigate('/notifications')}
        className="fixed top-4 right-4 z-40 inline-flex items-center justify-center h-10 w-10 rounded-full bg-card border border-border hover:border-brass/60 shadow-lux transition-colors"
        data-testid="notifications-bell-btn"
        aria-label="Notifications"
      >
        <Bell className="w-[18px] h-[18px] text-brass" strokeWidth={1.6} />
        {unreadNotifCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-bronze text-cream text-[10px] font-bold rounded-full flex items-center justify-center ring-2 ring-background">
            {unreadNotifCount > 9 ? '9+' : unreadNotifCount}
          </span>
        )}
      </button>

      {/* Main Content */}
      <div className={`w-full transition-all duration-300 ${isPinned && sidebarOpen ? 'pl-72' : ''}`}>
        {user && <NotificationOptInBanner />}
        {children}
      </div>
    </div>
  );
}
