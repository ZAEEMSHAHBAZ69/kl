import React, { createContext, useContext, useEffect, useState, ReactNode, useCallback } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, AppUser, authHelpers } from '../lib/supabase';

interface AuthContextType {
  user: User | null;
  appUser: AppUser | null;
  session: Session | null;
  loading: boolean;
  error: string | null;
  signIn: (email: string, password: string) => Promise<{ success: boolean; error?: string; role?: string }>;
  signInWithOTP: (email: string) => Promise<{ success: boolean; error?: string }>;
  signOut: () => Promise<void>;
  clearError: () => void;
  refreshAppUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Clear error function
  const clearError = useCallback(() => setError(null), []);

  // Fetch app user data from database with retry logic
  const fetchAppUser = useCallback(async (userId: string, retryCount = 0): Promise<AppUser | null> => {
    try {
      const { data, error } = await supabase
        .from('app_users')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (error) {
        if (retryCount === 0) {
          console.error('Error fetching app user:', error);
        }

        // Retry logic for database sync delays - only retry on specific errors
        if ((error.code === 'PGRST116' || error.message?.includes('policy')) && retryCount < 2) {
          await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
          return fetchAppUser(userId, retryCount + 1);
        }
        return null;
      }

      return data as AppUser;
    } catch (error) {
      if (retryCount === 0) {
        console.error('Failed to fetch app user:', error);
      }
      return null;
    }
  }, []);

  // Refresh app user data
  const refreshAppUser = useCallback(async (): Promise<void> => {
    if (user?.id) {
      const appUserData = await fetchAppUser(user.id);
      setAppUser(appUserData);
    }
  }, [user?.id, fetchAppUser]);

