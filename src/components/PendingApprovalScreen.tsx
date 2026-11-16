import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { ShieldAlert, Clock, RefreshCw, LogOut, CheckCircle } from 'lucide-react';

export const PendingApprovalScreen: React.FC = () => {
  const { currentUser, refreshProfiles, logout } = useAuth();

  return (
    <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="bg-amber-600 px-6 py-6 text-white text-center">
          <div className="w-14 h-14 bg-white/20 rounded-full flex items-center justify-center mx-auto mb-3">
            <Clock className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Account Pending Manager Approval
          </h1>
          <p className="text-xs text-amber-100 mt-1">
            Security Operations Hub • Access Authorization Protocol
          </p>
        </div>

        {/* Message Body */}
        <div className="p-6 space-y-4 text-xs text-slate-700">
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-1">
            <span className="text-slate-400 block text-[10px] uppercase font-bold">
              Registered Profile
            </span>
            <div className="font-bold text-slate-900 text-sm">{currentUser?.display_name}</div>
            <div className="text-slate-500 font-mono text-[11px]">{currentUser?.email}</div>
          </div>

          <p className="leading-relaxed text-slate-600">
            Your Google account has been registered with the Security Operations Hub. In accordance with
            corporate security governance, <span className="font-semibold text-slate-900">authentication alone does not grant access to department records</span>.
          </p>

          <p className="leading-relaxed text-slate-600">
            An authorized <span className="font-semibold text-slate-900">Security Manager</span> must review and activate your profile before you can access regional task lists, inspection forms, or shift activities.
          </p>

          {/* Action Buttons */}
          <div className="pt-3 flex items-center justify-between border-t border-slate-200">
            <button
              type="button"
              onClick={refreshProfiles}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 font-semibold rounded-lg transition"
            >
              <RefreshCw className="w-3.5 h-3.5 text-slate-600" />
              <span>Refresh Status</span>
            </button>

            <button
              type="button"
              onClick={logout}
              className="inline-flex items-center space-x-1.5 px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-200 transition"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>Sign Out</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
