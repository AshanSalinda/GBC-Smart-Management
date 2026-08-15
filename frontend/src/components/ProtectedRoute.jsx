import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';

export default function ProtectedRoute({ children, allowedRoles }) {
  const { user } = useAuth();
  const location = useLocation();

  if (!user) {
    // Redirect unauthenticated requests to /login
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  // Restrict non-role-assigned or empty claims accounts
  if (!user.role || user.role === '') {
    return <Navigate to="/pending-approval" replace />;
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
