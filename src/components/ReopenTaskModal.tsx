import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Task } from '../types/index.ts';
import { X, RotateCcw, AlertCircle, CheckCircle, ShieldAlert } from 'lucide-react';

interface ReopenTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const ReopenTaskModal: React.FC<ReopenTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { isManager, isApproved } = useAuth();
  const { reopenTask } = useData();

  const [reason, setReason] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isManager || !isApproved) {
      setErrorMessage('Access Denied: Only approved Security Managers can reopen completed tasks.');
      return;
    }

    if (!reason.trim()) {
      setErrorMessage('Please provide a mandatory operational reason for reopening this task.');
      return;
    }

    setLoading(true);
    try {
      await reopenTask(task.id, reason.trim());
      setReason('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to reopen task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <RotateCcw className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold">Reopen Completed Task</h2>
              <p className="text-xs text-slate-400">
                Task ID: <span className="font-mono text-slate-200">{task.id}</span>
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

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-900 space-y-1">
            <div className="font-bold flex items-center space-x-1.5">
              <ShieldAlert className="w-4 h-4 text-amber-700" />
              <span>Manager Audit Notification</span>
            </div>
            <p className="leading-relaxed text-amber-800">
              Reopening this task will return its status from <strong className="text-emerald-800">Completed</strong> to{' '}
              <strong className="text-blue-800">In Progress</strong>. The assigned personnel (
              <strong>{task.assigned_user_name || 'Assigned Officer'}</strong>) will be notified on their dashboard to
              resume action.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Task Title
            </label>
            <div className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-xs font-medium text-slate-800">
              {task.title}
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Operational Reason for Reopening <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={3}
              placeholder="e.g., Follow-up inspection required due to recurring CCTV blind spot issue; or additional documentation needed from contractor."
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              required
            />
            <p className="text-[11px] text-slate-400 mt-1">
              This reason will be logged in the permanent audit trail and timeline.
            </p>
          </div>

          {/* Action Buttons */}
          <div className="pt-3 border-t border-slate-200 flex items-center justify-end space-x-2">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-medium transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Reopening Task...</span>
              ) : (
                <>
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Confirm & Reopen Task</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
