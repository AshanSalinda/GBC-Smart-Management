import { useAuth } from '../contexts/AuthContext';
import { Navigate } from 'react-router-dom';

export default function Login() {
  const { user } = useAuth();

  // If already logged in, redirect them based on their role
  if (user) {
    if (user.role === 'admin') return <Navigate to="/dashboard" replace />;
    if (user.role === 'staff') return <Navigate to="/bookings" replace />;
    if (user.role === 'tv') return <Navigate to="/tv-display" replace />;
    return <Navigate to="/" replace />;
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-gray-50">
      <div className="p-8 bg-white shadow-xl rounded-xl w-full max-w-md text-center">
        <h1 className="text-3xl font-bold text-gray-900 mb-6">Login</h1>
        <p className="text-gray-500">Firebase Authentication form placeholder</p>
      </div>
    </div>
  );
}
