import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { PHILIPPINE_REGIONS, TASK_CATEGORIES, TASK_PRIORITIES } from '../lib/philippinesRegions.ts';
import { getPhilippineToday } from '../lib/dateUtils.ts';
import { TaskCategory, TaskPriority } from '../types/index.ts';
import { X, PlusCircle, AlertCircle, CheckCircle } from 'lucide-react';

interface CreateTaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateTaskModal: React.FC<CreateTaskModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { allProfiles } = useAuth();
  const { createTask } = useData();

  const [title, setTitle] = useState('');
  const [instructions, setInstructions] = useState('');
  const [category, setCategory] = useState<TaskCategory>('Inspection');
  const [assignedTo, setAssignedTo] = useState('');
  const [region, setRegion] = useState<string>(PHILIPPINE_REGIONS[0]);
  const [dueDate, setDueDate] = useState<string>(getPhilippineToday());
  const [priority, setPriority] = useState<TaskPriority>('normal');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  // Filter approved users for assignment
  const assignableUsers = allProfiles.filter((p) => p.approved && p.active);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    // Plain-language field validation
    if (!title.trim()) {
      setErrorMessage('Task Title is required. Please specify what needs to be done.');
      return;
    }
    if (!instructions.trim()) {
      setErrorMessage('Instructions are required. Please describe the field inspection or investigation steps.');
      return;
    }
    if (!assignedTo) {
      setErrorMessage('Please choose an authorized security officer or regional supervisor to assign this task to.');
      return;
    }
    if (!dueDate) {
      setErrorMessage('Due Date is required. When must this task be completed or submitted?');
      return;
    }

    setLoading(true);
    try {
      await createTask({
        title,
        instructions,
        category,
        assigned_to: assignedTo,
        region,
        due_date: dueDate,
        priority,
        remarks,
      });

      // Reset form
      setTitle('');
      setInstructions('');
      setRemarks('');
      setAssignedTo('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to create task. Please check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Modal Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <PlusCircle className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">Create New Security Task</h2>
              <p className="text-xs text-slate-400">
                Assign inspections, investigations, or access reviews to field personnel
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

          {/* Title */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Task Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Q4 Fire Exit & Keycard Audit - Taguig Data Center"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Category & Priority */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as TaskCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                {TASK_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Priority
              </label>
              <select
                value={priority}
                onChange={(e) => setPriority(e.target.value as TaskPriority)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              >
                {TASK_PRIORITIES.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Assigned User & Due Date */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Assign To <span className="text-rose-600">*</span>
              </label>
              <select
                value={assignedTo}
                onChange={(e) => setAssignedTo(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                required
              >
                <option value="">-- Choose Assigned Officer --</option>
                {assignableUsers.map((user) => (
                  <option key={user.id} value={user.id}>
                    {user.display_name} ({user.regional_assignment || user.email})
                  </option>
                ))}
              </select>
              {assignableUsers.length === 0 && (
                <p className="text-[11px] text-amber-700 mt-1">
                  No approved team members found. Go to Approvals to activate members.
                </p>
              )}
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Due Date (PHT) <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                required
              />
            </div>
          </div>

          {/* Region / Site */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Region / Facility Site
            </label>
            <select
              value={region}
              onChange={(e) => setRegion(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              {PHILIPPINE_REGIONS.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Instructions */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Instructions & Scope of Work <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Detail the specific security checkpoint, cameras to check, interview requirements, or logbook parameters..."
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Optional Remarks */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Manager Remarks / Compliance Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Coordinate with Facility Engineering Manager prior to testing alarms."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-hidden focus:ring-2 focus:ring-blue-500 text-slate-900"
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
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-medium rounded-lg shadow-xs transition flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Saving Task...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Assign Task</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
