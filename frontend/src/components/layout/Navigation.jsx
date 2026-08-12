import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Lightbulb, Users, TvMinimal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Navigation() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Bookings', path: '/bookings', icon: CalendarDays },
    { name: 'Lights', path: '/lights-control', icon: Lightbulb },
    { name: 'TV Display', path: '/tv-display', icon: TvMinimal },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: Users }] : []),
  ];

  const getNavClass = ({ isActive }) =>
    `flex flex-col md:flex-row items-center justify-center md:justify-start gap-1 md:gap-3 p-2 md:px-4 md:py-3 rounded-xl transition-all ${isActive
      ? 'text-accent-bright bg-accent/10'
      : 'text-text-dim hover:text-text-main hover:bg-card-hover'
    }`;

  return (
    <>
      {/* Mobile Bottom Navigation (Hidden on md+) */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 z-50 bg-bg/95 backdrop-blur-lg border-t border-border px-2 py-2 flex items-center justify-around pb-safe">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path} className={getNavClass}>
              <Icon size={20} />
              <span className="text-[10px] font-semibold">{item.name}</span>
            </NavLink>
          );
        })}
      </nav>

      {/* Desktop Side Navigation (Hidden on mobile) */}
      <aside className="hidden md:flex flex-col w-64 bg-bg border-r border-border h-full flex-shrink-0 pt-6 px-4 z-10">
        <div className="flex flex-col gap-2">
          {navItems.map((item) => {
            const Icon = item.icon;
            return (
              <NavLink key={item.path} to={item.path} className={getNavClass}>
                <Icon size={20} />
                <span className="font-semibold text-sm">{item.name}</span>
              </NavLink>
            );
          })}
        </div>
      </aside>
    </>
  );
}
