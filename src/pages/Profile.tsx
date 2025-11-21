import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../contexts/AuthContext';
import { Loader2, User, Mail, Phone, Shield, Activity, Save } from 'lucide-react';

interface UserProfile {
  id: string;
  full_name: string;
  email: string;
  phone: string;
  role: string;
  status: string;
  created_at: string;
  updated_at: string;
}

export default function Profile() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [alert, setAlert] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  const [formData, setFormData] = useState({
    full_name: '',
    phone: '',
  });

  useEffect(() => {
    fetchProfile();
  }, [user]);

  const fetchProfile = async () => {
    if (!user) return;

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', user.id)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setProfile(data);
        setFormData({
          full_name: data.full_name || '',
          phone: data.phone || '',
        });
      }
    } catch (error) {
      console.error('Error fetching profile:', error);
      setAlert({
        type: 'error',
        message: 'Failed to load profile. Please try again.',
      });
    } finally {
      setLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user) return;

    try {
      setSaving(true);
      setAlert(null);

      const { error } = await supabase
        .from('app_users')
        .update({
          full_name: formData.full_name,
          phone: formData.phone,
        })
        .eq('id', user.id);

      if (error) throw error;

      setAlert({
        type: 'success',
        message: 'Profile updated successfully!',
      });

      await fetchProfile();
    } catch (error: any) {
      console.error('Error updating profile:', error);
      setAlert({
        type: 'error',
        message: error.message || 'Failed to update profile. Please try again.',
      });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-[#48a77f]" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="max-w-2xl mx-auto p-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-red-800">Profile not found. Please contact support.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto p-6">
      <div className="bg-gradient-to-br from-[#0E0E0E] via-[#161616] to-[#0E0E0E] rounded-2xl shadow-xl border border-[#48a77f]/20">
        <div className="px-6 py-5 border-b border-[#48a77f]/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 bg-gradient-to-br from-[#48a77f] to-[#5BBF94] rounded-full flex items-center justify-center shadow-lg">
              <User className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-white">Profile Settings</h1>
              <p className="text-sm text-gray-400 mt-1">Manage your personal information</p>
            </div>
          </div>
        </div>

        {alert && (
          <div className="mx-6 mt-6">
            <div
              className={`rounded-lg p-4 border ${
                alert.type === 'success'
                  ? 'bg-green-900/20 border-green-500/30'
                  : 'bg-red-900/20 border-red-500/30'
              }`}
            >
              <p
                className={`text-sm ${
                  alert.type === 'success' ? 'text-green-400' : 'text-red-400'
                }`}
              >
                {alert.message}
              </p>
            </div>
          </div>
        )}

        <form onSubmit={handleSave} className="p-6 space-y-6">
          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <User className="w-4 h-4" />
              Full Name
            </label>
            <input
              type="text"
              name="full_name"
              value={formData.full_name}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] focus:outline-none transition-all"
              placeholder="Enter your full name"
              required
            />
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Mail className="w-4 h-4" />
              Email
            </label>
            <input
              type="email"
              value={profile.email}
              disabled
              className="w-full px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-800 rounded-lg text-gray-400 cursor-not-allowed"
            />
            <p className="text-xs text-gray-500 mt-1">Email cannot be changed</p>
          </div>

          <div>
            <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
              <Phone className="w-4 h-4" />
              Phone
            </label>
            <input
              type="tel"
              name="phone"
              value={formData.phone}
              onChange={handleInputChange}
              className="w-full px-4 py-2.5 bg-[#1a1a1a] border border-gray-700 rounded-lg text-white placeholder-gray-500 focus:ring-2 focus:ring-[#48a77f] focus:border-[#48a77f] focus:outline-none transition-all"
              placeholder="Enter your phone number"
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Shield className="w-4 h-4" />
                Role
              </label>
              <input
                type="text"
                value={profile.role}
                disabled
                className="w-full px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-800 rounded-lg text-gray-400 cursor-not-allowed capitalize"
              />
              <p className="text-xs text-gray-500 mt-1">Role is assigned by admin</p>
            </div>

            <div>
              <label className="flex items-center gap-2 text-sm font-medium text-gray-300 mb-2">
                <Activity className="w-4 h-4" />
                Status
              </label>
              <input
                type="text"
                value={profile.status}
                disabled
                className="w-full px-4 py-2.5 bg-[#1a1a1a]/50 border border-gray-800 rounded-lg text-gray-400 cursor-not-allowed capitalize"
              />
            </div>
          </div>

          <div className="pt-4 border-t border-[#48a77f]/10">
            <button
              type="submit"
              disabled={saving}
              className="w-full sm:w-auto px-6 py-2.5 bg-gradient-to-r from-[#48a77f] to-[#5BBF94] text-white rounded-lg hover:shadow-lg hover:shadow-[#48a77f]/20 focus:ring-4 focus:ring-[#48a77f]/20 transition-all disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 font-medium"
            >
              {saving ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="w-4 h-4" />
                  Save Changes
                </>
              )}
            </button>
          </div>

          <div className="pt-4 border-t border-[#48a77f]/10">
            <div className="text-xs text-gray-400 space-y-1">
              <p>
                <span className="font-medium">Created:</span>{' '}
                {new Date(profile.created_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })}
              </p>
              <p>
                <span className="font-medium">Last Updated:</span>{' '}
                {new Date(profile.updated_at).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </p>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
