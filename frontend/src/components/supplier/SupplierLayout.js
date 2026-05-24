/**
 * Phase 9 — Shared Supplier Layout (top bar + nav).
 * Wraps all authenticated supplier pages.
 */
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Package, LayoutDashboard, Boxes, LogOut, User } from 'lucide-react';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';

export default function SupplierLayout({ children }) {
  const navigate = useNavigate();
  const { supplier, logout, blockedStatus } = useSupplierAuth();

  // Route guard
  React.useEffect(() => {
    if (!supplier) {
      navigate('/supplier/login', { replace: true });
    } else if (blockedStatus) {
      navigate('/supplier/pending', { replace: true });
    }
  }, [supplier, blockedStatus, navigate]);

  if (!supplier) return null;

  const handleLogout = () => {
    logout();
    navigate('/');
  };

  return (
    <div className="min-h-screen bg-zinc-950 text-white">
      <header className="sticky top-0 z-30 bg-zinc-950/80 backdrop-blur border-b border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/supplier/dashboard" className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-amber-500/15 border border-amber-500/40 flex items-center justify-center">
              <Package className="w-4 h-4 text-amber-400" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight">{supplier.business_name || 'Supplier'}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-zinc-500 leading-tight">Marketplace</div>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <NavItem to="/supplier/dashboard" icon={LayoutDashboard} label="Dashboard" />
            <NavItem to="/supplier/products" icon={Boxes} label="Products" />
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-zinc-400 pr-2">
              <User className="w-3.5 h-3.5" />
              <span className="font-mono">{supplier.mobile}</span>
            </div>
            <button onClick={handleLogout} className="p-2 rounded-lg text-zinc-400 hover:bg-zinc-800 hover:text-white" title="Logout">
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="sm:hidden flex items-center justify-around border-t border-zinc-800">
          <NavItem to="/supplier/dashboard" icon={LayoutDashboard} label="Dashboard" mobile />
          <NavItem to="/supplier/products" icon={Boxes} label="Products" mobile />
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, mobile }) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        `${mobile ? 'flex-1' : ''} flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${
          isActive
            ? 'bg-amber-500/15 text-amber-300'
            : 'text-zinc-400 hover:bg-zinc-800 hover:text-white'
        }`
      }
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </NavLink>
  );
}
