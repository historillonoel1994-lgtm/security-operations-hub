import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { DEMO_PROFILES } from '../lib/mockData.ts';
import { isEmbeddedInIframe, getStandaloneAppUrl } from '../lib/windowUtils.ts';
import {
  Shield,
  Lock,
  AlertCircle,
  ArrowRight,
  ExternalLink,
  Info,
  CheckCircle2,
} from 'lucide-react';

export const LoginView: React.FC = () => {
  const { loginWithGoogle, loginAsDemoUser, isLiveSupabase, error, clearError } = useAuth();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [setupModalOpen, setSetupModalOpen] = useState(false);

  const inIframe = isEmbeddedInIframe();
  const standaloneUrl = getStandaloneAppUrl();

  const handleGoogleSignIn = async () => {
    // If in iframe, guide the user to open standalone instead of throwing 403
    if (inIframe) {
      window.open(standaloneUrl, '_blank', 'noopener,noreferrer');
      return;
    }

    if (!isLiveSupabase) {
      setSetupModalOpen(true);
      return;
    }
    setGoogleLoading(true);
    try {
      await loginWithGoogle();
    } catch (e: any) {
      console.error(e);
    } finally {
      setGoogleLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md">
        {/* App Branding */}
        <div className="flex justify-center">
          <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center text-white shadow-xl shadow-blue-500/20">
            <Shield className="w-8 h-8" />
          </div>
        </div>
        <h2 className="mt-4 text-center text-2xl font-bold tracking-tight text-white">
          Security Operations Hub
        </h2>
        <p className="mt-1 text-center text-xs text-slate-400">
          Philippine Corporate Security Command & Task Follow-up System
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-white py-8 px-6 shadow-2xl rounded-2xl sm:px-10 border border-slate-200 space-y-6">
          {error && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{error}</span>
            </div>
          )}

          {/* Supabase Connection Status */}
          <div className="flex items-center justify-center space-x-1.5 text-xs text-emerald-800 bg-emerald-50 border border-emerald-200 py-1.5 px-3 rounded-lg font-medium">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
            <span>Supabase Connected (<code className="font-mono text-[11px]">nngqluxokryfyggjysdi</code>)</span>
          </div>

          {/* Primary Method: Google Sign-In or Embedded Preview Notice */}
          {inIframe ? (
            /* Running inside iframe (AI Studio preview): Google blocks OAuth in iframes with Error 403 */
            <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl space-y-3">
              <div className="flex items-start space-x-2.5">
                <Shield className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-bold text-amber-900 text-xs sm:text-sm">
                    Embedded Preview Detected
                  </h3>
                  <p className="text-xs text-amber-800 mt-0.5 font-medium leading-relaxed">
                    For secure Google Sign-In, open Security Operations Hub in a separate browser tab.
                  </p>
                </div>
              </div>

              <p className="text-[11px] text-amber-700 leading-relaxed">
                Google security policies prohibit OAuth authentication inside embedded iframes (Google Error 403) to prevent unauthorized credential capture. Opening the standalone page allows Google to authenticate your Gmail account normally.
              </p>

              <a
                href={standaloneUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full flex items-center justify-center space-x-2 py-2.5 px-4 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-xs transition"
              >
                <ExternalLink className="w-4 h-4" />
                <span>Open in Separate Browser Tab to Sign In</span>
              </a>
            </div>
          ) : (
            /* Standalone window: Google Sign-In button works directly */
            <div className="space-y-3">
              <button
                type="button"
                disabled={googleLoading}
                onClick={handleGoogleSignIn}
                className="w-full flex items-center justify-center space-x-3 py-2.5 px-4 border border-slate-300 rounded-xl shadow-xs bg-white text-sm font-semibold text-slate-700 hover:bg-slate-50 transition focus:outline-hidden focus:ring-2 focus:ring-offset-2 focus:ring-blue-500 disabled:opacity-50"
              >
                {/* Google G Icon */}
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.66-5.17 3.66-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.17 0 9.98 0 12s.45 3.83 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>{googleLoading ? 'Redirecting to Google...' : 'Sign In with Google (Gmail)'}</span>
              </button>

              <p className="text-[11px] text-center text-slate-500">
                First-time Gmail sign-ins submit an access request pending Security Manager approval.
              </p>
            </div>
          )}

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-200" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-slate-400 font-semibold">
                Or Test Immediately in Demo Mode
              </span>
            </div>
          </div>

          {/* Quick Demo Persona Switcher */}
          <div className="space-y-2">
            <p className="text-xs font-semibold text-slate-700">
              Select Demo Role to Evaluate Workflows:
            </p>

            <div className="space-y-1.5">
              {DEMO_PROFILES.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => loginAsDemoUser(p.id)}
                  className="w-full p-2.5 rounded-lg border border-slate-200 hover:border-blue-400 hover:bg-blue-50/50 text-left transition flex items-center justify-between text-xs"
                >
                  <div className="truncate pr-2">
                    <span className="font-semibold text-slate-900 block truncate">
                      {p.display_name}
                    </span>
                    <span className="text-[10px] text-slate-500">
                      {p.role === 'manager' ? 'Security Manager' : 'Field Supervisor'} •{' '}
                      {p.approved ? 'Approved' : 'Pending Approval'}
                    </span>
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                </button>
              ))}
            </div>
          </div>

          {/* Zero-Trust Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-2 text-[11px] text-slate-600">
            <Lock className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold text-slate-800 block">Confidential Corporate Portal</span>
              Access restricted to authorized regional security managers, supervisors, and investigators.
              All authentication attempts and task edits are audited.
            </div>
          </div>
        </div>
      </div>

      {/* Supabase Setup Modal for Google OAuth */}
      {setupModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full p-6 space-y-4 border border-slate-200 text-xs">
            <div className="flex items-center space-x-2 text-slate-900 font-bold text-sm">
              <Shield className="w-5 h-5 text-blue-600" />
              <span>Connect Live Supabase & Google OAuth</span>
            </div>

            <p className="text-slate-600 leading-relaxed">
              To use live Google OAuth and cloud storage, provide your Supabase project keys in{' '}
              <code className="bg-slate-100 font-mono px-1 py-0.5 rounded text-blue-700">.env.example</code> or your hosting environment variables:
            </p>

            <div className="p-3 bg-slate-900 text-slate-200 rounded-lg font-mono text-[11px] space-y-1">
              <div>VITE_SUPABASE_URL="https://your-project.supabase.co"</div>
              <div>VITE_SUPABASE_ANON_KEY="eyJhbGciOiJIUz..."</div>
            </div>

            <div className="text-slate-600 space-y-1">
              <span className="font-semibold block text-slate-800">Supabase Google Provider Setup:</span>
              <div>1. Go to Supabase Dashboard &gt; Authentication &gt; Providers &gt; Google.</div>
              <div>2. Enable Google and enter your Google OAuth Client ID & Client Secret.</div>
              <div>3. Add your application URL to Supabase Redirect URLs.</div>
            </div>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => setSetupModalOpen(false)}
                className="px-4 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg transition"
              >
                Close & Use Demo Mode
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
