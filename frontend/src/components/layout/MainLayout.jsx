import { Outlet } from 'react-router-dom';
import TopHeader from './TopHeader';
import Navigation from './Navigation';

export default function MainLayout() {
  return (
    <div className="flex flex-col h-screen bg-bg text-text-main font-sans">
      <TopHeader />
      <div className="flex flex-1 overflow-hidden relative">
        <Navigation />
        {/* Main Content Area */}
        {/* Added pb-20 on mobile to account for the fixed bottom navigation bar */}
        <main className="flex-1 overflow-y-auto pb-24 md:pb-0 relative z-0">
          <div className="max-w-7xl mx-auto p-5 md:p-8">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}
