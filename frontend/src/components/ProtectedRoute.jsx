import { useEffect } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user, logout } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (user && (!user.role || user.role === '')) {
      const email = user.email;
      logout().then(() => {
        navigate('/pending-approval', { replace: true, state: { email } });
      });
    }
  }, [user, logout, navigate]);

  if (!user) {
    // Redirect unauthenticated requests to /login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Prevent rendering protected content while the useEffect is logging them out
  if (!user.role || user.role === '') {
    return null; 
  }

  if (allowedRoles && !allowedRoles.includes(user.role)) {
    // Redirect based on role if they are authenticated but unauthorized for this route
    if (user.role === 'tv') {
      return <Navigate to="/tv-display" replace />;
    }
    if (user.role === 'staff') {
      return <Navigate to="/bookings" replace />;
    }
    if (user.role === 'admin') {
      return <Navigate to="/dashboard" replace />;
    }
    return <Navigate to="/" replace />;
  }

  return children;
}
