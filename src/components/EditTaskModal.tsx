import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Task, TaskCategory, TaskPriority } from '../types/index.ts';
import { PHILIPPINE_REGIONS, TASK_CATEGORIES, TASK_PRIORITIES } from '../lib/philippinesRegions.ts';
import {
  X,
  Edit3,
  UserCheck,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ShieldAlert,
  Info,
} from 'lucide-react';

interface EditTaskModalProps {
  task: Task | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditTaskModal: React.FC<EditTaskModalProps> = ({
  task,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { allProfiles, isManager, isApproved } = useAuth();
  const { editTask } = useData();

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Inspection');
  const [assignedTo, setAssignedTo] = useState('');
  const [region, setRegion] = useState<string>(PHILIPPINE_REGIONS[0]);
  const [dueDate, setDueDate] = useState<string>('');
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [remarks, setRemarks] = useState('');
  const [reassignmentReason, setReassignmentReason] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Populate form with task details whenever task changes or modal opens
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setInstructions(task.instructions);
      setCategory(task.category);
      setAssignedTo(task.assigned_to);
      setRegion(task.region || PHILIPPINE_REGIONS[0]);
      setDueDate(task.due_date);
      setPriority(task.priority);
      setRemarks(task.remarks || '');
      setReassignmentReason('');
      setErrorMessage(null);
    }
  }, [task, isOpen]);

  if (!isOpen || !task) return null;

  // Only approved and active personnel from Supabase
  const eligiblePersonnel = allProfiles.filter((p) => p.approved && p.active);

  const currentAssigneeProfile = allProfiles.find((p) => p.id === task.assigned_to);
  const selectedNewProfile = allProfiles.find((p) => p.id === assignedTo);
  const isPersonnelChanged = assignedTo !== task.assigned_to;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isManager || !isApproved) {
      setErrorMessage('Access Denied: Only approved Security Managers can edit or reassign tasks.');
      return;
    }
    if (!title.trim()) {
      setErrorMessage('Task Title is required.');
      return;
    }
    if (!instructions.trim()) {
      setErrorMessage('Instructions / Description are required.');
      return;
    }
    if (!assignedTo) {
      setErrorMessage('Please designate an authorized personnel.');
      return;
    }
    if (!dueDate) {
      setErrorMessage('Due Date is required.');
      return;
    }
    if (isPersonnelChanged && !reassignmentReason.trim()) {
      setErrorMessage('A reason for personnel reassignment is required (e.g., "Correction of incorrect personnel assignment").');
      return;
    }

    setLoading(true);
    try {
      await editTask(task.id, {
        title: title.trim(),
        instructions: instructions.trim(),
        category,
        assigned_to: assignedTo,
        region,
        due_date: dueDate,
        priority,
        remarks: remarks.trim() || undefined,
        reassignment_reason: isPersonnelChanged ? reassignmentReason.trim() : undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update task.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">Edit Task & Reassign Personnel</h2>
              <p className="text-xs text-slate-400">
                Task ID: <span className="font-mono text-slate-200">{task.id}</span> • Status:{' '}
                <span className="capitalize font-medium text-blue-300">{task.status.replace('_', ' ')}</span>
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
        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Returned Task Context Banner */}
          {task.status === 'returned' && (
            <div className="p-3 bg-amber-50 border border-amber-200 text-amber-900 rounded-lg text-xs space-y-1">
              <div className="font-bold flex items-center space-x-1.5">
                <ShieldAlert className="w-4 h-4 text-amber-700" />
                <span>Editing Returned Task</span>
              </div>
              <p className="text-amber-800 leading-relaxed">
                This task was previously returned for revision. You can correct the instructions, adjust deadlines, or reassign designated personnel. All previous accomplishment notes and manager feedback are strictly preserved.
              </p>
            </div>
          )}

          {/* Task Title */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Task Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Designated Personnel / Assignee Dropdown */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-3">
            <div>
              <label className="block font-semibold text-slate-800 mb-1 flex items-center justify-between">
                <span>Designated Personnel (Assigned To) <span className="text-rose-600">*</span></span>
                <span className="text-xs text-slate-500 font-normal">
                  Identified by Unique Supabase UUID
                </span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white font-medium text-xs sm:text-sm"
                required
              >
                {eligiblePersonnel.map((person) => {
                  const isCurrent = person.id === task.assigned_to;
                  const roleLabel = person.role === 'manager' ? 'Manager Account' : 'Team Member Account';

                  return (
                    <option key={person.id} value={person.id}>
                      {person.display_name} — {roleLabel} ({person.email}) {isCurrent ? '• [CURRENT ASSIGNEE]' : ''}
                    </option>
                  );
                })}
              </select>
            </div>

            {/* Personnel Reassignment Box */}
            {isPersonnelChanged && selectedNewProfile && (
              <div className="p-3.5 bg-blue-50/80 border border-blue-200 rounded-lg space-y-2.5 text-xs text-blue-950">
                <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                  <UserCheck className="w-4 h-4 text-blue-700" />
                  <span>Personnel Reassignment Confirmation</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[11px] bg-white p-2.5 rounded border border-blue-100">
                  <div>
                    <span className="text-slate-400 block uppercase font-bold text-[9px]">Current Assignee</span>
                    <span className="font-semibold text-slate-800">
                      {task.assigned_user_name || currentAssigneeProfile?.display_name || 'Previous Personnel'}
                    </span>
                    <span className="block text-slate-500 font-mono text-[10px]">
                      {task.assigned_user_email || currentAssigneeProfile?.email}
                    </span>
                  </div>

                  <div className="border-t sm:border-t-0 sm:border-l border-slate-200 pt-2 sm:pt-0 sm:pl-2">
                    <span className="text-blue-500 block uppercase font-bold text-[9px]">New Assignee</span>
                    <span className="font-semibold text-blue-900">
                      {selectedNewProfile.display_name}
                    </span>
                    <span className="block text-blue-700 font-mono text-[10px]">
                      {selectedNewProfile.email}
                    </span>
                  </div>
                </div>

                <div>
                  <label className="block font-medium text-blue-900 mb-1">
                    Mandatory Reason for Reassignment <span className="text-rose-600">*</span>
                  </label>
                  <textarea
                    rows={2}
                    placeholder="e.g., Correction of incorrect personnel assignment, or reallocated due to operational rotation."
                    value={reassignmentReason}
                    onChange={(e) => setReassignmentReason(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-blue-300 rounded-lg focus:ring-2 focus:ring-blue-600 text-slate-900 text-xs"
                    required
                  />
                  <p className="text-[10px] text-blue-800 mt-1">
                    This reason will be recorded in the task history and audit trail. The task will be transferred to the new personnel's dashboard immediately upon saving.
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Priority</label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Region / Site & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Region / Facility Site</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                {PHILIPPINE_REGIONS.map((reg) => (
                  <option key={reg} value={reg}>
                    {reg}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Due Date (PHT) <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                required
              />
            </div>
          </div>

          {/* Instructions / Scope */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Instructions & Scope of Work <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Remarks */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Manager Remarks (Optional)
            </label>
            <input
              type="text"
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              placeholder="e.g., Priority inspection for Q4 compliance."
            />
          </div>

          {/* Action Buttons */}
          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg shadow-xs transition flex items-center space-x-2 disabled:opacity-50 cursor-pointer"
            >
              {loading ? (
                <span>Saving Changes...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Changes</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
