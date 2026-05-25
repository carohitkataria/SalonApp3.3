/**
 * Phase 9 — Shared Supplier Layout (top bar + nav).
 * Wraps all authenticated supplier pages.
 */
import React from 'react';
import { Link, NavLink, useNavigate } from 'react-router-dom';
import { Package, LayoutDashboard, Boxes, LogOut, User, Truck } from 'lucide-react';
import { useSupplierAuth } from '@/contexts/SupplierAuthContext';

export default function SupplierLayout({ children }) {
  const navigate = useNavigate();
  const { supplier, token, loading, logout, blockedStatus } = useSupplierAuth();

  // Route guard — only redirect once we're CERTAIN the user has no session.
  // While refresh() is in flight (token present but supplier still null), wait.
  React.useEffect(() => {
    if (loading) return;
    if (!token) {
      navigate('/supplier/login', { replace: true });
      return;
    }
    if (blockedStatus) {
      navigate('/supplier/pending', { replace: true });
    }
  }, [token, loading, blockedStatus, navigate]);

  // Don't paint until we have a supplier profile (avoids flicker / race with guard)
  if (!supplier) return null;

  const handleLogout = () => {
    // Hard navigation guarantees the layout fully unmounts before the
    // route-guard useEffect can race on the cleared token.
    logout();
    window.location.replace('/');
  };

  return (
    <div className="min-h-screen bg-background text-foreground" data-testid="supplier-shell">
      <header className="sticky top-0 z-30 bg-background/80 backdrop-blur border-b border-border">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 flex items-center justify-between">
          <Link to="/supplier/dashboard" className="flex items-center gap-2" data-testid="supplier-header-logo">
            <div className="w-8 h-8 rounded-lg bg-primary/15 border border-primary/40 flex items-center justify-center">
              <Package className="w-4 h-4 text-primary" />
            </div>
            <div>
              <div className="text-sm font-bold leading-tight" data-testid="supplier-header-business-name">{supplier.business_name || 'Supplier'}</div>
              <div className="text-[10px] uppercase tracking-widest font-bold text-muted-foreground/80 leading-tight">Marketplace</div>
            </div>
          </Link>

          <nav className="hidden sm:flex items-center gap-1">
            <NavItem to="/supplier/dashboard" icon={LayoutDashboard} label="Dashboard" testid="supplier-nav-dashboard" />
            <NavItem to="/supplier/products" icon={Boxes} label="Products" testid="supplier-nav-products" />
            <NavItem to="/supplier/orders" icon={Truck} label="Orders" testid="supplier-nav-orders" />
          </nav>

          <div className="flex items-center gap-2">
            <div className="hidden sm:flex items-center gap-2 text-xs text-muted-foreground pr-2">
              <User className="w-3.5 h-3.5" />
              <span className="font-mono" data-testid="supplier-header-mobile">{supplier.mobile}</span>
            </div>
            <button
              onClick={handleLogout}
              data-testid="supplier-header-logout-btn"
              className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground"
              title="Logout"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
        {/* Mobile nav */}
        <nav className="sm:hidden flex items-center justify-around border-t border-border">
          <NavItem to="/supplier/dashboard" icon={LayoutDashboard} label="Dashboard" mobile testid="supplier-nav-dashboard-mobile" />
          <NavItem to="/supplier/products" icon={Boxes} label="Products" mobile testid="supplier-nav-products-mobile" />
          <NavItem to="/supplier/orders" icon={Truck} label="Orders" mobile testid="supplier-nav-orders-mobile" />
        </nav>
      </header>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-6">
        {children}
      </main>
    </div>
  );
}

function NavItem({ to, icon: Icon, label, mobile, testid }) {
  return (
    <NavLink
      to={to}
      data-testid={testid}
      className={({ isActive }) =>
        `${mobile ? 'flex-1' : ''} flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-bold uppercase tracking-widest rounded-lg transition-colors ${
          isActive
            ? 'bg-primary/15 text-primary'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        }`
      }
    >
      <Icon className="w-3.5 h-3.5" /> {label}
    </NavLink>
  );
}
