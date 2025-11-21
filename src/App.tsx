import { AuthProvider } from './contexts/AuthContext';
import { NotificationProvider } from './components/NotificationContainer';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Publishers from './pages/Publishers';
import ControlCenter from './pages/ControlCenter';
import Alerts from './pages/Alerts';
import Profile from './pages/Profile';
import Reports from './pages/Reports';
import MFABuster from './pages/MFABuster';
import AuditLogs from './pages/AuditLogs';
import AuthCallback from './pages/AuthCallback';
import InviteAcceptance from './pages/InviteAcceptance';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import { BrowserRouter, Routes, Route } from 'react-router-dom';

function AppContent() {
  return (
    <Routes>
      {/* Public routes */}
      <Route path="/auth/callback" element={<AuthCallback />} />
      <Route path="/invite/*" element={<InviteAcceptance />} />
      <Route path="/accept-invite" element={<InviteAcceptance />} />
      <Route
        path="/login"
        element={
          <ProtectedRoute requireAuth={false}>
            <Login />
          </ProtectedRoute>
        }
      />
      
      {/* Protected routes with Layout */}
      <Route 
        path="/" 
        element={
          <ProtectedRoute requireAuth={false}>
            <Login />
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/dashboard" 
        element={
          <ProtectedRoute>
            <Layout>
              <Dashboard />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/publishers" 
        element={
          <ProtectedRoute>
            <Layout>
              <Publishers />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/mcm-parents" 
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <Layout>
              <ControlCenter />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route 
        path="/alerts" 
        element={
          <ProtectedRoute>
            <Layout>
              <Alerts />
            </Layout>
          </ProtectedRoute>
        } 
      />
      
      <Route
        path="/reports"
        element={
          <ProtectedRoute>
            <Layout>
              <Reports />
            </Layout>
          </ProtectedRoute>
        }
      />
      
      <Route
        path="/mfa-buster"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <Layout>
              <MFABuster />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/profile"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin', 'partner']}>
            <Layout>
              <Profile />
            </Layout>
          </ProtectedRoute>
        }
      />

      <Route
        path="/audit-logs"
        element={
          <ProtectedRoute allowedRoles={['super_admin', 'admin']}>
            <Layout>
              <AuditLogs />
            </Layout>
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <NotificationProvider>
          <AppContent />
        </NotificationProvider>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;
