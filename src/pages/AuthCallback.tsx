import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { AlertCircle, CheckCircle, Eye, EyeOff } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { refreshAppUser } = useAuth();
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [needsPasswordSetup, setNeedsPasswordSetup] = useState(false);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [settingPassword, setSettingPassword] = useState(false);

  useEffect(() => {
    handleAuthCallback();
  }, []);

  const handleAuthCallback = async () => {
    try {
      const type = searchParams.get('type');
      
      if (type === 'recovery') {
        // Password recovery flow - need to exchange tokens for session
        const accessToken = searchParams.get('access_token');
        const refreshToken = searchParams.get('refresh_token');
        
        if (accessToken && refreshToken) {
          // Set the session using the tokens from the URL
          const { data, error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken
          });
          
          if (error) {
            setError(`Failed to establish recovery session: ${error.message}`);
            setLoading(false);
            return;
          }
          
          if (data.session) {
            setSuccess('Password reset link verified. Please set your new password.');
            setNeedsPasswordSetup(true);
            setLoading(false);
            return;
          }
        }
        
        setError('Invalid or expired password reset link.');
        setLoading(false);
        return;
      }

      // Handle email confirmation or magic link
      const { data, error } = await supabase.auth.getSession();
      
      if (error) {
        setError(`Authentication error: ${error.message}`);
        setLoading(false);
        return;
      }

      if (data.session) {
        // Refresh app user data
        await refreshAppUser();
        
        setSuccess('Authentication successful! Redirecting...');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      } else {
        setError('No valid session found. Please try signing in again.');
        setTimeout(() => {
          navigate('/login', { replace: true });
        }, 3000);
      }
    } catch (err: any) {
      setError(`Unexpected error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSetup = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!password || !confirmPassword) {
      setError('Please fill in all fields');
      return;
    }

    if (password.length < 8) {
      setError('Password must be at least 8 characters long');
      return;
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setSettingPassword(true);
    setError('');

    try {
      const { error } = await supabase.auth.updateUser({
        password: password
      });

      if (error) {
        setError(error.message);
      } else {
        // Refresh app user data after password update
        await refreshAppUser();
        
        setSuccess('Password updated successfully! Redirecting...');
        setTimeout(() => {
          navigate('/dashboard', { replace: true });
        }, 2000);
      }
    } catch (err: any) {
      setError(err.message || 'Failed to update password');
    } finally {
      setSettingPassword(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48a77f] mx-auto mb-4"></div>
          <p className="text-white text-lg">Processing authentication...</p>
        </div>
      </div>
    );
  }

  if (needsPasswordSetup) {
    return (
      <div className="min-h-screen bg-black flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-[#161616] rounded-2xl shadow-2xl p-8 border border-[#2C2C2C]">
            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Set New Password
            </h1>
            <p className="text-gray-400 text-center mb-8">
              Please create a new password for your account
            </p>

            {error && (
              <div className="mb-6 p-4 bg-red-500/10 border border-red-500 rounded-lg">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-500 mr-2" />
                  <p className="text-red-500 text-sm">{error}</p>
                </div>
              </div>
            )}

            <form onSubmit={handlePasswordSetup} className="space-y-6">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  New Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    className="w-full bg-black border border-[#2C2C2C] rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-[#48a77f] transition-colors"
                    placeholder="Enter new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Must be at least 8 characters long
                </p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Confirm Password
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required
                    className="w-full bg-black border border-[#2C2C2C] rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:border-[#48a77f] transition-colors"
                    placeholder="Confirm new password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-300 transition-colors"
                  >
                    {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={settingPassword}
                className="w-full bg-[#48a77f] hover:bg-[#3d9166] text-white font-semibold py-3 px-4 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
              >
                {settingPassword ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                    Updating Password...
                  </>
                ) : (
                  'Update Password'
                )}
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-[#161616] rounded-2xl shadow-2xl p-8 border border-[#2C2C2C] text-center">
          {success ? (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="bg-green-600 p-3 rounded-xl">
                  <CheckCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Success!</h1>
              <p className="text-gray-400">{success}</p>
            </>
          ) : (
            <>
              <div className="flex items-center justify-center mb-6">
                <div className="bg-red-600 p-3 rounded-xl">
                  <AlertCircle className="w-8 h-8 text-white" />
                </div>
              </div>
              <h1 className="text-2xl font-bold text-white mb-4">Authentication Error</h1>
              <p className="text-gray-400 mb-6">{error}</p>
              <button
                onClick={() => navigate('/login', { replace: true })}
                className="bg-[#48a77f] hover:bg-[#3d9166] text-white font-semibold py-2 px-4 rounded-lg transition-colors"
              >
                Back to Login
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}