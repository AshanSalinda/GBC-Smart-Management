import React, { Suspense } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { AuthProvider } from './contexts/AuthContext';
import ProtectedRoute from './components/ProtectedRoute';
import LoadingFallback from './components/LoadingFallback';
import MainLayout from './components/layout/MainLayout';

// Eagerly loaded components
import Home from './pages/Home';
import Login from './pages/Login';

// Lazy loaded components
const Dashboard = React.lazy(() => import('./pages/Dashboard'));
const Bookings = React.lazy(() => import('./pages/Bookings'));
const TvDisplay = React.lazy(() => import('./pages/TvDisplay'));
const LightsControl = React.lazy(() => import('./pages/LightsControl'));
const Admin = React.lazy(() => import('./pages/Admin'));

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Suspense fallback={<LoadingFallback />}>
          <Routes>
            {/* Public Routes - No App Shell */}
            <Route path="/" element={<Home />} />
            <Route path="/login" element={<Login />} />
            
            {/* TV Display Route - Full Screen Read-Only */}
            <Route 
              path="/tv-display" 
              element={
                <ProtectedRoute allowedRoles={['tv', 'admin']}>
                  <TvDisplay />
                </ProtectedRoute>
              } 
            />

            {/* Authenticated Routes - Wrapped in MainLayout App Shell */}
            <Route element={<MainLayout />}>
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
                path="/lights-control" 
                element={
                  <ProtectedRoute allowedRoles={['staff', 'admin']}>
                    <LightsControl />
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
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
    </AuthProvider>
  );
}
