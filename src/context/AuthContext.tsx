/**
 * Authentication and Access Control Context (Production Mode)
 * Security Operations Hub (SOH)
 *
 * Implements:
 * 1. Supabase Auth (Google OAuth) session management as the sole authority.
 * 2. Zero-Trust Access Isolation: Unapproved accounts are blocked from task data.
 * 3. Role Validation: Manager status is strictly loaded from the Supabase profiles table.
 * 4. Complete Session Isolation: Logging out unloads all state immediately.
 */

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { UserProfile } from '../types/index.ts';
import { getSupabaseClient, signInWithGoogle, signOutSupabase } from '../lib/supabaseClient.ts';

interface AuthContextType {
  currentUser: UserProfile | null;
  loading: boolean;
  isManager: boolean;
  isApproved: boolean;
  allProfiles: UserProfile[];
  loginWithGoogle: () => Promise<void>;
  logout: () => Promise<void>;
  updateUserApproval: (userId: string, approved: boolean) => Promise<void>;
  updateUserActive: (userId: string, active: boolean) => Promise<void>;
  refreshProfiles: () => Promise<void>;
  error: string | null;
  clearError: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [currentUser, setCurrentUser] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [profiles, setProfiles] = useState<UserProfile[]>([]);
  const [error, setError] = useState<string | null>(null);

  // Fetch approved/registered team profiles from Supabase (for task assignment & approvals)
  const refreshProfiles = useCallback(async () => {
    const supabase = getSupabaseClient();
    try {
      const { data, error: fetchErr } = await supabase
        .from('profiles')
        .select('*')
        .order('created_at', { ascending: false });

      if (fetchErr) {
        console.warn('Error fetching Supabase profiles:', fetchErr.message);
      } else if (data) {
        setProfiles(data as UserProfile[]);
      }
    } catch (err: any) {
      console.warn('Network exception while fetching profiles:', err.message);
    }
  }, []);

  // Initialize session and listen for auth state changes
  useEffect(() => {
    const supabase = getSupabaseClient();

    const fetchUserProfile = async (userId: string, userEmail?: string, userFullName?: string) => {
      try {
        let { data: profileData, error: profileErr } = await supabase
          .from('profiles')
          .select('*')
          .eq('id', userId)
          .maybeSingle();

        // If trigger has not completed yet, wait briefly and retry
        if (!profileData && !profileErr) {
          await new Promise((res) => setTimeout(res, 350));
          const retry = await supabase
            .from('profiles')
            .select('*')
            .eq('id', userId)
            .maybeSingle();
          profileData = retry.data;
        }

        // If profile is still not in DB, create initial unapproved registration
        if (!profileData) {
          const newProfile: UserProfile = {
            id: userId,
            email: userEmail || 'user@company.ph',
            display_name: userFullName || userEmail?.split('@')[0] || 'Security Personnel',
            role: 'member',
            approved: false, // Must be approved by a Manager
            active: true,
            created_at: new Date().toISOString(),
          };
          await supabase.from('profiles').insert(newProfile);
          profileData = newProfile;
        }

        setCurrentUser(profileData as UserProfile);
      } catch (err: any) {
        console.error('Failed to load user profile from Supabase:', err);
        setCurrentUser(null);
      }
    };

    const initAuth = async () => {
      setLoading(true);
      try {
        const { data: { session } } = await supabase.auth.getSession();
        if (session?.user) {
          await fetchUserProfile(
            session.user.id,
            session.user.email,
            session.user.user_metadata?.full_name
          );
          await refreshProfiles();
        } else {
          setCurrentUser(null);
        }
      } catch (err: any) {
        console.error('Session initialization error:', err);
        setCurrentUser(null);
      } finally {
        setLoading(false);
      }
    };

    initAuth();

    // Listen for auth state changes (sign-in, token refresh, sign-out)
    const { data: authListener } = supabase.auth.onAuthStateChange(async (_event, session) => {
      if (session?.user) {
        await fetchUserProfile(
          session.user.id,
          session.user.email,
          session.user.user_metadata?.full_name
        );
        await refreshProfiles();
      } else {
        setCurrentUser(null);
        setProfiles([]);
      }
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, [refreshProfiles]);

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
      await signOutSupabase();
      setCurrentUser(null);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  };

  // Manager updates user approval status (Pending -> Approved or Revoke)
  const updateUserApproval = async (userId: string, approved: boolean) => {
    const supabase = getSupabaseClient();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ approved, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    // Refresh profiles list and local user if self
    await refreshProfiles();
    if (currentUser?.id === userId) {
      setCurrentUser({ ...currentUser, approved });
    }
  };

  // Manager toggles active status (e.g. employee offboarded)
  const updateUserActive = async (userId: string, active: boolean) => {
    const supabase = getSupabaseClient();
    const { error: updateErr } = await supabase
      .from('profiles')
      .update({ active, updated_at: new Date().toISOString() })
      .eq('id', userId);
    if (updateErr) throw updateErr;

    await refreshProfiles();
    if (currentUser?.id === userId) {
      setCurrentUser({ ...currentUser, active });
    }
  };

  const isManager = currentUser?.role === 'manager';
  const isApproved = Boolean(currentUser?.approved && currentUser?.active);

  return (
    <AuthContext.Provider
      value={{
        currentUser,
        loading,
        isManager,
        isApproved,
        allProfiles: profiles,
        loginWithGoogle: handleLoginWithGoogle,
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
