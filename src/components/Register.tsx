import { useState } from 'react';
import { supabase } from '../lib/supabase';
import { UserPlus, AlertCircle, Eye, EyeOff, CheckCircle, ArrowLeft } from 'lucide-react';

interface RegisterProps {
  onBack?: () => void;
}

export default function Register({ onBack }: RegisterProps) {
  const [formData, setFormData] = useState({
    email: '',
    password: '',
    confirmPassword: '',
    firstName: '',
    lastName: ''
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [registered, setRegistered] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError(''); // Clear error when user types
  };

  const validateForm = () => {
    if (!formData.email || !formData.password || !formData.firstName || !formData.lastName) {
      setError('All fields are required');
      return false;
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters long');
      return false;
    }

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return false;
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(formData.email)) {
      setError('Please enter a valid email address');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) return;

    setLoading(true);
    setError('');

    try {
      const { error: signUpError } = await supabase.auth.signUp({
        email: formData.email,
        password: formData.password,
        options: {
          data: {
            first_name: formData.firstName,
            last_name: formData.lastName,
            full_name: `${formData.firstName} ${formData.lastName}`
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`
        }
      });

      if (signUpError) {
        setError(signUpError.message);
      } else {
        setRegistered(true);
      }
    } catch (err: any) {
      setError(err.message || 'An unexpected error occurred');
    } finally {
      setLoading(false);
    }
  };

  if (registered) {
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
              We've sent a confirmation link to <strong className="text-white">{formData.email}</strong>
            </p>

            <div className="space-y-4">
              <p className="text-sm text-gray-400 text-center">
                Click the link in your email to verify your account and complete the registration process.
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
              <UserPlus className="w-8 h-8 text-white" />
            </div>
          </div>

          <h1 className="text-3xl font-bold text-white text-center mb-2">
            Create Account
          </h1>
          <p className="text-gray-400 text-center mb-8">
            Join us to get started with your account
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
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  First Name
                </label>
                <input
                  type="text"
                  name="firstName"
                  value={formData.firstName}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] transition-all"
                  placeholder="John"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-2">
                  Last Name
                </label>
                <input
                  type="text"
                  name="lastName"
                  value={formData.lastName}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] transition-all"
                  placeholder="Doe"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Email Address
              </label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleInputChange}
                required
                className="w-full bg-black border border-[#2C2C2C] rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:border-[#48a77f] transition-colors"
                placeholder="you@company.com"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Password
              </label>
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  name="password"
                  value={formData.password}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] transition-all"
                  placeholder="Create a strong password"
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
                  name="confirmPassword"
                  value={formData.confirmPassword}
                  onChange={handleInputChange}
                  required
                  className="w-full bg-[#1a1a1a] border border-gray-700 rounded-lg px-4 py-3 pr-12 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] transition-all"
                  placeholder="Confirm your password"
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
              disabled={loading}
              className="w-full bg-gradient-to-r from-[#48a77f] to-[#5BBF94] hover:shadow-lg hover:shadow-[#48a77f]/20 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center"
            >
              {loading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Creating Account...
                </>
              ) : (
                <>
                  <UserPlus className="w-5 h-5 mr-2" />
                  Create Account
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