import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { 
  Menu, X, Home, History, User, HelpCircle, Bug, LogOut, Scissors
} from 'lucide-react';
import { toast } from 'sonner';
import { motion, AnimatePresence } from 'framer-motion';

export default function CustomerLayout({ children }) {
  const navigate = useNavigate();
  const { user, logoutUser } = useAuth();
  const [sidebarOpen, setSidebarOpen] = useState(false);

  const handleLogout = () => {
    logoutUser();
    navigate('/user/login');
  };

  const menuItems = [
    { icon: Home, label: 'Find My Salon', path: '/salons', action: () => navigate('/salons') },
    { icon: History, label: 'My History', path: '/history', action: () => navigate('/history') },
    { icon: User, label: 'My Profile', path: '/profile', action: () => toast.info('Profile coming soon') },
    { icon: HelpCircle, label: 'Help', path: '/help', action: () => toast.info('Help section coming soon') },
    { icon: Bug, label: 'Report Bug', path: '/report', action: () => toast.info('Bug report form coming soon') },
  ];

  return (
    <div className="min-h-screen bg-background">
      {/* Sidebar */}
      <AnimatePresence>
        {sidebarOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setSidebarOpen(false)}
              className="fixed inset-0 bg-black/50 z-40"
            />
            
            {/* Sidebar */}
            <motion.div
              initial={{ x: -300 }}
              animate={{ x: 0 }}
              exit={{ x: -300 }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed left-0 top-0 bottom-0 w-72 bg-card border-r border-border z-50 shadow-2xl"
            >
              <div className="p-6">
                <div className="flex items-center justify-between mb-8">
                  <div className="flex items-center space-x-3">
                    <Scissors className="w-8 h-8 text-gold" />
                    <div>
                      <h2 className="font-bold text-foreground">Menu</h2>
                      <p className="text-xs text-muted-foreground">{user?.name || user?.phone}</p>
                    </div>
                  </div>
                  <button onClick={() => setSidebarOpen(false)}>
                    <X className="w-6 h-6 text-foreground" />
                  </button>
                </div>

                <nav className="space-y-2">
                  {menuItems.map((item, idx) => {
                    const Icon = item.icon;
                    return (
                      <button
                        key={idx}
                        onClick={() => {
                          item.action();
                          setSidebarOpen(false);
                        }}
                        className="w-full flex items-center space-x-3 px-4 py-3 rounded-lg hover:bg-gold/10 transition-colors text-left"
                      >
                        <Icon className="w-5 h-5 text-gold" />
                        <span className="text-foreground">{item.label}</span>
                      </button>
                    );
                  })}
                </nav>

                <div className="absolute bottom-6 left-6 right-6">
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

      {/* Hamburger Menu Button - Fixed Position */}
      <button
        onClick={() => setSidebarOpen(true)}
        className="fixed top-4 left-4 z-30 p-2 bg-card border border-border rounded-lg shadow-lg hover:bg-gold/10 transition-colors"
      >
        <Menu className="w-6 h-6 text-foreground" />
      </button>

      {/* Main Content */}
      <div className="w-full">
        {children}
      </div>
    </div>
  );
}
