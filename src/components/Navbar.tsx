import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Shield,
  Users,
  LogOut,
  ExternalLink,
} from 'lucide-react';
import { isEmbeddedInIframe, getStandaloneAppUrl } from '../lib/windowUtils.ts';

interface NavbarProps {
  onOpenApprovals: () => void;
  onOpenProfile: () => void;
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenApprovals, onOpenProfile }) => {
  const {
    currentUser,
    isManager,
    isApproved,
    allProfiles,
    logout,
  } = useAuth();

  const pendingCount = allProfiles.filter((p) => !p.approved).length;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo & Corporate Title */}
          <div className="flex items-center space-x-3">
            <div className="bg-blue-600 p-2 rounded-lg text-white shadow-inner flex items-center justify-center">
              <Shield className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <span className="font-bold text-lg tracking-tight text-white">
                  Security Operations Hub
                </span>
                <span className="text-xs bg-slate-800 text-blue-400 font-medium px-2 py-0.5 rounded border border-blue-900/60">
                  SOH
                </span>
              </div>
              <p className="text-xs text-slate-400 hidden sm:block">
                Security Department Command & Field Task Management System
              </p>
            </div>
          </div>

          {/* Right Controls: Connection Status, New Tab, Approvals, Profile, Logout */}
          <div className="flex items-center space-x-3">
            {/* Separate Tab Link if inside embedded preview */}
            {isEmbeddedInIframe() && (
              <a
                href={getStandaloneAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
                title="Open in separate browser window"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                <span>New Tab</span>
              </a>
            )}

            {/* Supabase Cloud Connection Status */}
            <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
              Supabase Connected
            </span>

            {/* Manager: User Approvals Button */}
            {isManager && isApproved && (
              <button
                type="button"
                onClick={onOpenApprovals}
                className="relative inline-flex items-center px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 text-slate-200 hover:bg-slate-700 border border-slate-700 transition"
                title="Manage team members and pending registrations"
              >
                <Users className="w-3.5 h-3.5 mr-1.5 text-blue-400" />
                <span className="hidden md:inline">Approvals</span>
                {pendingCount > 0 && (
                  <span className="ml-1.5 px-1.5 py-0.2 bg-amber-500 text-slate-900 rounded-full font-bold text-[10px]">
                    {pendingCount}
                  </span>
                )}
              </button>
            )}

            {/* Current User Role Pill */}
            {currentUser && (
              <button
                type="button"
                onClick={onOpenProfile}
                className="flex items-center space-x-2 px-2.5 py-1.5 rounded-lg bg-slate-800/80 hover:bg-slate-700 border border-slate-700 text-left transition"
              >
                <div className="w-7 h-7 rounded-full bg-blue-700 flex items-center justify-center font-bold text-xs text-white">
                  {currentUser.display_name.charAt(0).toUpperCase()}
                </div>
                <div className="hidden lg:block text-left">
                  <div className="text-xs font-medium text-white truncate max-w-[130px]">
                    {currentUser.display_name.replace(/\s*\(.*?\)\s*/g, '')}
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {isManager ? 'Security Manager' : 'Team Member'}
                  </div>
                </div>
              </button>
            )}

            {/* Logout Button */}
            <button
              type="button"
              onClick={logout}
              className="p-1.5 rounded-lg text-slate-400 hover:text-rose-400 hover:bg-slate-800 transition"
              title="Sign Out (Wipes active session and unloads private records)"
            >
              <LogOut className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};
