import React from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../hooks/useAuth';
import { User, LogOut, Menu, X, Crown } from 'lucide-react';
import NotificationBell from './NotificationBell';
import logo43c from '../assets/43C.png';

const Navbar = () => {
  const { customer, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [isOpen, setIsOpen] = React.useState(false);

  if (location.pathname.startsWith('/admin')) {
    return null;
  }

  return (
    <>
      <nav className="fixed top-0 left-0 w-full z-[9999] bg-[#05071A]/90 backdrop-blur-lg border-b border-[#D4A95F]/10">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16 md:h-20">
          <Link to="/" className="flex items-center gap-2 flex-shrink-0">
            <img
              src={logo43c}
              alt="43C"
              className="h-10 md:h-12 w-auto object-contain"
              onError={(e) => {
                e.target.style.display = 'none';
                e.target.nextSibling.style.display = 'block';
              }}
            />
            <span
              className="text-3xl font-heading gold-text-gradient font-bold tracking-tighter hidden"
              style={{ display: 'none' }}
            >43C</span>
            <div className="h-4 w-[1px] bg-[#D4A95F]/30 mx-2 hidden md:block"></div>
            <span className="hidden md:block text-[10px] uppercase tracking-[0.3em] text-[#D4A95F]/60 font-medium">Lounge &amp; Café</span>
          </Link>

          <div className="hidden md:flex items-center gap-6 lg:gap-8">
            <Link to="/book" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors">Book Slot</Link>
            <Link to="/combos" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors text-accent flex items-center gap-2">Combos</Link>
            <Link to="/menu" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors flex items-center gap-2">Menu</Link>
            <Link to="/membership" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors flex items-center gap-2">
              <Crown className="w-4 h-4 text-accent" /> Membership
            </Link>
            <Link to="/contact" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors">Contact</Link>
            <Link to="/terms" className="text-sm uppercase tracking-widest hover:text-[#D4A95F] transition-colors">Terms</Link>
            
            <div className="h-6 w-[1px] bg-white/10 mx-2"></div>

            {customer ? (
              <div className="flex items-center gap-3">
                {customer.is_staff && (
                  <Link to="/admin" className="text-[10px] uppercase tracking-widest bg-white/5 hover:bg-accent hover:text-primary px-4 py-2 border border-accent/20 rounded-full text-accent font-black transition-all">Control Panel</Link>
                )}

                <NotificationBell userId={customer.id} />

                <Link to="/my-bookings" className="flex items-center gap-2 text-sm hover:text-accent transition-colors group">
                  <div className="w-8 h-8 rounded-full bg-accent/20 border border-accent/40 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-primary transition-all">
                    <User size={16} />
                  </div>
                  <span className="font-medium hidden lg:block">{customer.name}</span>
                </Link>
                <button 
                  onClick={() => { logout(); navigate('/'); }}
                  className="p-2 hover:bg-red-500/10 rounded-lg text-red-400 transition-all"
                  title="Logout"
                >
                  <LogOut size={18} />
                </button>
              </div>
            ) : (
              <Link to="/book" className="gold-button !px-6 !py-2 !text-sm flex items-center gap-2">
                Login
              </Link>
            )}
          </div>

          {/* Mobile right section */}
          <div className="flex items-center gap-2 md:hidden">
            {customer && <NotificationBell userId={customer.id} />}
            <button onClick={() => setIsOpen(!isOpen)} className="text-accent p-2">
              {isOpen ? <X size={26} /> : <Menu size={26} />}
            </button>
          </div>
        </div>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      {isOpen && (
        <div 
          className="md:hidden fixed inset-0 bg-black/60 backdrop-blur-sm z-[9999] transition-opacity"
          style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0 }}
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Mobile drawer */}
      <div className={`md:hidden fixed top-0 right-0 h-[100dvh] w-[280px] bg-[#05071A] border-l border-[#D4A95F]/20 z-[99999] transform transition-transform duration-300 ease-in-out flex flex-col ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}>
        <div className="p-4 flex justify-between items-center border-b border-[#D4A95F]/10 bg-[#05071A]">
          <span className="text-[#D4A95F] font-heading text-xl font-bold tracking-widest uppercase">Menu</span>
          <button onClick={() => setIsOpen(false)} className="text-accent p-2 rounded-lg hover:bg-white/5 active:bg-white/10 transition-colors">
            <X size={26} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-8 space-y-6 flex flex-col bg-[#05071A]">
          <Link to="/book" className="text-lg font-heading tracking-wider py-2" onClick={() => setIsOpen(false)}>Book Slot</Link>
          <Link to="/combos" className="text-lg font-heading text-accent tracking-wider py-2 flex items-center gap-3" onClick={() => setIsOpen(false)}>Combos</Link>
          <Link to="/menu" className="text-lg font-heading tracking-wider py-2 flex items-center gap-3" onClick={() => setIsOpen(false)}>Food Menu</Link>
          <Link to="/membership" className="text-lg font-heading text-accent tracking-wider py-2 flex items-center gap-3" onClick={() => setIsOpen(false)}>
            <Crown size={18} /> Membership
          </Link>
          {customer && (
            <Link to="/my-bookings" className="text-lg font-heading tracking-wider py-2 flex items-center gap-3" onClick={() => setIsOpen(false)}>
              <User size={18} /> My Bookings
            </Link>
          )}
          <Link to="/contact" className="text-lg font-heading tracking-wider py-2" onClick={() => setIsOpen(false)}>Contact Us</Link>
          <Link to="/terms" className="text-lg font-heading tracking-wider py-2" onClick={() => setIsOpen(false)}>Terms & Conditions</Link>
          {customer?.is_staff && (
            <Link to="/admin" className="text-lg font-heading text-accent tracking-wider py-2" onClick={() => setIsOpen(false)}>Control Panel</Link>
          )}
        </div>

        <div className="p-6 border-t border-[#D4A95F]/10 bg-[#05071A]">
          {customer ? (
            <div className="space-y-4">
              <div className="text-sm text-gray-400 px-2 truncate">Logged in as {customer.name}</div>
              <button onClick={() => { logout(); setIsOpen(false); navigate('/'); }} className="w-full bg-red-500/10 hover:bg-red-500/20 text-red-500 font-bold py-3 px-4 rounded-xl flex items-center justify-center gap-2 transition-colors min-h-[44px]">
                <LogOut size={18} /> Logout
              </button>
            </div>
          ) : (
            <Link to="/book" className="gold-button w-full text-center block !py-3 rounded-xl min-h-[44px]" onClick={() => setIsOpen(false)}>Login</Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
