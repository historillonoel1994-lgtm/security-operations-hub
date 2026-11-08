import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatPhilippineDateTime } from '../lib/dateUtils.ts';
import { X, User, Shield, Lock, ShieldCheck, Mail, MapPin } from 'lucide-react';

interface UserProfileModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserProfileModal: React.FC<UserProfileModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { currentUser, isManager, isLiveSupabase, logout } = useAuth();

  if (!isOpen || !currentUser) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-md w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <User className="w-5 h-5 text-blue-400" />
            <h2 className="text-base font-semibold">User Account Profile</h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4 text-xs">
          {/* User Card */}
          <div className="flex items-center space-x-3 p-3.5 bg-slate-50 border border-slate-200 rounded-lg">
            <div className="w-12 h-12 rounded-full bg-blue-700 text-white flex items-center justify-center font-bold text-lg">
              {currentUser.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="font-bold text-slate-900 text-sm">
                {currentUser.display_name}
              </div>
              <div className="text-slate-500 font-mono text-[11px] flex items-center space-x-1 mt-0.5">
                <Mail className="w-3 h-3 text-slate-400" />
                <span>{currentUser.email}</span>
              </div>
            </div>
          </div>

          {/* Role & Status Information */}
          <div className="space-y-2 border-t border-b border-slate-100 py-3 text-slate-700">
            <div className="flex justify-between">
              <span className="text-slate-500">Security Role:</span>
              <span className="font-semibold text-slate-900 capitalize">
                {isManager ? 'Corporate Security Manager' : 'Field Supervisor / Personnel'}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-500">Account Authorization:</span>
              <span
                className={`font-semibold ${
                  currentUser.approved ? 'text-emerald-700' : 'text-amber-700'
                }`}
              >
                {currentUser.approved ? 'Active & Approved' : 'Pending Manager Review'}
              </span>
            </div>

            {currentUser.regional_assignment && (
              <div className="flex justify-between">
                <span className="text-slate-500">Primary Assignment:</span>
                <span className="font-medium text-slate-800">
                  {currentUser.regional_assignment}
                </span>
              </div>
            )}

            <div className="flex justify-between">
              <span className="text-slate-500">Environment:</span>
              <span className="font-mono text-slate-600">
                {isLiveSupabase ? 'Supabase Cloud DB' : 'Demo Sandbox Mode'}
              </span>
            </div>
          </div>

          {/* Privacy & Minimal Data Statement */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-2 text-[11px] text-slate-600 leading-relaxed">
            <Lock className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-semibold text-slate-800 block">
                Minimal Personal Data Compliance
              </span>
              In accordance with privacy best practices, SOH collects only the minimum credentials
              required for access authentication (email and name). No government IDs, residential
              addresses, or personal telephone numbers are stored.
            </div>
          </div>

          {/* Logout Action */}
          <div className="pt-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                logout();
              }}
              className="w-full py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 font-semibold rounded-lg border border-rose-200 transition"
            >
              Sign Out of Account
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
