import { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { LogIn, AlertCircle, Eye, EyeOff } from 'lucide-react';
import PasswordReset from '../components/PasswordReset';

export default function Login() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [localError, setLocalError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showPasswordReset, setShowPasswordReset] = useState(false);
  const [welcomeMessage, setWelcomeMessage] = useState('');
  
  const { signIn, error: authError, clearError } = useAuth();

  // Handle URL parameters for pre-filled email and welcome message
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const emailParam = urlParams.get('email');
    const welcomeParam = urlParams.get('welcome');
    
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
    
    if (welcomeParam === 'true') {
      setWelcomeMessage('Account created successfully! Please sign in with your new credentials.');
      // Clear the welcome message after 5 seconds
      setTimeout(() => setWelcomeMessage(''), 5000);
    }
    
    // Clean up URL parameters
    if (emailParam || welcomeParam) {
      const newUrl = window.location.pathname;
      window.history.replaceState({}, '', newUrl);
    }
  }, []);

  // Clear errors when changing inputs
  useEffect(() => {
    setLocalError('');
    clearError();
  }, [email, password, clearError]);

  if (showPasswordReset) {
    return <PasswordReset onBack={() => setShowPasswordReset(false)} />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email || !password) {
      setLocalError('Please enter both email and password');
      return;
    }

    setLocalError('');
    setLoading(true);

    try {
      const result = await signIn(email, password);
      
      if (!result.success) {
        setLocalError(result.error || 'Sign in failed');
      }
      // If successful, the AuthContext will handle the redirect
    } catch (err: any) {
      setLocalError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  const currentError = localError || authError;

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0E0E0E] to-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] shadow-2xl border border-[#48a77f]/20 rounded-2xl p-8">
          <div className="flex items-center justify-center mb-6">
            <div className="bg-gradient-to-br from-[#48a77f] to-[#5BBF94] rounded-xl w-16 h-16 flex items-center justify-center shadow-lg shadow-[#48a77f]/30">
              <LogIn className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">
            LP Media Control Center
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Sign in to manage your GAM accounts
          </p>

          {welcomeMessage && (
            <div className="bg-green-900/20 border border-green-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
              <LogIn className="w-5 h-5 text-green-400 flex-shrink-0" />
              <span className="text-green-400 text-sm">{welcomeMessage}</span>
            </div>
          )}

          {currentError && (
            <div className="bg-red-900/20 border border-red-500/30 rounded-lg p-4 mb-6 flex items-center gap-3">
              <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0" />
              <span className="text-red-400 text-sm">{currentError}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-gray-300 font-medium mb-2 text-sm">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#48a77f] focus:outline-none focus:ring-2 focus:ring-[#48a77f]/20 transition-all"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-gray-300 font-medium mb-2 text-sm">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  className="w-full px-4 py-3 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:border-[#48a77f] focus:outline-none focus:ring-2 focus:ring-[#48a77f]/20 transition-all pr-12"
                  placeholder="Enter your password"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors p-1"
                >
                  {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 bg-gradient-to-r from-[#48a77f] to-[#5BBF94] hover:shadow-lg hover:shadow-[#48a77f]/20 text-white font-semibold rounded-lg transition-all duration-200 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? (
                <>
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin"></div>
                  Signing in...
                </>
              ) : (
                <>
                  <LogIn className="w-5 h-5" />
                  Sign In
                </>
              )}
            </button>
          </form>

          <div className="relative my-6">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-[#48a77f]/10"></div>
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-4 bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] text-gray-600">
                Invite Only
              </span>
            </div>
          </div>

          <div className="text-center space-y-2">
            <p className="text-sm text-gray-400">
              This is an invite-only platform
            </p>
            <p className="text-xs text-gray-500">
              Access is restricted to authorized users only
            </p>
            <p className="text-xs text-gray-500">
              Contact <span className="text-[#48a77f]">partner@lpmedia.tech</span> for partnership
            </p>
          </div>

          <div className="mt-6 text-center">
            <button
              onClick={() => setShowPasswordReset(true)}
              className="text-[#48a77f] hover:text-[#5BBF94] text-sm font-medium transition-colors"
            >
              Forgot your password?
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
