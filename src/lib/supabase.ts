import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey);

export interface AppUser {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  status: string;
  permissions: any;
  last_login: string | null;
  created_at: string;
  updated_at: string;
  phone: string | null;
  name: string | null;
  company_name: string | null;
  invited_by: string | null;
}

export interface Publisher {
  id: string;
  name: string;
  domain: string;
  network_code: string | null;
  contact_email: string | null;
  partner_id: string | null;
  mcm_parent_id: string | null;
  gam_status: string | null;
  service_key_status: string | null;
  service_key_last_check: string | null;
  admin_approved: boolean | null;
  approved_at: string | null;
  approval_notes: string | null;
  last_revenue: number | null;
  last_ecpm: number | null;
  last_ctr: number | null;
  last_fill_rate: number | null;
  metrics_updated_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface Alert {
  id: string;
  publisher_id: string;
  type: string;
  severity: string;
  title: string;
  message: string;
  details: any;
  auto_actions_taken: any;
  status: string;
  acknowledged_by: string | null;
  acknowledged_at: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApprovalLog {
  id: string;
  publisher_id: string;
  user_id: string;
  action: string;
  notes: string | null;
  created_at: string;
}

export const authHelpers = {
  async signUp(email: string, password: string, metadata?: Record<string, any>) {
    return supabase.auth.signUp({
      email,
      password,
      options: {
        data: metadata,
      },
    });
  },

  async signIn(email: string, password: string) {
    return supabase.auth.signInWithPassword({
      email,
      password,
    });
  },

  async signInWithOTP(email: string) {
    return supabase.auth.signInWithOtp({
      email,
    });
  },

  async signOut() {
    return supabase.auth.signOut();
  },

  async resetPassword(email: string) {
    return supabase.auth.resetPasswordForEmail(email);
  },

  async updatePassword(newPassword: string) {
    return supabase.auth.updateUser({
      password: newPassword,
    });
  },

  async getSession() {
    return supabase.auth.getSession();
  },

  async getUser() {
    return supabase.auth.getUser();
  },
};
