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
      <nav className="fixed top-0 left-0 w-full z-[9999] bg-[#05071A]/70 backdrop-blur-xl border-b border-white/5 pt-2 pb-2 transition-all">
        <div className="max-w-[90rem] mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16 md:h-20">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-3 group">
              <img
                src={logo43c}
                alt="43C"
                className="h-10 md:h-12 w-auto object-contain transition-transform duration-500 group-hover:scale-105"
                onError={(e) => { e.target.style.display = 'none'; e.target.nextSibling.style.display = 'block'; }}
              />
              <span className="hidden text-3xl font-heading gold-text-gradient font-bold tracking-tighter" style={{ display: 'none' }}>43C</span>
            </Link>

            {/* Desktop Center Links (Capsule) */}
            <div className="hidden md:flex items-center justify-center px-8 py-2.5 bg-white/[0.03] backdrop-blur-2xl rounded-full border border-white/[0.08] shadow-[0_4px_30px_rgba(0,0,0,0.1)] gap-1">
              {[
                { path: '/book', label: 'Book' },
                { path: '/combos', label: 'Combos' },
                { path: '/menu', label: 'Menu' },
                ...(customer ? [{ path: '/my-bookings', label: 'My Orders' }] : []),
                { path: '/guide', label: 'Guide' },
                { path: '/contact', label: 'Contact' },
                { path: '/terms', label: 'Terms' }
              ].map(link => (
                <Link 
                  key={link.path} 
                  to={link.path} 
                  className={`px-3 lg:px-4 py-2 rounded-full text-[9px] lg:text-[10px] uppercase font-bold tracking-[0.1em] lg:tracking-[0.2em] transition-all duration-300 relative group overflow-hidden ${location.pathname === link.path ? 'text-accent bg-accent/10' : 'text-white/60 hover:text-white hover:bg-white/5'}`}
                >
                  <span className="relative z-10">{link.label}</span>
                </Link>
              ))}
              <div className="w-[1px] h-4 bg-white/10 mx-2"></div>
              <Link 
                to="/membership" 
                className={`px-5 py-2 rounded-full text-[10px] uppercase font-bold tracking-[0.2em] transition-all duration-300 flex items-center gap-2 ${location.pathname === '/membership' ? 'bg-accent text-[#05071A]' : 'text-accent hover:bg-accent/10'}`}
              >
                <Crown size={12} /> Elite
              </Link>
            </div>

            {/* Desktop Right Actions */}
            <div className="hidden md:flex items-center justify-end min-w-[200px]">
               {customer ? (
                 <div className="flex items-center gap-4">
                   {customer.is_staff && (
                     <Link to="/admin" className="text-[9px] uppercase tracking-widest text-[#05071A] bg-accent hover:bg-accent/80 px-4 py-2 rounded-full font-black shadow-[0_0_15px_rgba(212,169,95,0.4)] transition-all">Admin Panel</Link>
                   )}
                   <NotificationBell userId={customer.id} />
                   <div className="flex items-center gap-2 pl-2 border-l border-white/10">
                     <Link to="/my-bookings" className="flex items-center gap-3 pr-5 pl-1.5 py-1.5 rounded-full bg-white/5 border border-white/10 hover:border-accent/40 text-white/70 hover:text-accent transition-all group">
                       <div className="w-7 h-7 rounded-full bg-accent/20 flex items-center justify-center text-accent group-hover:bg-accent group-hover:text-primary transition-all">
                         <User size={14} />
                       </div>
                       <span className="text-xs font-bold truncate max-w-[120px]">{customer.name}</span>
                     </Link>
                     <button 
                       onClick={() => { logout(); navigate('/'); }}
                       className="flex items-center justify-center w-10 h-10 rounded-full bg-red-500/5 border border-red-500/10 hover:bg-red-500/20 text-red-400 hover:text-red-300 transition-all group relative"
                     >
                       <LogOut size={16} />
                       <span className="absolute -bottom-8 opacity-0 group-hover:opacity-100 transition-opacity text-[8px] uppercase tracking-widest text-red-400 whitespace-nowrap">Logout</span>
                     </button>
                   </div>
                 </div>
               ) : (
                 <Link to="/book" className="gold-button !px-8 !py-3 !text-[10px] uppercase tracking-[0.2em] font-black min-w-[120px] text-center">
                   Sign In
                 </Link>
               )}
            </div>

            {/* Mobile Toggle */}
            <div className="flex items-center gap-4 md:hidden">
              {customer && <NotificationBell userId={customer.id} />}
              <button onClick={() => setIsOpen(!isOpen)} className="text-accent p-2 rounded-xl bg-white/5 border border-white/10 active:scale-95 transition-all">
                {isOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile drawer backdrop */}
      <div 
        className={`md:hidden fixed inset-0 bg-[#05071A]/80 backdrop-blur-md z-[9998] transition-opacity duration-300 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
        onClick={() => setIsOpen(false)}
      />

      {/* Mobile drawer sidebar */}
      <div className={`md:hidden fixed top-0 right-0 h-[100dvh] w-4/5 max-w-[320px] bg-[#05071A] border-l border-white/10 z-[9999] transform transition-transform duration-500 cubic-bezier(0.4, 0, 0.2, 1) flex flex-col ${isOpen ? 'translate-x-0 shadow-[-20px_0_50px_rgba(0,0,0,0.5)]' : 'translate-x-full'}`}>
        <div className="p-6 flex justify-between items-center border-b border-white/5">
          <span className="text-xs uppercase tracking-[0.3em] font-black text-white/40">Navigation</span>
          <button onClick={() => setIsOpen(false)} className="text-white/40 hover:text-accent hover:bg-white/5 p-2 rounded-full transition-all">
             <X size={20} />
          </button>
        </div>
        
        <div className="flex-1 overflow-y-auto px-6 py-8 flex flex-col gap-2">
          {[
            { path: '/book', label: 'Book Slot' },
            { path: '/combos', label: 'Combos' },
            { path: '/menu', label: 'Food Menu' },
            ...(customer ? [{ path: '/my-bookings', label: 'My Orders' }] : []),
            { path: '/guide', label: 'Guide' }
          ].map((link, i) => (
            <Link 
              key={i} 
              to={link.path} 
              onClick={() => setIsOpen(false)}
              className={`p-4 rounded-2xl text-sm font-bold uppercase tracking-widest transition-all ${location.pathname === link.path ? 'bg-accent/10 text-accent border border-accent/20' : 'bg-white/[0.02] text-white/60 hover:bg-white/5 border border-transparent'}`}
            >
              {link.label}
            </Link>
          ))}
          
          <Link to="/membership" onClick={() => setIsOpen(false)} className={`mt-4 p-4 flex items-center justify-between rounded-2xl border transition-all ${location.pathname === '/membership' ? 'bg-accent text-[#05071A] border-transparent' : 'bg-accent/5 text-accent border-accent/20 hover:bg-accent/10'}`}>
             <span className="text-sm font-bold uppercase tracking-widest">Elite Circle</span>
             <Crown size={16} />
          </Link>

          <div className="mt-8 space-y-2">
             <Link to="/contact" className="block p-3 text-xs uppercase tracking-widest text-white/40 hover:text-white" onClick={() => setIsOpen(false)}>Contact Us</Link>
             <Link to="/terms" className="block p-3 text-xs uppercase tracking-widest text-white/40 hover:text-white" onClick={() => setIsOpen(false)}>Terms & Conditions</Link>
          </div>
        </div>

        <div className="p-6 border-t border-white/5 bg-gradient-to-t from-[#05071A] to-transparent">
          {customer ? (
            <div className="space-y-4">
              <Link to="/my-bookings" onClick={() => setIsOpen(false)} className="flex items-center gap-3 p-4 rounded-xl border border-white/10 bg-white/5">
                 <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center"><User size={16} className="text-accent"/></div>
                 <div>
                    <p className="text-[10px] uppercase tracking-widest text-white/40 font-black">Logged in as</p>
                    <p className="text-sm font-bold truncate">{customer.name}</p>
                 </div>
              </Link>
              {customer.is_staff && (
                <Link to="/admin" onClick={() => setIsOpen(false)} className="block w-full text-center p-4 rounded-xl border border-accent/30 bg-accent/10 text-accent text-[10px] uppercase tracking-[0.2em] font-black">Control Panel</Link>
              )}
              <button 
                onClick={() => { logout(); setIsOpen(false); navigate('/'); }} 
                className="w-full bg-red-500/10 border border-red-500/20 hover:bg-red-500/20 text-red-500 font-bold py-4 rounded-xl flex items-center justify-center gap-2 transition-colors uppercase tracking-widest text-[10px]"
              >
                <LogOut size={16} /> Sign Out
              </button>
            </div>
          ) : (
            <Link to="/book" onClick={() => setIsOpen(false)} className="gold-button w-full text-center flex justify-center uppercase tracking-[0.2em] text-[10px] !py-4 rounded-xl">
               Secure Login
            </Link>
          )}
        </div>
      </div>
    </>
  );
};

export default Navbar;
