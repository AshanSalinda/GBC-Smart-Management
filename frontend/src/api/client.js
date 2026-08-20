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

// Response Interceptor: Handle Global Errors and Token Refresh
apiClient.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;

    // Globally handle 401 Unauthorized (e.g., expired token)
    if (error.response && error.response.status === 401 && !originalRequest._retry) {
      if (auth.currentUser) {
        originalRequest._retry = true; // Mark request as retried to prevent infinite loops

        try {
          console.log('Token likely expired. Attempting to force refresh...');
          // Pass `true` to force Firebase to fetch a fresh token from the server
          const newToken = await auth.currentUser.getIdToken(true);
          
          if (newToken) {
            // Update the failed request's header with the fresh token
            originalRequest.headers.Authorization = `Bearer ${newToken}`;
            
            // Seamlessly retry the original request
            return apiClient(originalRequest);
          }
        } catch (refreshError) {
          console.error('Failed to refresh token. Forcing sign out...', refreshError);
          // If refresh fails (e.g. account disabled, deleted), sign them out
          signOut(auth).catch((err) => console.error('Failed to sign out after refresh failure:', err));
          return Promise.reject(refreshError);
        }
      } else {
        // If there's no user object but we got a 401, sign out to clear state
        console.warn('Unauthorized request with no active user. Forcing sign out...');
        signOut(auth).catch((err) => console.error('Failed to sign out on 401:', err));
      }
    }
    
    return Promise.reject(error);
  }
);

export default apiClient;
