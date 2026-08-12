import { useAuth } from '../../contexts/AuthContext';
import { LogOut } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

export default function TopHeader() {
  const { user } = useAuth();
  const navigate = useNavigate();
  
  const handleLogout = () => {
    // This will be connected to Firebase Auth later
    // For now, redirect to login
    navigate('/login');
  };

  return (
    <header className="sticky top-0 z-40 bg-bg/80 backdrop-blur-md border-b border-border-light px-4 md:px-6 py-3 flex items-center justify-between">
      <div className="flex items-center gap-3 font-display font-bold text-lg tracking-tight">
        <div className="w-9 h-9 bg-gradient-to-br from-accent-bright to-accent-dim rounded-[10px] flex items-center justify-center text-lg shadow-accent">
          B
        </div>
        <span className="hidden sm:inline">Billiard Station</span>
      </div>
      <div className="flex items-center gap-3 md:gap-4 text-sm text-text-muted">
        <div className="bg-accent/15 text-accent-bright px-3 py-1 rounded-full font-semibold text-[10px] md:text-xs tracking-wider border border-accent/25 uppercase">
          {user?.role || 'Guest'}
        </div>
        <button 
          onClick={handleLogout}
          className="p-2 hover:bg-card-hover rounded-lg transition-colors text-text-dim hover:text-text-main"
          title="Logout"
        >
          <LogOut size={18} />
        </button>
      </div>
    </header>
  );
}
