import { useEffect, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { connectSocket, disconnectSocket, getSocket } from '../services/websocket';
import { auth } from '../config/firebase';

export default function SocketManager() {
  const { user, loading } = useAuth();
  const visibilityHandlerRef = useRef(null);

  // Handle connection based on auth state
  useEffect(() => {
    let mounted = true;

    const setupSocket = async () => {
      if (user && auth.currentUser) {
        try {
          const token = await auth.currentUser.getIdToken();
          if (mounted) {
            connectSocket(token);
          }
        } catch (error) {
          console.error("Failed to get Firebase token for WebSocket:", error);
        }
      } else if (!user && !loading) {
        disconnectSocket();
      }
    };

    setupSocket();

    return () => {
      mounted = false;
    };
  }, [user, loading]);

  // Handle visibility changes for resilience
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible' && user && auth.currentUser) {
        const socket = getSocket();
        if (!socket || !socket.connected) {
          console.log("Tab became visible, socket disconnected. Reconnecting...");
          try {
            // Force refresh token on reconnect
            const token = await auth.currentUser.getIdToken(true);
            connectSocket(token);
          } catch (error) {
            console.error("Failed to refresh token on visibility change:", error);
          }
        } else {
          // Socket is connected, execute background REST reconciliation (placeholder)
          console.log("Tab became visible, socket connected. Executing REST reconciliation.");
          // TODO: Implement GET /api/bookings/timeline and GET /api/tables/state here
        }
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    visibilityHandlerRef.current = handleVisibilityChange;

    return () => {
      if (visibilityHandlerRef.current) {
        document.removeEventListener('visibilitychange', visibilityHandlerRef.current);
      }
    };
  }, [user]);

  // Handle Firebase auth token refresh logic if needed
  useEffect(() => {
    // Listen for ID token changes (e.g. hourly refresh)
    const unsubscribe = auth.onIdTokenChanged(async (currentUser) => {
      if (currentUser) {
        const token = await currentUser.getIdToken();
        const socket = getSocket();
        if (socket && socket.connected && socket.auth.token !== token) {
          console.log("Token refreshed, reconnecting socket...");
          connectSocket(token);
        }
      }
    });

    return () => unsubscribe();
  }, []);

  return null;
}
