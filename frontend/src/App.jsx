import React from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import LandingPage from './pages/LandingPage';
import { AuthProvider } from './hooks/useAuth';
import BookingPage from './pages/BookingPage';
import ReceiptPage from './pages/ReceiptPage';
import AdminDashboard from './pages/AdminDashboard';
import AdminLogin from './pages/AdminLogin';
import Navbar from './components/Navbar';
import Membership from './pages/Membership';
import PreviousBookings from './pages/PreviousBookings';
import MenuPage from './pages/MenuPage';
import ContactPage from './pages/ContactPage';
import AdminVerify from './pages/AdminVerify';
import TermsPage from './pages/TermsPage';
import CombosPage from './pages/CombosPage';
import CustomerGuide from './pages/CustomerGuide';
import AdminGuide from './pages/AdminGuide';

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen luxury-bg mesh-pattern text-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/combos" element={<CombosPage />} />
            <Route path="/menu" element={<MenuPage />} />
            <Route path="/receipt/:id" element={<ReceiptPage />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/my-bookings" element={<PreviousBookings />} />
            <Route path="/contact" element={<ContactPage />} />
            <Route path="/terms" element={<TermsPage />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin/verify/:id" element={<AdminVerify />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
            <Route path="/guide" element={<CustomerGuide />} />
            <Route path="/admin-guide" element={<AdminGuide />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
