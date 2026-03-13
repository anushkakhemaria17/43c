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

function App() {
  return (
    <AuthProvider>
      <Router>
        <div className="min-h-screen luxury-bg mesh-pattern text-white">
          <Navbar />
          <Routes>
            <Route path="/" element={<LandingPage />} />
            <Route path="/book" element={<BookingPage />} />
            <Route path="/receipt/:id" element={<ReceiptPage />} />
            <Route path="/membership" element={<Membership />} />
            <Route path="/profile" element={<PreviousBookings />} />
            <Route path="/admin-login" element={<AdminLogin />} />
            <Route path="/admin/*" element={<AdminDashboard />} />
          </Routes>
        </div>
      </Router>
    </AuthProvider>
  );
}

export default App;
