import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { User, LogOut, Menu, X, Crown } from 'lucide-react';

const Navbar = () => {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <nav className="fixed w-full z-50 bg-[#05071A]/80 backdrop-blur-lg border-b border-[#D4A95F]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-20">
          <Link to="/" className="flex items-center gap-2">
            <span className="text-3xl font-heading gold-text-gradient font-bold tracking-tighter">43C</span>
            <div className="h-4 w-[1px] bg-[#D4A95F]/30 mx-2 hidden md:block"></div>
            <span className="hidden md:block text-[10px] uppercase tracking-[0.3em] text-[#D4A95F]/60 font-medium">Lounge & Café</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            <Link to="/book" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors">Book Slot</Link>
            <Link to="/menu" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors text-accent flex items-center gap-2">Menu</Link>
            <Link to="/membership" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors flex items-center gap-2">
              <Crown className="w-4 h-4 text-accent" /> Membership
            </Link>
            <Link to="/contact" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors">Contact</Link>
            
            <div className="h-6 w-[1px] bg-white/10 mx-2"></div>

            {customer ? (
              <div className="flex items-center gap-4">
                {customer.is_staff && (
                  <Link to="/admin" className="text-[10px] uppercase tracking-widest bg-white/5 hover:bg-accent hover:text-primary px-4 py-2 border border-accent/20 rounded-full text-accent font-black transition-all">Control Panel</Link>
                )}
                <Link to="/profile" className="flex items-center gap-2 text-sm hover:text-accent transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-primary transition-all">
                    <User size={16} />
                  </div>
                  <span className="font-medium">{customer.name}</span>
                </Link>
                <button 
                  onClick={() => { logout(); navigate('/'); }}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all"
                  title="Logout"
                >
                  <LogOut size={20} />
                </button>
              </div>
            ) : (
              <Link to="/book" className="gold-button !px-6 !py-2 !text-sm flex items-center gap-2">
                Login
              </Link>
            )}
          </div>

          <div className="md:hidden">
            <button onClick={() => setIsOpen(!isOpen)} className="text-accent p-2">
              {isOpen ? <X size={28} /> : <Menu size={28} />}
            </button>
          </div>
        </div>
      </div>

      {/* Mobile menu */}
      <div className={`md:hidden transition-all duration-300 overflow-hidden ${isOpen ? 'max-h-[500px] border-b border-accent/10' : 'max-h-0'}`}>
        <div className="px-4 pt-2 pb-6 space-y-4 bg-[#05071A]">
          <Link to="/book" className="block text-lg font-heading" onClick={() => setIsOpen(false)}>Book Slot</Link>
          <Link to="/menu" className="block text-lg font-heading text-accent" onClick={() => setIsOpen(false)}>Food Menu</Link>
          <Link to="/membership" className="block text-lg font-heading text-accent" onClick={() => setIsOpen(false)}>Membership</Link>
          <Link to="/profile" className="block text-lg font-heading" onClick={() => setIsOpen(false)}>My Bookings</Link>
          <Link to="/contact" className="block text-lg font-heading" onClick={() => setIsOpen(false)}>Contact Us</Link>
          {customer?.is_staff && (
            <Link to="/admin" className="block text-lg font-heading text-accent" onClick={() => setIsOpen(false)}>Control Panel</Link>
          )}
          {customer ? (
            <button onClick={() => { logout(); setIsOpen(false); navigate('/'); }} className="w-full text-left text-red-400 font-bold py-2">Logout</button>
          ) : (
            <Link to="/book" className="gold-button w-full text-center" onClick={() => setIsOpen(false)}>Login</Link>
          )}
        </div>
      </div>
    </nav>
  );
};

export default Navbar;
