import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, ArrowLeft, CheckCircle, AlertCircle } from 'lucide-react';

interface PasswordResetProps {
  onBack?: () => void;
}

export default function PasswordReset({ onBack }: PasswordResetProps) {
  const [email, setEmail] = useState('');
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setError('Please enter your email address');
      return;
    }

    setLoading(true);
    setError('');

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth/callback?type=recovery`,
      });

      if (error) {
        setError(error.message);
      } else {
        setSent(true);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (sent) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0E0E0E] to-[#0A0A0A] flex items-center justify-center p-4">
        <div className="w-full max-w-md">
          <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-2xl shadow-2xl p-8 border border-[#48a77f]/20">
            <div className="flex items-center justify-center mb-8">
              <div className="bg-gradient-to-br from-[#48a77f] to-[#5BBF94] p-3 rounded-xl shadow-lg shadow-[#48a77f]/30">
                <CheckCircle className="w-8 h-8 text-white" />
              </div>
            </div>

            <h1 className="text-3xl font-bold text-white text-center mb-2">
              Check Your Email
            </h1>
            <p className="text-gray-400 text-center mb-8">
              We've sent a password reset link to <strong className="text-white">{email}</strong>
            </p>

            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center">
                Click the link in your email to reset your password. The link will expire in 1 hour.
              </p>
              
              {onBack && (
                <button
                  onClick={onBack}
                  className="w-full bg-[#1a1a1a] hover:bg-[#222222] border border-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all flex items-center justify-center"
                >
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Back to Login
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-[#0A0A0A] via-[#0E0E0E] to-[#0A0A0A] flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-2xl shadow-2xl p-8 border border-[#48a77f]/20">
          <div className="flex items-center justify-center mb-8">
            <div className="bg-gradient-to-br from-[#48a77f] to-[#5BBF94] p-3 rounded-xl shadow-lg shadow-[#48a77f]/30">
              <Mail className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Reset Password
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Enter your email address and we'll send you a link to reset your password
          </p>

          {error && (
            <div className="mb-6 p-4 bg-red-900/20 border border-red-500/30 rounded-lg">
              <div className="flex items-center">
                <AlertCircle className="w-5 h-5 text-red-400 mr-2" />
                <p className="text-red-400 text-sm">{error}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-6">
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] transition-all"
                placeholder="you@company.com"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#48a77f] to-[#5BBF94] hover:shadow-lg hover:shadow-[#48a77f]/20 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Sending Reset Link...
                </>
              ) : (
                <>
                  <Mail className="w-5 h-5 mr-2" />
                  Send Reset Link
                </>
              )}
            </button>
          </form>

          {onBack && (
            <div className="mt-6 pt-6 border-t border-[#48a77f]/10 text-center">
              <button
                onClick={onBack}
                className="text-[#48a77f] hover:text-[#5BBF94] text-sm font-medium transition-colors flex items-center justify-center mx-auto"
              >
                <ArrowLeft className="w-4 h-4 mr-1" />
                Back to Login
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}