import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from '@/contexts/AuthContext';
import { WebSocketProvider } from '@/contexts/WebSocketContext';
import { ThemeProvider } from '@/contexts/ThemeContext';
import { Toaster } from '@/components/ui/sonner';

// User Pages
import UserLoginPage from '@/pages/UserLoginPage';
import HomePage from '@/pages/HomePage';
import SalonSelectionPage from '@/pages/SalonSelectionPage';
import SinglePageBooking from '@/pages/SinglePageBooking';
import HistoryPage from '@/pages/HistoryPage';

// Salon Pages
import OTPLoginPage from '@/pages/OTPLoginPage';
import SalonSignupPage from '@/pages/SalonSignupPage';
import EnhancedSalonDashboard from '@/pages/EnhancedSalonDashboard';

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
                {/* User Routes */}
                <Route path="/user/login" element={<UserLoginPage />} />
                <Route path="/" element={<HomePage />} />
                <Route path="/salons" element={<SalonSelectionPage />} />
                <Route path="/book/:salonId" element={<SinglePageBooking />} />
                <Route path="/history" element={<HistoryPage />} />
                
                {/* Salon Routes */}
                <Route path="/salon/login" element={<OTPLoginPage />} />
                <Route path="/salon/signup" element={<SalonSignupPage />} />
                <Route path="/salon/dashboard" element={<EnhancedSalonDashboard />} />
                
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