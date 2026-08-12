import { createContext, useContext, useState, useEffect } from 'react';

const AuthContext = createContext();

export function AuthProvider({ children }) {
  // Mocking the authentication state
  // Hardcoded to an 'admin' user as requested for initial testing
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate a brief loading delay for authentication check
    const timer = setTimeout(() => {
      setUser({
        uid: 'mock-admin-uid-12345',
        email: 'admin@gbcsmartmanagement.com',
        role: 'admin', // roles: admin, staff, tv
      });
      setLoading(false);
    }, 500);

    return () => clearTimeout(timer);
  }, []);

  const value = {
    user,
    loading,
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
