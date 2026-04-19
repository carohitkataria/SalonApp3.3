import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from '@/components/ui/sonner';

// Layout
import CustomerLayout from '@/components/CustomerLayout';

// Landing Page
import LandingPage from '@/pages/LandingPage';

// User Pages
import UserLoginPage from '@/pages/UserLoginPage';
import SalonSelectionPage from '@/pages/SalonSelectionPage';
import SalonMainPage from '@/pages/SalonMainPage';
import SinglePageBooking from '@/pages/SinglePageBooking';
import HistoryPage from '@/pages/HistoryPage';
import TokenDashboard from '@/pages/TokenDashboard';
import ServicesBrowser from '@/pages/ServicesBrowser';
import BarberProfilePage from '@/pages/BarberProfilePage';
import SalonRatingsPage from '@/pages/SalonRatingsPage';
import CustomerWalletPage from '@/pages/CustomerWalletPage';
import CustomerNotificationsPage from '@/pages/CustomerNotificationsPage';
import CustomerProfilePage from '@/pages/CustomerProfilePage';

// Salon Pages
import OTPLoginPage from '@/pages/OTPLoginPage';
import SalonSignupPage from '@/pages/SalonSignupPage';
import EnhancedSalonDashboard from '@/pages/EnhancedSalonDashboard';
import StaffProfilePage from '@/pages/StaffProfilePage';

import '@/App.css';

function App() {
  return (
    <ThemeProvider>
      <AuthProvider>
        <WebSocketProvider>
          <div className="App">
            <Toaster position="top-center" richColors />
            <BrowserRouter>
              <Routes>
                {/* Landing Page */}
                <Route path="/" element={<LandingPage />} />
                
                {/* User Routes */}
                <Route path="/login" element={<UserLoginPage />} />
                <Route path="/user/login" element={<Navigate to="/login" replace />} />
                
                {/* Customer Routes with Layout */}
                <Route path="/salons" element={<CustomerLayout><SalonSelectionPage /></CustomerLayout>} />
                <Route path="/history" element={<CustomerLayout><HistoryPage /></CustomerLayout>} />
                <Route path="/profile" element={<CustomerLayout><CustomerProfilePage /></CustomerLayout>} />
                
                {/* Salon Main Page - New Hub after selecting a salon */}
                <Route path="/salon/:salonId" element={<CustomerLayout><SalonMainPage /></CustomerLayout>} />
                
                {/* Booking Routes (with persistent sidebar) */}
                <Route path="/book/:salonId" element={<CustomerLayout><SinglePageBooking /></CustomerLayout>} />
                <Route path="/salon/:salonId/queue" element={<CustomerLayout><TokenDashboard /></CustomerLayout>} />
                <Route path="/salon/:salonId/services" element={<CustomerLayout><ServicesBrowser /></CustomerLayout>} />
                <Route path="/salon/:salonId/barber/:barberId" element={<CustomerLayout><BarberProfilePage /></CustomerLayout>} />
                <Route path="/salon/:salonId/ratings" element={<CustomerLayout><SalonRatingsPage /></CustomerLayout>} />
                <Route path="/salon/:salonId/wallet" element={<CustomerLayout><CustomerWalletPage /></CustomerLayout>} />
                <Route path="/notifications" element={<CustomerLayout><CustomerNotificationsPage /></CustomerLayout>} />
                
                {/* Salon Admin Routes */}
                <Route path="/salon/login" element={<OTPLoginPage />} />
                <Route path="/salon/signup" element={<SalonSignupPage />} />
                <Route path="/salon/dashboard" element={<EnhancedSalonDashboard />} />
                <Route path="/salon/staff/:staffId" element={<StaffProfilePage />} />
                
                {/* Redirect old routes */}
                <Route path="/admin/login" element={<Navigate to="/salon/login" replace />} />
                <Route path="/admin/dashboard" element={<Navigate to="/salon/dashboard" replace />} />
                <Route path="/book" element={<Navigate to="/salons" replace />} />
              </Routes>
            </BrowserRouter>
          </div>
        </WebSocketProvider>
      </AuthProvider>
    </ThemeProvider>
  );
}

export default App;
