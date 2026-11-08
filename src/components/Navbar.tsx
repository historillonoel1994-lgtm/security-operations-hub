import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import {
  Shield,
  ShieldCheck,
  UserCheck,
  LogOut,
  User,
  Users,
  AlertTriangle,
  ChevronDown,
  RefreshCw,
  Lock,
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
    isLiveSupabase,
    loginAsDemoUser,
    logout,
  } = useAuth();

  const [showDemoDropdown, setShowDemoDropdown] = useState(false);

  const pendingCount = allProfiles.filter((p) => !p.approved).length;

  return (
    <header className="bg-slate-900 border-b border-slate-800 text-white sticky top-0 z-40 shadow-sm">
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
                Corporate Security Command & Field Task Management
              </p>
            </div>
          </div>

          {/* Right Controls: Mode, Demo Switcher, Approvals, Profile, Logout */}
          <div className="flex items-center space-x-3">
            {/* Separate Tab Link if inside embedded preview */}
            {isEmbeddedInIframe() && (
              <a
                href={getStandaloneAppUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="hidden sm:inline-flex items-center px-2 py-1 rounded-lg text-xs font-medium bg-slate-800 text-slate-300 hover:text-white hover:bg-slate-700 border border-slate-700 transition"
                title="Open in separate browser window"
              >
                <ExternalLink className="w-3.5 h-3.5 mr-1 text-blue-400" />
                <span>New Tab</span>
              </a>
            )}

            {/* Supabase vs Demo Mode Indicator */}
            {isLiveSupabase ? (
              <span className="hidden md:inline-flex items-center px-2.5 py-1 rounded-full text-xs font-medium bg-emerald-950 text-emerald-300 border border-emerald-800">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 mr-1.5 animate-pulse"></span>
                Live Supabase Connected
              </span>
            ) : (
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setShowDemoDropdown(!showDemoDropdown)}
                  className="flex items-center space-x-1.5 px-2.5 py-1 rounded-lg text-xs font-medium bg-amber-950/80 text-amber-200 border border-amber-800 hover:bg-amber-900/70 transition"
                  title="Switch between sample user roles for testing"
                >
                  <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                  <span className="hidden sm:inline">Demo Sandbox Mode</span>
                  <span className="sm:hidden">Demo</span>
                  <ChevronDown className="w-3 h-3 text-amber-400" />
                </button>

                {showDemoDropdown && (
                  <div
                    className="absolute right-0 mt-2 w-72 bg-slate-800 border border-slate-700 rounded-lg shadow-xl py-2 z-50 text-xs"
                    onMouseLeave={() => setShowDemoDropdown(false)}
                  >
                    <div className="px-3 py-1.5 border-b border-slate-700 text-slate-400 font-medium">
                      Switch Demo Persona (Testing)
                    </div>
                    {allProfiles.map((profile) => (
                      <button
                        key={profile.id}
                        onClick={() => {
                          loginAsDemoUser(profile.id);
                          setShowDemoDropdown(false);
                        }}
                        className={`w-full text-left px-3 py-2 flex items-center justify-between hover:bg-slate-700/80 transition ${
                          currentUser?.id === profile.id ? 'bg-slate-700/60 font-semibold text-blue-400' : 'text-slate-200'
                        }`}
                      >
                        <div className="truncate pr-2">
                          <div className="truncate">{profile.display_name}</div>
                          <div className="text-[10px] text-slate-400">
                            {profile.role === 'manager' ? 'Security Manager' : 'Team Member'} •{' '}
                            {profile.approved ? 'Approved' : 'Pending Approval'}
                          </div>
                        </div>
                        {currentUser?.id === profile.id && (
                          <span className="w-2 h-2 rounded-full bg-blue-400 flex-shrink-0"></span>
                        )}
                      </button>
                    ))}
                    <div className="px-3 pt-2 pb-1 text-[10px] text-amber-300/80 border-t border-slate-700">
                      Fictional accounts for student testing & demonstration.
                    </div>
                  </div>
                )}
              </div>
            )}

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
                    {isManager ? 'Manager' : 'Team Member'}
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
