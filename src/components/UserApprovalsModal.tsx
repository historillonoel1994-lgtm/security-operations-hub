import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { formatPhilippineDateTime } from '../lib/dateUtils.ts';
import {
  X,
  Users,
  ShieldCheck,
  UserCheck,
  UserX,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';

interface UserApprovalsModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const UserApprovalsModal: React.FC<UserApprovalsModalProps> = ({
  isOpen,
  onClose,
}) => {
  const { allProfiles, updateUserApproval, updateUserActive, currentUser } = useAuth();
  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleToggleApproval = async (userId: string, targetApproved: boolean) => {
    setLoadingId(userId);
    setMessage(null);
    try {
      await updateUserApproval(userId, targetApproved);
      setMessage(
        targetApproved
          ? 'User account successfully approved! They can now access assigned tasks.'
          : 'User approval revoked.'
      );
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert('Error updating approval: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const handleToggleActive = async (userId: string, targetActive: boolean) => {
    setLoadingId(userId);
    setMessage(null);
    try {
      await updateUserActive(userId, targetActive);
      setMessage(
        targetActive
          ? 'User account activated.'
          : 'User account deactivated (access blocked).'
      );
      setTimeout(() => setMessage(null), 3000);
    } catch (err: any) {
      alert('Error updating active state: ' + err.message);
    } finally {
      setLoadingId(null);
    }
  };

  const pendingUsers = allProfiles.filter((p) => !p.approved);
  const approvedUsers = allProfiles.filter((p) => p.approved);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Users className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">User Access & Account Approvals</h2>
              <p className="text-xs text-slate-400">
                Security Manager administration of personnel authorization
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
          {message && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center space-x-2">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
              <span>{message}</span>
            </div>
          )}

          {/* Policy Notice */}
          <div className="p-3 bg-blue-50 border border-blue-200 text-blue-900 rounded-lg flex items-start space-x-2.5">
            <Lock className="w-4 h-4 text-blue-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold block">Zero-Trust Account Policy</span>
              <p className="text-[11px] text-blue-800 mt-0.5 leading-relaxed">
                First-time Google/Gmail logins are created in a <span className="font-semibold">PENDING</span> status.
                New accounts cannot view any private department tasks or submit logs until an authorized Security
                Manager explicitly activates their profile.
              </p>
            </div>
          </div>

          {/* Section 1: Pending Registrations */}
          <div className="space-y-3">
            <div className="flex items-center justify-between border-b border-slate-200 pb-2">
              <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs flex items-center space-x-1.5">
                <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                <span>Pending Approvals ({pendingUsers.length})</span>
              </h3>
            </div>

            {pendingUsers.length === 0 ? (
              <p className="text-slate-400 italic py-2">
                No pending registration requests at this time. All team members are processed.
              </p>
            ) : (
              <div className="space-y-2">
                {pendingUsers.map((user) => (
                  <div
                    key={user.id}
                    className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-bold text-slate-900">{user.display_name}</div>
                      <div className="text-slate-600 font-mono text-[11px]">{user.email}</div>
                      <div className="text-[10px] text-slate-500 mt-0.5">
                        Registered: {formatPhilippineDateTime(user.created_at)}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        type="button"
                        disabled={loadingId === user.id}
                        onClick={() => handleToggleApproval(user.id, true)}
                        className="px-3 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white font-semibold rounded-md text-xs shadow-xs transition flex items-center space-x-1"
                      >
                        <UserCheck className="w-3.5 h-3.5" />
                        <span>Approve Access</span>
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Section 2: Approved Personnel Roster */}
          <div className="space-y-3 pt-3">
            <h3 className="font-bold text-slate-900 uppercase tracking-wider text-xs border-b border-slate-200 pb-2">
              Authorized Personnel Roster ({approvedUsers.length})
            </h3>

            <div className="space-y-2">
              {approvedUsers.map((user) => {
                const isSelf = user.id === currentUser?.id;

                return (
                  <div
                    key={user.id}
                    className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between"
                  >
                    <div>
                      <div className="font-semibold text-slate-900 flex items-center space-x-2">
                        <span>{user.display_name}</span>
                        {user.role === 'manager' && (
                          <span className="text-[10px] bg-blue-100 text-blue-800 font-bold px-1.5 py-0.2 rounded border border-blue-200">
                            Manager
                          </span>
                        )}
                        {!user.active && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.2 rounded border border-rose-200">
                            Deactivated
                          </span>
                        )}
                      </div>
                      <div className="text-slate-500 text-[11px] font-mono">{user.email}</div>
                      {user.regional_assignment && (
                        <div className="text-[10px] text-slate-400 mt-0.5">
                          Assignment: {user.regional_assignment}
                        </div>
                      )}
                    </div>

                    {!isSelf && (
                      <div className="flex items-center space-x-2">
                        {user.active ? (
                          <button
                            type="button"
                            disabled={loadingId === user.id}
                            onClick={() => handleToggleActive(user.id, false)}
                            className="px-2.5 py-1 text-slate-600 hover:text-rose-700 hover:bg-rose-50 border border-slate-300 rounded text-[11px] font-medium transition"
                            title="Deactivate account (blocks sign-in)"
                          >
                            Deactivate
                          </button>
                        ) : (
                          <button
                            type="button"
                            disabled={loadingId === user.id}
                            onClick={() => handleToggleActive(user.id, true)}
                            className="px-2.5 py-1 text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200 rounded text-[11px] font-medium transition"
                          >
                            Reactivate
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
