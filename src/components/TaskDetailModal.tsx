import React, { useState } from 'react';
import { Task, TaskUpdate } from '../types/index.ts';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { TASK_STATUS_CONFIG, TASK_PRIORITIES } from '../lib/philippinesRegions.ts';
import { formatPhilippineDate, formatPhilippineDateTime, getDueStatusLabel } from '../lib/dateUtils.ts';
import {
  X,
  Clock,
  MapPin,
  User,
  Calendar,
  AlertCircle,
  CheckCircle2,
  Send,
  RotateCcw,
  Check,
  FileText,
  ShieldAlert,
  ArrowRight,
  Edit3,
} from 'lucide-react';

interface TaskDetailModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEditTask?: (task: Task) => void;
  onOpenReopenTask?: (task: Task) => void;
}

export const TaskDetailModal: React.FC<TaskDetailModalProps> = ({
  task,
  isOpen,
  onClose,
  onOpenEditTask,
  onOpenReopenTask,
}) => {
  const { currentUser, isManager, isApproved } = useAuth();
  const { taskUpdates, updateTaskProgress, reviewTask } = useData();

  // Progress update form state for assigned member / manager
  const [progressNote, setProgressNote] = useState('');
  const [progressPercent, setProgressPercent] = useState<number>(task?.progress_percent || 0);
  const [submitForReview, setSubmitForReview] = useState(false);

  // Manager review feedback state
  const [managerFeedback, setManagerFeedback] = useState('');
  const [reviewAction, setReviewAction] = useState<'approve' | 'return' | null>(null);

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !task) return null;

  const updates: TaskUpdate[] = taskUpdates[task.id] || [];
  const statusCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.assigned;
  const dueInfo = getDueStatusLabel(task.due_date, task.status);
  const isAssignedToCurrent = currentUser?.id === task.assigned_to;
  const canUpdateProgress = (isAssignedToCurrent || isManager) && task.status !== 'completed';
  const canReview = isManager && task.status !== 'completed';

  // Handle member submitting progress update
  const handleProgressSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);
    setSuccessMessage(null);

    if (!progressNote.trim()) {
      setErrorMessage('Please describe what progress or action was taken on this task.');
      return;
    }

    setLoading(true);
    try {
      await updateTaskProgress(task.id, progressNote, progressPercent, submitForReview);
      setProgressNote('');
      setSubmitForReview(false);
      setSuccessMessage(
        submitForReview
          ? 'Task submitted for Manager Review successfully!'
          : 'Progress update logged successfully.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task progress.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Manager reviewing task (Approve or Return)
  const handleReviewSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!reviewAction) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (reviewAction === 'return' && !managerFeedback.trim()) {
      setErrorMessage('Please provide instructions on what needs revision or correction before returning.');
      return;
    }

    setLoading(true);
    try {
      await reviewTask(task.id, reviewAction, managerFeedback);
      setManagerFeedback('');
      setReviewAction(null);
      setSuccessMessage(
        reviewAction === 'approve'
          ? 'Task officially approved and marked Completed!'
          : 'Task returned to the assigned officer with revision notes.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit review.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between">
          <div className="space-y-1 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                {statusCfg.label}
              </span>
              <span className="text-xs bg-slate-800 text-slate-300 px-2 py-0.5 rounded border border-slate-700">
                {task.category}
              </span>
              {task.priority === 'urgent' && (
                <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-950 text-rose-300 border border-rose-800">
                  URGENT PRIORITY
                </span>
              )}
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {task.title}
            </h2>
          </div>
          <div className="flex items-center space-x-2">
            {isManager && isApproved && task.status !== 'completed' && onOpenEditTask && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditTask(task);
                }}
                className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                title="Edit task details, category, dates, or reassign designated personnel"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Task</span>
              </button>
            )}

            {isManager && isApproved && task.status === 'completed' && onOpenReopenTask && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenReopenTask(task);
                }}
                className="px-3 py-1.5 bg-amber-600 hover:bg-amber-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition shadow-xs cursor-pointer"
                title="Reopen completed task for further field actions"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Reopen Task</span>
              </button>
            )}

            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {/* Notifications */}
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-start space-x-2 text-xs">
              <CheckCircle2 className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Key Task Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center space-x-2 text-slate-700">
              <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Assigned Officer</span>
                <span className="font-medium text-slate-900">{task.assigned_user_name || 'Assigned Officer'}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Region / Facility Site</span>
                <span className="font-medium text-slate-900">{task.region}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Due Date (PHT)</span>
                <span className="font-medium text-slate-900 flex items-center space-x-1.5">
                  <span>{formatPhilippineDate(task.due_date)}</span>
                  {dueInfo.isOverdue && (
                    <span className="text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                      {dueInfo.label}
                    </span>
                  )}
                  {dueInfo.isToday && (
                    <span className="text-[10px] font-bold text-amber-700 bg-amber-100 px-1.5 py-0.2 rounded">
                      Due Today
                    </span>
                  )}
                </span>
              </div>
            </div>
          </div>

          {/* Instructions Box */}
          <div className="space-y-1.5">
            <div className="flex items-center space-x-1.5 text-xs font-semibold text-slate-700 uppercase tracking-wider">
              <FileText className="w-3.5 h-3.5 text-blue-700" />
              <span>Instructions & Compliance Requirements</span>
            </div>
            <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-sm whitespace-pre-wrap leading-relaxed shadow-xs">
              {task.instructions}
            </div>
          </div>

          {/* Remarks Box if exists */}
          {task.remarks && (
            <div className="p-3 bg-blue-50/70 border border-blue-200 rounded-lg text-xs text-blue-900">
              <span className="font-semibold block mb-0.5">Manager Notes:</span>
              <span>{task.remarks}</span>
            </div>
          )}

          {/* Progress Bar */}
          <div className="space-y-1">
            <div className="flex justify-between text-xs text-slate-600 font-medium">
              <span>Overall Completion Status</span>
              <span>{task.progress_percent || 0}%</span>
            </div>
            <div className="w-full bg-slate-200 rounded-full h-2.5 overflow-hidden">
              <div
                className={`h-2.5 rounded-full transition-all duration-300 ${
                  task.status === 'completed'
                    ? 'bg-emerald-600'
                    : (task.progress_percent || 0) >= 75
                    ? 'bg-blue-600'
                    : 'bg-amber-500'
                }`}
                style={{ width: `${Math.min(100, task.progress_percent || 0)}%` }}
              ></div>
            </div>
          </div>

          {/* Chronological Update History */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Activity & Update History ({updates.length})</span>
            </h3>

            {updates.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
                No progress updates submitted yet. The assigned personnel can post updates below.
              </p>
            ) : (
              <div className="space-y-3">
                {updates.map((upd) => (
                  <div
                    key={upd.id}
                    className={`p-3.5 rounded-lg border text-xs space-y-1.5 ${
                      upd.author_role === 'manager'
                        ? 'bg-indigo-50/60 border-indigo-200'
                        : upd.submitted_for_review
                        ? 'bg-amber-50/60 border-amber-200'
                        : 'bg-slate-50 border-slate-200'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900">
                          {upd.author_name || 'Security Personnel'}
                        </span>
                        <span className="text-[10px] text-slate-500 bg-white px-1.5 py-0.5 rounded border border-slate-200">
                          {upd.author_role === 'manager' ? 'Manager' : 'Supervisor / Officer'}
                        </span>
                        {upd.submitted_for_review && (
                          <span className="text-[10px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-300">
                            Submitted For Review
                          </span>
                        )}
                        {upd.status_change === 'returned' && (
                          <span className="text-[10px] bg-rose-100 text-rose-800 font-bold px-1.5 py-0.5 rounded border border-rose-300">
                            Returned for Revision
                          </span>
                        )}
                        {upd.status_change === 'completed' && (
                          <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded border border-emerald-300">
                            Approved & Completed
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatPhilippineDateTime(upd.created_at)}
                      </span>
                    </div>

                    <p className="text-slate-800 leading-relaxed whitespace-pre-wrap">
                      {upd.progress_note}
                    </p>

                    {upd.progress_percent !== undefined && (
                      <div className="text-[11px] text-slate-500 font-medium">
                        Progress recorded: <span className="text-slate-800 font-bold">{upd.progress_percent}%</span>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Action Area 1: Manager Review (Approve or Return) */}
          {canReview && (
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Manager Review & Disposition
                  </span>
                </div>
                {task.status === 'for_review' && (
                  <span className="text-[11px] bg-amber-500 text-slate-900 font-bold px-2 py-0.5 rounded">
                    Action Required
                  </span>
                )}
              </div>

              {!reviewAction ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setReviewAction('approve')}
                    className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>Approve & Mark Completed</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setReviewAction('return')}
                    className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Return for Revision</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleReviewSubmit} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {reviewAction === 'approve'
                        ? 'Approval Note / Commendation (Optional):'
                        : 'Revision Instructions for Officer (Required):'}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={
                        reviewAction === 'approve'
                          ? 'e.g., Verified perimeter report. Physical safeguards meet standard.'
                          : 'e.g., Please attach the missing vendor sign-in sheet for Bay 3...'
                      }
                      value={managerFeedback}
                      onChange={(e) => setManagerFeedback(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required={reviewAction === 'return'}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition ${
                        reviewAction === 'approve' ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {loading
                        ? 'Processing...'
                        : reviewAction === 'approve'
                        ? 'Confirm Approval'
                        : 'Confirm Return'}
                    </button>
                    <button
                      type="button"
                      onClick={() => setReviewAction(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Action Area 2: Add Progress Update (Personnel & Manager) */}
          {canUpdateProgress && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
              <h4 className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center space-x-1.5">
                <Send className="w-3.5 h-3.5 text-blue-600" />
                <span>Add Field Progress Update</span>
              </h4>

              <form onSubmit={handleProgressSubmit} className="space-y-3 text-xs">
                <div>
                  <label className="block font-medium text-slate-700 mb-1">
                    Progress Description / Findings <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={3}
                    placeholder="Describe specific actions taken, equipment inspected, personnel interviewed, or findings..."
                    value={progressNote}
                    onChange={(e) => setProgressNote(e.target.value)}
                    className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900 bg-white"
                    required
                  />
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 items-center">
                  <div>
                    <label className="block font-medium text-slate-700 mb-1">
                      Estimated Progress: <span className="font-bold text-blue-700">{progressPercent}%</span>
                    </label>
                    <input
                      type="range"
                      min={0}
                      max={100}
                      step={5}
                      value={progressPercent}
                      onChange={(e) => setProgressPercent(Number(e.target.value))}
                      className="w-full accent-blue-600 cursor-pointer"
                    />
                  </div>

                  <div className="flex items-center space-x-2 pt-3 sm:pt-0">
                    <input
                      type="checkbox"
                      id="submitReview"
                      checked={submitForReview}
                      onChange={(e) => {
                        setSubmitForReview(e.target.checked);
                        if (e.target.checked && progressPercent < 100) {
                          setProgressPercent(100);
                        }
                      }}
                      className="w-4 h-4 text-blue-600 rounded border-slate-300 focus:ring-blue-500"
                    />
                    <label htmlFor="submitReview" className="text-xs font-medium text-slate-800 cursor-pointer">
                      Mark as <span className="font-bold text-amber-800">Submit for Manager Review</span>
                    </label>
                  </div>
                </div>

                <div className="flex justify-end pt-1">
                  <button
                    type="submit"
                    disabled={loading}
                    className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50"
                  >
                    <Send className="w-3.5 h-3.5" />
                    <span>{loading ? 'Submitting...' : 'Post Progress Update'}</span>
                  </button>
                </div>
              </form>
            </div>
          )}

          {task.status === 'completed' && (
            <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-emerald-900 text-xs">
              <div className="flex items-center space-x-3">
                <CheckCircle2 className="w-5 h-5 text-emerald-600 flex-shrink-0" />
                <div>
                  <span className="font-bold block">Task Completed & Closed</span>
                  <span>
                    Officially verified and approved by Security Management on{' '}
                    {formatPhilippineDateTime(task.completed_at || task.updated_at)}.
                  </span>
                </div>
              </div>

              {isManager && isApproved && onOpenReopenTask && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenReopenTask(task);
                  }}
                  className="px-3 py-1.5 bg-amber-600 hover:bg-amber-700 text-white font-semibold rounded-lg flex items-center space-x-1.5 transition self-start sm:self-auto cursor-pointer"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Reopen Task</span>
                </button>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between">
          <div>
            {isManager && isApproved && task.status !== 'completed' && onOpenEditTask && (
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenEditTask(task);
                }}
                className="px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg flex items-center space-x-1.5 transition cursor-pointer"
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Edit Task & Reassign</span>
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-200 border border-slate-300 rounded-lg transition"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
