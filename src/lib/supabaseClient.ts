/**
 * Supabase Client Configuration
 * Security Operations Hub (SOH)
 *
 * Configured for React + Vite.
 * Reads VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY (or VITE_SUPABASE_ANON_KEY).
 * Safe public browser keys only. Never embed service-role secrets in client code!
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Resolve URL and Key from environment variables with fallback to user's configured project
const envUrl = (import.meta.env.VITE_SUPABASE_URL as string | undefined)?.trim();
const envKey = (
  (import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string | undefined) ||
  (import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined)
)?.trim();

export const SUPABASE_URL = envUrl || 'https://nngqluxokryfyggjysdi.supabase.co';
export const SUPABASE_KEY = envKey || 'sb_publishable_seO9b8XhR_aHGBStSDEUSQ_rpOTUNiY';

export const isSupabaseConfigured = (): boolean => {
  return Boolean(
    SUPABASE_URL &&
    SUPABASE_URL.startsWith('https://') &&
    SUPABASE_KEY &&
    SUPABASE_KEY.length > 20
  );
};

// Singleton Supabase client instance
export const supabase: SupabaseClient = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

export const getSupabaseClient = (): SupabaseClient => {
  return supabase;
};

/**
 * Trigger Google OAuth Sign-in through Supabase Auth
 */
export async function signInWithGoogle() {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured yet. Check VITE_SUPABASE_URL and VITE_SUPABASE_PUBLISHABLE_KEY.');
  }

  // Redirect back to current origin (works for localhost, AI Studio preview, and Netlify)
  const redirectUrl = window.location.origin;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: {
      redirectTo: redirectUrl,
      queryParams: {
        access_type: 'offline',
        prompt: 'consent',
      },
    },
  });

  if (error) throw error;
  return data;
}

/**
 * Sign out of current Supabase session
 */
export async function signOutSupabase() {
  await supabase.auth.signOut();
}
