import React, { useState, useEffect } from 'react';
import { Eye, EyeOff, AlertCircle, User, Loader2, Shield, Mail, Check, X } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Invitation {
  email: string;
  role: string;
  metadata?: {
    full_name?: string;
    company_name?: string;
  };
}

const InviteAcceptance: React.FC = () => {
  const navigate = useNavigate();
  const [token, setToken] = useState<string>('');
  const [invitation, setInvitation] = useState<Invitation | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [error, setError] = useState<string>('');
  const [success, setSuccess] = useState(false);

  const [formData, setFormData] = useState({
    password: '',
    confirmPassword: ''
  });

  const [passwordValidation, setPasswordValidation] = useState({
    length: false,
    uppercase: false,
    lowercase: false,
    number: false,
    special: false,
    match: false
  });

  useEffect(() => {
    const pathParts = window.location.pathname.split('/');
    const pathToken = pathParts[pathParts.length - 1];

    const queryToken = new URLSearchParams(window.location.search).get('token');

    const tokenToUse = pathToken && pathToken !== 'invite' ? pathToken : queryToken;

    if (tokenToUse) {
      const cleanToken = tokenToUse.split('?')[0].split('#')[0];
      setToken(cleanToken);
      verifyToken(cleanToken);
    } else {
      setError('No invitation token found in URL. Please check your invitation link and try again.');
      setLoading(false);
    }
  }, []);

  const verifyToken = async (tokenToValidate: string) => {
    try {
      setLoading(true);
      setError('');

      console.log('Verifying token:', tokenToValidate.substring(0, 8) + '...');

      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

      console.log('Calling accept-invite function at:', `${supabaseUrl}/functions/v1/accept-invite`);

      const response = await fetch(`${supabaseUrl}/functions/v1/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'verify',
          token: tokenToValidate
        })
      });

      console.log('Response status:', response.status);
      const data = await response.json();
      console.log('Response data:', data);

      if (response.ok && data.valid && data.invitation) {
        console.log('Token verified successfully');
        setInvitation(data.invitation);
      } else {
        console.error('Token verification failed:', data.error);
        setError(data.error || 'Invalid invitation token');
      }
    } catch (err) {
      console.error('Token verification error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate invitation';
      setError(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const validatePasswordRequirements = (password: string, confirmPassword: string) => {
    const validation = {
      length: password.length >= 8,
      uppercase: /[A-Z]/.test(password),
      lowercase: /[a-z]/.test(password),
      number: /\d/.test(password),
      special: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password),
      match: password === confirmPassword && password.length > 0
    };

    setPasswordValidation(validation);

    return Object.values(validation).every(v => v === true);
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    const newFormData = { ...formData, [name]: value };
    setFormData(newFormData);

    if (name === 'password' || name === 'confirmPassword') {
      validatePasswordRequirements(
        name === 'password' ? value : newFormData.password,
        name === 'confirmPassword' ? value : newFormData.confirmPassword
      );
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!invitation) {
      setError('No valid invitation found');
      return;
    }

    if (!validatePasswordRequirements(formData.password, formData.confirmPassword)) {
      setError('Please ensure all password requirements are met and passwords match');
      return;
    }

    setSubmitting(true);
    setError('');

    try {
      const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
      const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
      const response = await fetch(`${supabaseUrl}/functions/v1/accept-invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${supabaseAnonKey}`,
        },
        body: JSON.stringify({
          action: 'accept',
          token,
          password: formData.password
        })
      });

      const data = await response.json();

      if (response.ok && data.success) {
        setSuccess(true);

        setTimeout(() => {
          navigate(`/login?email=${encodeURIComponent(invitation.email)}&welcome=true`);
        }, 2000);
      } else {
        setError(data.error || 'Failed to create account. Please try again.');
      }
    } catch (err) {
      console.error('Account creation error:', err);
      setError('An unexpected error occurred. Please try again or contact support.');
    } finally {
      setSubmitting(false);
    }
  };

  const ErrorDisplay = ({ message }: { message: string }) => (
    <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
      <div className="flex items-start">
        <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 mr-3 flex-shrink-0" />
        <div>
          <h3 className="text-sm font-medium text-red-800 mb-1">
            {message.includes('rate limit') ? 'Rate Limit Exceeded' :
             message.includes('expired') ? 'Invitation Expired' :
             message.includes('invalid') ? 'Invalid Invitation' :
             'Error'}
          </h3>
          <div className="text-sm text-red-700 whitespace-pre-line">
            {message}
          </div>
        </div>
      </div>
    </div>
  );

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-[#48a77f] mx-auto mb-4"></div>
          <p className="text-white mb-2">Verifying invitation...</p>
          <p className="text-gray-400 text-sm">Please wait while we verify your invitation link</p>
        </div>
      </div>
    );
  }

  if (error && !invitation) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-[#161616] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md">
          <div className="text-center mb-6">
            <AlertCircle className="w-16 h-16 text-red-500 mx-auto mb-4" />
            <h1 className="text-2xl font-bold text-white mb-2">Invitation Error</h1>
          </div>

          <ErrorDisplay message={error} />

          <div className="space-y-3">
            <button
              onClick={() => window.location.reload()}
              className="w-full bg-emerald-600 text-white py-2 px-4 rounded-lg hover:bg-emerald-700 transition-colors"
            >
              Try Again
            </button>
            <button
              onClick={() => navigate('/login')}
              className="w-full bg-[#1E1E1E] text-white py-2 px-4 rounded-lg hover:bg-[#1E1E1E] transition-colors"
            >
              Go to Login
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
        <div className="bg-[#161616] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md text-center">
          <div className="mb-6">
            <div className="w-16 h-16 bg-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <Check className="w-8 h-8 text-white" />
            </div>
            <h2 className="text-2xl font-bold text-white mb-2">Account Created Successfully!</h2>
            <p className="text-gray-300 mb-4">
              Welcome to the platform! Your account has been set up with the following details:
            </p>

            {invitation && (
              <div className="bg-[#1E1E1E] rounded-lg p-4 mb-4 text-left">
                <div className="space-y-2 text-sm">
                  <div className="flex items-center text-gray-300">
                    <Mail className="w-4 h-4 mr-2" />
                    <span className="font-medium">Email:</span>
                    <span className="ml-2 text-white">{invitation.email}</span>
                  </div>
                  <div className="flex items-center text-gray-300">
                    <Shield className="w-4 h-4 mr-2" />
                    <span className="font-medium">Role:</span>
                    <span className="ml-2 text-white capitalize">{invitation.role.replace('_', ' ')}</span>
                  </div>
                  {invitation.metadata?.full_name && (
                    <div className="flex items-center text-gray-300">
                      <User className="w-4 h-4 mr-2" />
                      <span className="font-medium">Name:</span>
                      <span className="ml-2 text-white">{invitation.metadata.full_name}</span>
                    </div>
                  )}
                </div>
              </div>
            )}

            <p className="text-gray-400 text-sm mb-4">
              You will be redirected to the login page in 2 seconds.
            </p>
          </div>

          <div className="flex items-center justify-center">
            <Loader2 className="w-5 h-5 animate-spin text-[#48a77f] mr-2" />
            <span className="text-gray-400 text-sm">Redirecting...</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950 flex items-center justify-center p-4">
      <div className="bg-[#161616] rounded-lg p-8 border border-[#2C2C2C] w-full max-w-md">
        <div className="text-center mb-8">
          <Shield className="w-12 h-12 text-emerald-500 mx-auto mb-4" />
          <h1 className="text-2xl font-bold text-white mb-2">Complete Your Invitation</h1>
          <p className="text-gray-400">Create a secure password to activate your account</p>
        </div>

        {invitation && (
          <div className="bg-[#1E1E1E] rounded-lg p-4 mb-6">
            <h3 className="text-white font-medium mb-3">Invitation Details</h3>
            <div className="space-y-2 text-sm">
              <div className="flex items-center text-gray-300">
                <Mail className="w-4 h-4 mr-2" />
                <span>{invitation.email}</span>
              </div>
              <div className="flex items-center text-gray-300">
                <Shield className="w-4 h-4 mr-2" />
                <span className="capitalize">{invitation.role.replace('_', ' ')}</span>
              </div>
              {invitation.metadata?.full_name && (
                <div className="flex items-center text-gray-300">
                  <User className="w-4 h-4 mr-2" />
                  <span>{invitation.metadata.full_name}</span>
                </div>
              )}
            </div>
          </div>
        )}

        {error && <ErrorDisplay message={error} />}

        <form onSubmit={handleSubmit} className="space-y-6">
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
                className="w-full bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pr-12"
                placeholder="Enter your password"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                disabled={submitting}
              >
                {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
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
                className="w-full bg-[#1E1E1E] border border-[#2C2C2C] rounded-lg px-4 py-3 text-white placeholder-gray-400 focus:outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500 pr-12"
                placeholder="Confirm your password"
                required
                disabled={submitting}
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-white"
                disabled={submitting}
              >
                {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
              </button>
            </div>
          </div>

          <div className="bg-[#1E1E1E] rounded-lg p-4">
            <h4 className="text-sm font-medium text-gray-300 mb-3">Password Requirements</h4>
            <div className="space-y-2">
              {[
                { key: 'length', label: 'At least 8 characters' },
                { key: 'uppercase', label: 'One uppercase letter' },
                { key: 'lowercase', label: 'One lowercase letter' },
                { key: 'number', label: 'One number' },
                { key: 'special', label: 'One special character' },
                { key: 'match', label: 'Passwords match' }
              ].map(({ key, label }) => (
                <div key={key} className="flex items-center text-sm">
                  {passwordValidation[key as keyof typeof passwordValidation] ? (
                    <Check className="w-4 h-4 text-emerald-500 mr-2" />
                  ) : (
                    <X className="w-4 h-4 text-gray-600 mr-2" />
                  )}
                  <span className={passwordValidation[key as keyof typeof passwordValidation] ? 'text-emerald-400' : 'text-gray-400'}>
                    {label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          <button
            type="submit"
            disabled={submitting || !Object.values(passwordValidation).every(Boolean)}
            className="w-full bg-emerald-600 text-white py-3 px-4 rounded-lg font-medium hover:bg-emerald-700 disabled:bg-[#1E1E1E] disabled:cursor-not-allowed transition-colors flex items-center justify-center"
          >
            {submitting ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin mr-2" />
                Setting password...
              </>
            ) : (
              'Create Account'
            )}
          </button>
        </form>

        <div className="mt-6 text-center">
          <p className="text-xs text-gray-500">
            By creating an account, you agree to our security policies and terms of service.
            This invitation will expire and cannot be reused once your account is created.
          </p>
        </div>
      </div>
    </div>
  );
}

export default InviteAcceptance;
