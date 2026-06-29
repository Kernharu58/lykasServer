import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { useState } from 'react';
import { GoogleOAuthProvider } from '@react-oauth/google';
import { AuthProvider } from './context/AuthContext';
import { ToastProvider } from './context/ToastContext';
import ProtectedRoute from './components/layout/ProtectedRoute';
import ErrorBoundary from './components/ErrorBoundary';
import Sidebar from './components/layout/Sidebar';
import Navbar from './components/layout/Navbar';
import Dashboard from './pages/Dashboard';
import Login from './pages/Login';
import VerifyEmail from './pages/VerifyEmail';
import ForgotPassword from './pages/ForgotPassword';
import ResetPassword from './pages/ResetPassword';
import ManagePets from './pages/ManagePets';
import Shifts from './pages/Shifts';
import Chat from './pages/Chat';
import Settings from './pages/Settings';
import Donations from './pages/Donations';
import Adoptions from './pages/Adoptions';
import Accounts from './pages/Accounts';
import AuditLogs from './pages/AuditLogs';
import Events from './pages/Events';
import Fosters from './pages/Fosters';
import Adopters from './pages/Adopters';
import Health from './pages/Health';
import Reports from './pages/Reports';
// BUG FIX: Import pages that existed but had no routes
import Monitoring from './pages/Monitoring';
import NotificationsAdmin from './pages/NotificationsAdmin';

function AdminLayout() {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);

  return (
    <div className="flex h-screen bg-slate-50 font-sans overflow-hidden">
      <Sidebar isOpen={isSidebarOpen} onClose={() => setIsSidebarOpen(false)} />

      <div className="flex-1 flex flex-col lg:ml-72 w-full min-w-0 transition-all duration-300">
        <Navbar onMenuClick={() => setIsSidebarOpen(true)} />

        <div className="flex-1 overflow-y-auto w-full">
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-center text-xs font-bold text-amber-900 sm:hidden">
            Admin workflows are optimized for desktop; mobile access is best for quick review.
          </div>

          <Routes>
            <Route path="/" element={<Dashboard />} />
            <Route path="/adoptions" element={<Adoptions />} />
            <Route path="/fosters" element={<Fosters />} />
            <Route path="/adopters" element={<Adopters />} />
            <Route path="/pets" element={<ManagePets />} />
            <Route path="/shifts" element={<Shifts />} />
            <Route path="/events" element={<Events />} />
            <Route path="/health" element={<Health />} />
            <Route path="/reports" element={<Reports />} />
            <Route path="/chat" element={<Chat />} />
            <Route path="/donations" element={<Donations />} />
            <Route path="/settings" element={<Settings />} />
            {/* BUG FIX: Add missing routes for Monitoring and Notifications */}
            <Route path="/monitoring" element={<Monitoring />} />
            <Route path="/notifications" element={<NotificationsAdmin />} />

            <Route path="/accounts" element={
              <ProtectedRoute allowedRoles={['admin', 'super_admin']}>
                <Accounts />
              </ProtectedRoute>
            } />

            <Route path="/audit-logs" element={
              <ProtectedRoute allowedRoles={['super_admin']}>
                <AuditLogs />
              </ProtectedRoute>
            } />

            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </div>
  );
}

export default function App() {
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID || '';

  return (
    <GoogleOAuthProvider clientId={googleClientId}>
      <AuthProvider>
        <ToastProvider>
          <ErrorBoundary>
            <Router>
              <Routes>
                <Route path="/login" element={<Login />} />
                <Route path="/verify-email" element={<VerifyEmail />} />
                <Route path="/forgot-password" element={<ForgotPassword />} />
                <Route path="/reset-password" element={<ResetPassword />} />
                <Route
                  path="/*"
                  element={
                    <ProtectedRoute allowedRoles={['admin', 'staff', 'super_admin']}>
                      <AdminLayout />
                    </ProtectedRoute>
                  }
                />
              </Routes>
            </Router>
          </ErrorBoundary>
        </ToastProvider>
      </AuthProvider>
    </GoogleOAuthProvider>
  );
}
