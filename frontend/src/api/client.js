import axios from 'axios';
import { auth } from '../config/firebase';
import { signOut } from 'firebase/auth';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';

const apiClient = axios.create({
  baseURL: BACKEND_URL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request Interceptor: Attach Firebase Auth Token
apiClient.interceptors.request.use(
  async (config) => {
    try {
      if (auth.currentUser) {
        const token = await auth.currentUser.getIdToken();
        if (token) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    } catch (error) {
      console.error('Error fetching Firebase token:', error);
      return Promise.reject(error);
    }
  },
  (error) => {
    return Promise.reject(error);
  }
);

// Response Interceptor: Handle Global Errors
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    // Globally handle 401 Unauthorized (e.g. expired or invalid token)
    if (error.response && error.response.status === 401) {
      console.warn('Unauthorized request (401). Forcing sign out...');
      // Signing out of Firebase will trigger onAuthStateChanged in AuthContext
      // which safely sets user to null, and ProtectedRoute redirects to /login automatically.
      signOut(auth).catch((err) => console.error('Failed to sign out on 401:', err));
    }
    return Promise.reject(error);
  }
);

export default apiClient;
