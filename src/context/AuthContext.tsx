/**
 * Authentication and Access Control Context
 * Security Operations Hub (SOH)
 *
 * Implements:
 * 1. Supabase Auth (Google OAuth) session management
 * 2. Instant Demo Mode simulation for evaluation & manual testing
 * 3. Strict access isolation: Unapproved accounts are blocked from task data
 * 4. Clean logout: Wipes state so no previous user data remains visible
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types/index.ts';
import { DEMO_PROFILES } from '../lib/mockData.ts';
import { getSupabaseClient, isSupabaseConfigured, signInWithGoogle, signOutSupabase } from '../lib/supabaseClient.ts';

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  isLiveSupabase: boolean;
  isManager: boolean;
  isApproved: boolean;
  allProfiles: UserProfile[];
  loginWithGoogle: () => Promise<void>;
  loginAsDemoUser: (profileId: string) => void;
  logout: () => Promise<void>;
  updateUserApproval: (userId: string, approved: boolean) => Promise<void>;
  updateUserActive: (userId: string, active: boolean) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const DEMO_PROFILES_STORAGE_KEY = 'soh_demo_profiles_v1';
const DEMO_ACTIVE_USER_KEY = 'soh_demo_active_user_id';

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [isLiveSupabase, setIsLiveSupabase] = useState<boolean>(false);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Initialize profiles from storage or demo data
  const loadStoredDemoProfiles = useCallback((): UserProfile[] => {
    try {
      const stored = localStorage.getItem(DEMO_PROFILES_STORAGE_KEY);
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.warn('Failed to parse stored demo profiles:', e);
    }
    return DEMO_PROFILES;
  }, []);

  const saveDemoProfiles = (updatedProfiles: UserProfile[]) => {
    setProfiles(updatedProfiles);
    try {
      localStorage.setItem(DEMO_PROFILES_STORAGE_KEY, JSON.stringify(updatedProfiles));
    } catch (e) {
      console.warn('Failed to save demo profiles to local storage:', e);
    }
  };

  // Fetch profiles from Supabase if configured, otherwise use demo profiles
  const refreshProfiles = useCallback(async () => {
    const supabase = getSupabaseClient();
    if (supabase && isSupabaseConfigured()) {
      try {
        const { data, error: fetchErr } = await supabase
          .from('profiles')
          .select('*')
          .order('created_at', { ascending: false });

        if (fetchErr) {
          console.warn('Could not fetch Supabase profiles, using demo list:', fetchErr.message);
          setProfiles(loadStoredDemoProfiles());
        } else if (data) {
          setProfiles(data as UserProfile[]);
        }
      } catch (err: any) {
        console.warn('Error fetching Supabase profiles:', err.message);
        setProfiles(loadStoredDemoProfiles());
      }
    } else {
      setProfiles(loadStoredDemoProfiles());
    }
  }, [loadStoredDemoProfiles]);

  // Initial load & Supabase Auth Listener
  useEffect(() => {
    const initAuth = async () => {
      setLoading(true);
      const supabaseConfigured = isSupabaseConfigured();
      setIsLiveSupabase(supabaseConfigured);

      if (supabaseConfigured) {
        const supabase = getSupabaseClient()!;
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (session?.user) {
            // Fetch profile for authenticated user
            let { data: profileData } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profileData) {
              // Wait briefly for potential database trigger execution
              await new Promise((res) => setTimeout(res, 300));
              const retry = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              profileData = retry.data;
            }

            if (!profileData) {
              // Self-register initial profile as pending member
              const newProfile: UserProfile = {
                id: session.user.id,
                email: session.user.email || 'user@company.ph',
                display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Security Officer',
                role: 'member',
                approved: false, // Default is pending
                active: true,
                created_at: new Date().toISOString(),
              };
              await supabase.from('profiles').insert(newProfile);
              setCurrentUser(newProfile);
            } else {
              setCurrentUser(profileData as UserProfile);
            }
          } else {
            setCurrentUser(null);
          }
        } catch (err: any) {
          console.error('Supabase session initialization error:', err);
          setCurrentUser(null);
        }

        // Listen for auth state changes
        const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
          if (session?.user) {
            let { data: profile } = await supabase
              .from('profiles')
              .select('*')
              .eq('id', session.user.id)
              .maybeSingle();

            if (!profile) {
              await new Promise((res) => setTimeout(res, 300));
              const retry = await supabase
                .from('profiles')
                .select('*')
                .eq('id', session.user.id)
                .maybeSingle();
              profile = retry.data;
            }

            if (!profile) {
              const newProfile: UserProfile = {
                id: session.user.id,
                email: session.user.email || 'user@company.ph',
                display_name: session.user.user_metadata?.full_name || session.user.email?.split('@')[0] || 'Security Officer',
                role: 'member',
                approved: false,
                active: true,
                created_at: new Date().toISOString(),
              };
              await supabase.from('profiles').insert(newProfile);
              profile = newProfile;
            }

            if (profile) setCurrentUser(profile as UserProfile);
            await refreshProfiles();
          } else {
            setCurrentUser(null);
          }
        });

        await refreshProfiles();
        setLoading(false);
        return () => {
          authListener?.subscription?.unsubscribe();
        };
      } else {
        // In Demo Sandbox mode: check for previously selected demo user
        const demoProfiles = loadStoredDemoProfiles();
        setProfiles(demoProfiles);
        const lastActiveId = localStorage.getItem(DEMO_ACTIVE_USER_KEY);
        if (lastActiveId) {
          const found = demoProfiles.find((p) => p.id === lastActiveId);
          if (found) {
            setCurrentUser(found);
          } else {
            setCurrentUser(demoProfiles[0]); // Default to Security Manager
          }
        } else {
          setCurrentUser(demoProfiles[0]); // Default to Security Manager
        }
        setLoading(false);
      }
    };

    initAuth();
  }, [loadStoredDemoProfiles, refreshProfiles]);

  // Demo user login switcher
  const loginAsDemoUser = (profileId: string) => {
    const target = profiles.find((p) => p.id === profileId);
    if (target) {
      setCurrentUser(target);
      localStorage.setItem(DEMO_ACTIVE_USER_KEY, target.id);
      setError(null);
    }
  };

  // Google OAuth via Supabase
  const handleLoginWithGoogle = async () => {
    setError(null);
    try {
      await signInWithGoogle();
    } catch (err: any) {
      setError(err.message || 'Google OAuth failed to initialize');
      throw err;
    }
  };

  // Logout wipes state completely so no sensitive data remains in the view
  const logout = async () => {
    setLoading(true);
    try {
      if (isLiveSupabase) {
        await signOutSupabase();
      }
      localStorage.removeItem(DEMO_ACTIVE_USER_KEY);
      setCurrentUser(null);
    } finally {
      setLoading(false);
    }
  };

  // Manager updates user approval status (Pending -> Approved or Revoke)
  const updateUserApproval = async (userId: string, approved: boolean) => {
    const supabase = getSupabaseClient();
    if (supabase && isLiveSupabase) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ approved, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (updateErr) throw updateErr;
      await refreshProfiles();
    } else {
      // Demo mode update
      const updated = profiles.map((p) =>
        p.id === userId ? { ...p, approved, updated_at: new Date().toISOString() } : p
      );
      saveDemoProfiles(updated);
      if (currentUser?.id === userId) {
        setCurrentUser({ ...currentUser, approved });
      }
    }
  };

  // Manager toggles active status (e.g. employee offboarded)
  const updateUserActive = async (userId: string, active: boolean) => {
    const supabase = getSupabaseClient();
    if (supabase && isLiveSupabase) {
      const { error: updateErr } = await supabase
        .from('profiles')
        .update({ active, updated_at: new Date().toISOString() })
        .eq('id', userId);
      if (updateErr) throw updateErr;
      await refreshProfiles();
    } else {
      const updated = profiles.map((p) =>
        p.id === userId ? { ...p, active, updated_at: new Date().toISOString() } : p
      );
      saveDemoProfiles(updated);
      if (currentUser?.id === userId) {
        setCurrentUser({ ...currentUser, active });
      }
    }
  };

  const isManager = currentUser?.role === 'manager';
  const isApproved = Boolean(currentUser?.approved && currentUser?.active);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isLiveSupabase,
        isManager,
        isApproved,
        allProfiles: profiles,
        loginWithGoogle: handleLoginWithGoogle,
        loginAsDemoUser,
        logout,
        updateUserApproval,
        updateUserActive,
        refreshProfiles,
        error,
        clearError: () => setError(null),
      }}
    >
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
