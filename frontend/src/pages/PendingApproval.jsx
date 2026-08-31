import { Home } from 'lucide-react';
import { useNavigate, useLocation, Navigate } from 'react-router-dom';

export default function PendingApproval() {
  const navigate = useNavigate();
  const location = useLocation();
  const email = location.state?.email;

  if (!email) {
    return <Navigate to="/" replace />;
  }

  return (
    <div className="relative min-h-screen bg-bg flex items-center justify-center overflow-hidden selection:bg-warning/30">
      {/* Cinematic Ambient Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-warning/10 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] bg-warning/5 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

      {/* Abstract grid pattern overlay for texture */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />

      {/* Main Glass Panel */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-[#18181b]/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-10 shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] flex flex-col items-center">

          <div className="mb-8 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-warning/10 rounded-full flex items-center justify-center mb-6 border border-warning/20">
              <svg className="w-8 h-8 text-warning" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"></path>
              </svg>
            </div>
            <h1 className="text-3xl font-display font-black text-white tracking-tight mb-3">
              Account Pending
            </h1>
            <p className="text-text-dim text-sm font-medium tracking-wide leading-relaxed">
              <span>You have successfully joined the Galle Billiards Club using the Google account</span><br />
              <strong className="text-white opacity-90">{email}</strong><br />
              <span>However, an administrator must assign you privileges before you can access the system.</span>
            </p>
          </div>

          <div className="flex flex-col gap-3 w-full">
            <button
              onClick={() => navigate('/')}
              className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-accent/10 hover:bg-accent/20 active:bg-accent/10 border border-accent/20 rounded-2xl transition-all duration-300 shadow-lg"
            >
              <Home className="w-5 h-5 text-accent group-hover:text-accent-bright transition-colors" />
              <span className="font-semibold text-accent group-hover:text-accent-bright tracking-wide transition-colors">
                Return to Home
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
