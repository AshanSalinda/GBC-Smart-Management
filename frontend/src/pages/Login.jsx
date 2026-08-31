import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { useNavigate } from 'react-router-dom';
import { Loader2, Home } from 'lucide-react';

export default function Login() {
  const { user, loginWithGoogle, logout } = useAuth();
  const navigate = useNavigate();
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [error, setError] = useState('');

  // If already logged in, redirect them based on their role
  useEffect(() => {
    if (user) {
      if (user.role === 'admin') navigate('/dashboard', { replace: true });
      else if (user.role === 'staff') navigate('/bookings', { replace: true });
      else if (user.role === 'tv') navigate('/tv-display', { replace: true });
      else {
        const email = user.email;
        logout().then(() => {
          navigate('/pending-approval', { replace: true, state: { email } });
        });
      }
    }
  }, [user, navigate, logout]);

  const handleGoogleLogin = async () => {
    try {
      setIsLoggingIn(true);
      setError('');
      await loginWithGoogle();
      // Redirect happens automatically via the user state change in AuthContext
    } catch (err) {
      console.error(err);
      setError('Failed to log in. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-bg flex items-center justify-center overflow-hidden selection:bg-accent/30">
      {/* Cinematic Ambient Orbs */}
      <div className="absolute top-[10%] left-[20%] w-[500px] h-[500px] bg-accent/10 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '4s' }} />
      <div className="absolute bottom-[10%] right-[20%] w-[500px] h-[500px] bg-accent/5 rounded-full mix-blend-screen filter blur-[120px] opacity-70 animate-pulse" style={{ animationDuration: '6s', animationDelay: '1s' }} />

      {/* Abstract grid pattern overlay for texture */}
      <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAiIGhlaWdodD0iMjAiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+PGNpcmNsZSBjeD0iMiIgY3k9IjIiIHI9IjEiIGZpbGw9InJnYmEoMjU1LDI1NSwyNTUsMC4wMykiLz48L3N2Zz4=')] opacity-50" />

      {/* Main Glass Panel */}
      <div className="relative z-10 w-full max-w-md px-6">
        <div className="bg-[#18181b]/60 backdrop-blur-3xl border border-white/5 rounded-3xl p-6 md:p-10 shadow-[0_30px_80px_rgba(0,0,0,0.8),inset_0_1px_1px_rgba(255,255,255,0.1)] flex flex-col items-center">

          {/* Logo / Branding */}
          <div className="mb-10 text-center flex flex-col items-center">
            <div className="w-16 h-16 bg-gradient-to-br from-accent-bright to-accent rounded-2xl flex items-center justify-center shadow-[0_0_40px_rgba(74,188,109,0.3)] mb-6 transform transition-transform hover:scale-105">
              <span className="text-3xl font-display font-black text-[#151517]">B</span>
            </div>
            <h1 className="text-3xl font-display font-black text-white tracking-tight mb-2">
              Welcome back
            </h1>
            <p className="text-text-dim text-sm font-medium tracking-wide">
              Sign in to GBC Smart System
            </p>
          </div>

          {/* Error Message */}
          {error && (
            <div className="w-full mb-6 p-4 bg-danger/10 border border-danger/20 rounded-xl text-danger text-sm font-medium text-center shadow-[0_0_15px_rgba(240,82,82,0.1)]">
              {error}
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex flex-col gap-3 w-full">
            {/* Google Login Button */}
            <button
              onClick={handleGoogleLogin}
              disabled={isLoggingIn}
              className="group relative w-full flex items-center justify-center gap-3 px-6 py-4 bg-white/5 hover:bg-white/10 active:bg-white/5 disabled:opacity-50 disabled:cursor-not-allowed border border-white/10 rounded-2xl transition-all duration-300 shadow-lg overflow-hidden"
            >
              {/* Button Hover Glow */}
              <div className="absolute inset-0 bg-gradient-to-r from-accent/0 via-accent/10 to-accent/0 translate-x-[-100%] group-hover:translate-x-[100%] transition-transform duration-1000" />

              {isLoggingIn ? (
                <Loader2 className="w-5 h-5 text-accent animate-spin relative z-10" />
              ) : (
                <svg className="w-5 h-5 relative z-10" viewBox="0 0 24 24">
                  <path
                    fill="currentColor"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="currentColor"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                  />
                  <path
                    fill="currentColor"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                  />
                </svg>
              )}
              <span className="font-semibold text-white tracking-wide relative z-10">
                {isLoggingIn ? 'Connecting...' : 'Continue with Google'}
              </span>
            </button>

            {/* Return to Home Button */}
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

          {/* Divider */}
          <div className="w-full flex items-center gap-4 mt-8 opacity-40">
            <div className="h-px bg-white/20 flex-1" />
            <span className="text-xs font-semibold text-white/60 tracking-widest uppercase">Secure</span>
            <div className="h-px bg-white/20 flex-1" />
          </div>

          <p className="mt-8 text-xs text-text-dim text-center leading-relaxed">
            By continuing, you agree to the GBC Smart Management<br />
            <a href="#" className="text-accent hover:text-accent-bright transition-colors">Terms of Service</a> and <a href="#" className="text-accent hover:text-accent-bright transition-colors">Privacy Policy</a>.
          </p>
        </div>
      </div>
    </div>
  );
}
