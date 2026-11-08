import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { getPhilippineToday } from '../lib/dateUtils.ts';
import { X, CalendarCheck, AlertCircle, CheckCircle } from 'lucide-react';

interface CreateActivityModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateActivityModal: React.FC<CreateActivityModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser } = useAuth();
  const { tasks, createActivity } = useData();

  const [activityDate, setActivityDate] = useState<string>(getPhilippineToday());
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [region, setRegion] = useState<string>(currentUser?.regional_assignment || PHILIPPINE_REGIONS[0]);
  const [taskId, setTaskId] = useState<string>('');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!title.trim()) {
      setErrorMessage('Please provide a short title for your activity.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Please describe the accomplishment or security activity conducted.');
      return;
    }

    setLoading(true);
    try {
      await createActivity({
        activity_date: activityDate,
        title,
        description,
        region,
        task_id: taskId || null,
        remarks,
      });

      // Reset form
      setTitle('');
      setDescription('');
      setRemarks('');
      setTaskId('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to log daily activity.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <CalendarCheck className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-semibold">Log Daily Security Activity</h2>
              <p className="text-xs text-slate-400">
                Record patrols, escorts, inspections, or guard briefings
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

          {/* Activity Date & Region */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Activity Date (PHT) <span className="text-rose-600">*</span>
              </label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Region / Facility Site
              </label>
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
          </div>

          {/* Short Title */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Activity Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              placeholder="e.g., Morning Shift Guard Inspection & Perimeter Walk"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Description / Accomplishment */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Accomplishment / Work Description <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Describe actions performed, personnel present, equipment status, or any observations during the shift..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Linked Task (Optional) */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Linked Task (Optional)
            </label>
            <select
              value={taskId}
              onChange={(e) => setTaskId(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="">-- No specific linked task --</option>
              {tasks.map((task) => (
                <option key={task.id} value={task.id}>
                  {task.title}
                </option>
              ))}
            </select>
            <span className="text-[11px] text-slate-500">
              Link this daily log to an active security task if applicable.
            </span>
          </div>

          {/* Remarks (Optional) */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Remarks / Follow-up Notes (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Will coordinate next shift with relief supervisor."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
            />
          </div>

          {/* Buttons */}
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
              className="px-5 py-2 bg-emerald-700 hover:bg-emerald-800 text-white font-medium rounded-lg shadow-xs transition flex items-center space-x-2 disabled:opacity-50"
            >
              {loading ? (
                <span>Saving Activity...</span>
              ) : (
                <>
                  <CheckCircle className="w-4 h-4" />
                  <span>Save Activity Log</span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
