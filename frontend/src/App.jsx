import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import SocketManager from './components/SocketManager';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingFallback from './components/LoadingFallback';
import MainLayout from './components/layout/MainLayout';

// Eagerly loaded components
import Home from './pages/Home';
import Login from './pages/Login';
import PendingApproval from './pages/PendingApproval';

// Lazy loaded components
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Bookings = React.lazy(() => import('./pages/Bookings'));
const TvDisplay = React.lazy(() => import('./pages/TvDisplay'));
const Illumination = React.lazy(() => import('./pages/Illumination'));
const Admin = React.lazy(() => import('./pages/Admin'));
const HardwareStatus = React.lazy(() => import('./pages/HardwareStatus'));

export default function App() {
  return (
    <AuthProvider>
      <SocketManager />
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes - No App Shell */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            <Route path="/pending-approval" element={<PendingApproval />} />

            {/* TV Display Route - Full Screen Read-Only */}
            <Route
              path="/tv-display"
              element={
                <ProtectedRoute allowedRoles={['tv', 'staff', 'admin']}>
                  <TvDisplay />
                </ProtectedRoute>
              }
            />

            {/* Authenticated Routes - Wrapped in MainLayout App Shell */}
            <Route element={
              <ProtectedRoute>
                <MainLayout />
              </ProtectedRoute>
            }>
              <Route
                path="/bookings"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}>
                    <Bookings />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}>
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/illumination"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}>
                    <Illumination />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedRoles={['admin']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/health"
                element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}>
                    <HardwareStatus />
                  </ProtectedRoute>
                }
              />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
