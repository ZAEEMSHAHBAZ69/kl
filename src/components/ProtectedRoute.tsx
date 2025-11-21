import { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../lib/supabase';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';

interface ProtectedRouteProps {
  children: ReactNode;
  allowedRoles?: UserRole[];
  requireAuth?: boolean;
}

export default function ProtectedRoute({
  children,
  allowedRoles,
  requireAuth = true
}: ProtectedRouteProps) {
  const { appUser, user, loading, refreshAppUser } = useAuth();
  const location = useLocation();

  // Show loading state only on initial load
  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0E0E0E] to-[#0A0A0A] flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48a77f] mx-auto mb-6"></div>
          <p className="text-white text-xl font-semibold mb-2">Authenticating...</p>
          <p className="text-gray-400 text-sm">Please wait while we verify your access</p>
        </div>
      </div>
    );
  }

  // If authentication is required but user is not authenticated
  if (requireAuth && !user) {
    return <Navigate to="/" state={{ from: location }} replace />;
  }

  // If authentication is not required and user is authenticated, redirect to dashboard
  if (!requireAuth && user && appUser) {
    return <Navigate to="/dashboard" replace />;
  }

  // If user is authenticated but appUser data is not loaded
  if (requireAuth && user && !appUser) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0E0E0E] to-[#0A0A0A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-2xl shadow-2xl p-8 border border-[#48a77f]/20 text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-yellow-500 to-orange-500 p-3 rounded-xl shadow-lg shadow-yellow-500/30">
                <AlertTriangle className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-4">Account Setup Pending</h1>
            <p className="text-gray-400 mb-6">
              Your account is being set up. This usually takes just a moment.
            </p>
            
            <div className="space-y-4">
              <button
                onClick={refreshAppUser}
                className="w-full bg-gradient-to-r from-[#48a77f] to-[#5BBF94] hover:shadow-lg hover:shadow-[#48a77f]/20 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
              >
                <RefreshCw className="w-4 h-4 mr-2" />
                Refresh Status
              </button>
              
              <p className="text-xs text-gray-500">
                If this persists, please contact support or try signing out and back in.
              </p>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Check role-based access
  if (allowedRoles && appUser && !allowedRoles.includes(appUser.role)) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0E0E0E] to-[#0A0A0A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-2xl shadow-2xl p-8 border border-[#48a77f]/20 text-center">
            <div className="flex items-center justify-center mb-6">
              <div className="bg-gradient-to-br from-red-600 to-red-700 p-3 rounded-xl shadow-lg shadow-red-600/30">
                <Shield className="w-8 h-8 text-white" />
              </div>
            </div>
            
            <h1 className="text-2xl font-bold text-white mb-4">Access Denied</h1>
            <p className="text-gray-400 mb-6">
              You don't have permission to access this page.
            </p>
            
            <div className="bg-[#1a1a1a] border border-gray-700 rounded-lg p-4 mb-6">
              <div className="flex justify-between items-center text-sm">
                <span className="text-gray-400">Your Role:</span>
                <span className="text-white font-semibold capitalize">{appUser.role}</span>
              </div>
              <div className="flex justify-between items-center text-sm mt-2">
                <span className="text-gray-400">Required:</span>
                <span className="text-[#48a77f] font-semibold">
                  {allowedRoles.map(role => role.charAt(0).toUpperCase() + role.slice(1)).join(', ')}
                </span>
              </div>
            </div>
            
            <button
              onClick={() => window.history.back()}
              className="w-full bg-[#1a1a1a] hover:bg-[#222222] border border-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all"
            >
              Go Back
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Render children if all checks pass
  return <>{children}</>;
}
