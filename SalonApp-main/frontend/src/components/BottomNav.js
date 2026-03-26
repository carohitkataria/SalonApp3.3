import { Link, useLocation } from 'react-router-dom';
import { Home, History } from 'lucide-react';

export default function BottomNav() {
  const location = useLocation();

  const isActive = (path) => location.pathname === path;

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-charcoal border-t border-white/10 z-50">
      <div className="max-w-7xl mx-auto flex">
        <Link
          to="/"
          data-testid="nav-home"
          className={`flex-1 flex flex-col items-center justify-center py-4 transition-colors ${
            isActive('/') ? 'text-gold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <Home className="w-6 h-6 mb-1" />
          <span className="text-xs uppercase tracking-wider font-bold">Home</span>
        </Link>
        
        <Link
          to="/history"
          data-testid="nav-history"
          className={`flex-1 flex flex-col items-center justify-center py-4 transition-colors ${
            isActive('/history') ? 'text-gold' : 'text-zinc-400 hover:text-white'
          }`}
        >
          <History className="w-6 h-6 mb-1" />
          <span className="text-xs uppercase tracking-wider font-bold">History</span>
        </Link>
      </div>
    </div>
  );
}