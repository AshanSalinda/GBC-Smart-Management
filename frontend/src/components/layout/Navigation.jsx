import { NavLink } from 'react-router-dom';
import { LayoutDashboard, CalendarDays, Lightbulb, Users, TvMinimal } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

export default function Navigation() {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const navItems = [
    { name: 'Dashboard', path: '/dashboard', icon: LayoutDashboard },
    { name: 'Bookings', path: '/bookings', icon: CalendarDays },
    { name: 'Illumination', path: '/illumination', icon: Lightbulb },
    { name: 'TV Display', path: '/tv-display', icon: TvMinimal },
    ...(isAdmin ? [{ name: 'Admin', path: '/admin', icon: Users }] : []),
  ];

  const getDesktopNavClass = ({ isActive }) =>
    `flex flex-row items-center justify-start gap-3 px-4 py-3 rounded-xl transition-all ${isActive
      ? 'text-accent-bright bg-accent/10'
      : 'text-text-dim hover:text-text-main hover:bg-card-hover'
    }`;

  const getMobileNavClass = ({ isActive }) =>
    `relative flex w-16 items-center justify-center py-3.5 transition duration-200 ${isActive
      ? 'text-accent-bright'
      : 'text-text-dim hover:text-white/80 active:scale-95'
    }`;

  return (
    <>
      {/* Premium Mobile Bottom Navigation */}
      <nav className="md:hidden fixed rounded-t-4xl bottom-0 left-0 right-0 z-50 bg-[#1c1c1e] border-t border-[#2c2c2e] px-2 py-1.5 flex items-center justify-around pb-safe shadow-[0_-8px_30px_rgba(0,0,0,0.4)]">
        {navItems.map((item) => {
          const Icon = item.icon;
          return (
            <NavLink key={item.path} to={item.path} className={getMobileNavClass}>
              {({ isActive }) => (
                <>
                  {/* Active Circular Background Glow */}
                  {isActive && <div className="absolute w-14 h-11 bg-accent/15 rounded-full border border-accent/20" />}

                  {/* Icon */}
                  <Icon size={24} className={`relative z-10 transition-transform duration-200 ${isActive ? 'scale-[1.15]' : ''}`} />
                </>
              )}
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
              <NavLink key={item.path} to={item.path} className={getDesktopNavClass}>
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