  // Enhanced sign in with role verification
  const signIn = useCallback(async (email: string, password: string): Promise<{ success: boolean; error?: string; role?: string }> => {
    try {
      setError(null);
      setLoading(true);
      
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Sign in error:', error);
        setError(error.message);
        return { success: false, error: error.message };
      }

      if (data.user) {
        setUser(data.user);
        setSession(data.session);
        
        // Fetch app user data for role verification
        const appUserData = await fetchAppUser(data.user.id);
        setAppUser(appUserData);
        
        return { 
          success: true, 
          role: appUserData?.role 
        };
      }

      return { success: false, error: 'No user data returned' };
    } catch (err: any) {
      console.error('Sign in exception:', err);
      const errorMessage = err.message || 'An unexpected error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, [fetchAppUser]);

  // Sign in with OTP
  const signInWithOTP = useCallback(async (email: string): Promise<{ success: boolean; error?: string }> => {
    try {
      setLoading(true);
      setError(null);

      const { error } = await authHelpers.signInWithOTP(email);

      if (error) {
        const errorMessage = (error as any)?.message || 'OTP sign in failed';
        setError(errorMessage);
        return { success: false, error: errorMessage };
      }

      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';
      setError(errorMessage);
      return { success: false, error: errorMessage };
    } finally {
      setLoading(false);
    }
  }, []);

  // Sign out
  const signOut = useCallback(async (): Promise<void> => {
    try {
      setLoading(true);
      setError(null);

      await authHelpers.signOut();
      
      // Clear all state
      setUser(null);
      setAppUser(null);
      setSession(null);
    } catch (error) {
      console.error('Sign out error:', error);
      setError(error instanceof Error ? error.message : 'Sign out failed');
    } finally {
      setLoading(false);
    }
  }, []);

  // Initialize auth state
  useEffect(() => {
    let mounted = true;
    let authTimeout: NodeJS.Timeout;

    const initializeAuth = async () => {
      try {
        // Set a maximum timeout for auth initialization
        authTimeout = setTimeout(() => {
          if (mounted && loading) {
            console.warn('Auth initialization timeout - resetting loading state');
            setLoading(false);
            setInitialLoadComplete(true);
            setError('Authentication timeout. Please refresh the page.');
          }
        }, 10000); // 10 second timeout

        // Get initial session
        const { data: sessionData, error: sessionError } = await authHelpers.getSession();

        if (sessionError) {
          console.error('Session error:', sessionError);

          // Handle refresh token errors by clearing session
          if (sessionError.message?.includes('refresh_token_not_found') ||
              sessionError.message?.includes('Invalid Refresh Token')) {
            console.log('Invalid refresh token detected, clearing session...');
            await supabase.auth.signOut();
            if (mounted) {
              setUser(null);
              setAppUser(null);
              setSession(null);
              setError(null);
              setLoading(false);
              setInitialLoadComplete(true);
            }
            return;
          }

          if (mounted) {
            setError((sessionError as any)?.message || 'Session error occurred');
            setLoading(false);
            setInitialLoadComplete(true);
          }
          return;
        }

        if (sessionData?.session && sessionData.session.user && mounted) {
          setUser(sessionData.session.user);
          setSession(sessionData.session);

          // Fetch app user data
          const appUserData = await fetchAppUser(sessionData.session.user.id);
          if (mounted) {
            setAppUser(appUserData);
          }
        }

        if (mounted) {
          setLoading(false);
          setInitialLoadComplete(true);
        }
      } catch (error) {
        console.error('Auth initialization error:', error);

        // Handle refresh token errors in catch block as well
        if (error instanceof Error &&
            (error.message?.includes('refresh_token_not_found') ||
             error.message?.includes('Invalid Refresh Token'))) {
          console.log('Invalid refresh token in catch, clearing session...');
          await supabase.auth.signOut();
          if (mounted) {
            setUser(null);
            setAppUser(null);
            setSession(null);
            setError(null);
            setLoading(false);
            setInitialLoadComplete(true);
          }
          return;
        }

        if (mounted) {
          setError(error instanceof Error ? error.message : 'Authentication initialization failed');
          setLoading(false);
          setInitialLoadComplete(true);
        }
      } finally {
        clearTimeout(authTimeout);
      }
    };

    // Set up auth state listener with proper async handling
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (!mounted) return;

        // Use async IIFE to avoid deadlocks
        (async () => {
          try {
            if (event === 'SIGNED_IN' && session?.user) {
              setUser(session.user);
              setSession(session);

              // Fetch app user data
              const appUserData = await fetchAppUser(session.user.id);
              setAppUser(appUserData);
              setError(null);
              if (!initialLoadComplete) {
                setLoading(false);
                setInitialLoadComplete(true);
              }
            } else if (event === 'SIGNED_OUT') {
              setUser(null);
              setAppUser(null);
              setSession(null);
              setError(null);
              if (!initialLoadComplete) {
                setLoading(false);
                setInitialLoadComplete(true);
              }
            } else if (event === 'TOKEN_REFRESHED' && session) {
              setUser(session.user);
              setSession(session);

              // Ensure appUser data is still available after token refresh
              if (!appUser && session.user) {
                const appUserData = await fetchAppUser(session.user.id);
                setAppUser(appUserData);
              }
            } else if (event === 'USER_UPDATED' && session) {
              setUser(session.user);
              setSession(session);
            }
          } catch (error) {
            console.error('Auth state change error:', error);

            // Handle refresh token errors in auth state changes
            if (error instanceof Error &&
                (error.message?.includes('refresh_token_not_found') ||
                 error.message?.includes('Invalid Refresh Token'))) {
              console.log('Invalid refresh token in auth state change, signing out...');
              await supabase.auth.signOut();
              setUser(null);
              setAppUser(null);
              setSession(null);
              setError(null);
              if (!initialLoadComplete) {
                setLoading(false);
                setInitialLoadComplete(true);
              }
              return;
            }

            setError(error instanceof Error ? error.message : 'Authentication error');
            if (!initialLoadComplete) {
              setLoading(false);
              setInitialLoadComplete(true);
            }
          }
        })();
      }
    );

    // Initialize auth
    initializeAuth();

    // Cleanup function
    return () => {
      mounted = false;
      if (authTimeout) {
        clearTimeout(authTimeout);
      }
      subscription.unsubscribe();
    };
  }, []); // Remove fetchAppUser dependency to prevent infinite loops

  const value: AuthContextType = {
    user,
    appUser,
    session,
    loading,
    error,
    signIn,
    signInWithOTP,
    signOut,
    clearError,
    refreshAppUser
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
};
