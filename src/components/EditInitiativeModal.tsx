import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { MemberInitiative, InitiativeCategory, InitiativeType } from '../types/index.ts';
import { PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { INITIATIVE_CATEGORIES, INITIATIVE_TYPES } from '../lib/initiativeConstants.ts';
import {
  X,
  Edit3,
  AlertCircle,
  RotateCcw,
  CheckCircle,
  ShieldAlert,
  Send,
  Save,
} from 'lucide-react';

interface EditInitiativeModalProps {
  initiative: MemberInitiative | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditInitiativeModal: React.FC<EditInitiativeModalProps> = ({
  initiative,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, isManager, isApproved } = useAuth();
  const { editInitiative, tasks } = useData();

  const [title, setTitle] = useState('');
  const [initiativeType, setInitiativeType] = useState<InitiativeType>('proposed');
  const [category, setCategory] = useState<InitiativeCategory>('Security Inspection');
  const [region, setRegion] = useState<string>(PHILIPPINE_REGIONS[0]);
  const [location, setLocation] = useState('');
  const [activityDate, setActivityDate] = useState('');
  const [description, setDescription] = useState('');
  const [actionDetails, setActionDetails] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [justification, setJustification] = useState('');
  const [supportingDocument, setSupportingDocument] = useState('');
  const [remarks, setRemarks] = useState('');
  const [relatedTaskId, setRelatedTaskId] = useState('');
  const [resubmitNote, setResubmitNote] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (initiative) {
      setTitle(initiative.title);
      setInitiativeType(initiative.initiative_type);
      setCategory(initiative.category);
      setRegion(initiative.region);
      setLocation(initiative.location || '');
      setActivityDate(initiative.activity_date);
      setDescription(initiative.description);
      setActionDetails(initiative.action_details);
      setExpectedOutcome(initiative.expected_outcome);
      setJustification(initiative.justification);
      setSupportingDocument(initiative.supporting_document || '');
      setRemarks(initiative.remarks || '');
      setRelatedTaskId(initiative.related_task_id || '');
      setResubmitNote('');
      setErrorMessage(null);
    }
  }, [initiative, isOpen]);

  if (!isOpen || !initiative) return null;

  const isAuthor = initiative.submitted_by === currentUser?.id;
  const canEdit = isManager || (isAuthor && (initiative.status === 'draft' || initiative.status === 'returned'));

  const handleSubmit = async (keepDraft: boolean) => {
    setErrorMessage(null);

    if (!canEdit) {
      setErrorMessage('Access Denied: You cannot modify this initiative in its current status.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Title is required.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Description of concern is required.');
      return;
    }
    if (!actionDetails.trim()) {
      setErrorMessage('Action details are required.');
      return;
    }
    if (!expectedOutcome.trim()) {
      setErrorMessage('Expected outcome or actual accomplishment is required.');
      return;
    }
    if (!justification.trim()) {
      setErrorMessage('Justification is required.');
      return;
    }
    if (!activityDate) {
      setErrorMessage('Activity Date is required.');
      return;
    }

    if (initiative.status === 'returned' && !keepDraft && !resubmitNote.trim()) {
      setErrorMessage('Please include a brief note explaining the revisions you made per Manager feedback.');
      return;
    }

    setLoading(true);
    try {
      await editInitiative(initiative.id, {
        title: title.trim(),
        initiative_type: initiativeType,
        category,
        region,
        location: location.trim() || undefined,
        description: description.trim(),
        action_details: actionDetails.trim(),
        expected_outcome: expectedOutcome.trim(),
        activity_date: activityDate,
        justification: justification.trim(),
        supporting_document: supportingDocument.trim() || undefined,
        remarks: remarks.trim() || undefined,
        related_task_id: relatedTaskId || null,
        is_draft: keepDraft,
        resubmit_note: resubmitNote.trim() || undefined,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to update initiative.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Edit3 className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">
                {initiative.status === 'returned' ? 'Revise & Resubmit Initiative' : 'Edit Initiative'}
              </h2>
              <p className="text-xs text-slate-400">
                Initiative ID: <span className="font-mono text-slate-200">{initiative.id}</span> • Status:{' '}
                <span className="capitalize font-medium text-amber-300">
                  {initiative.status.replace(/_/g, ' ')}
                </span>
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
        <div className="p-6 overflow-y-auto space-y-4 text-sm flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Returned for Revision Banner */}
          {initiative.status === 'returned' && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-2 text-xs text-rose-950">
              <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                <RotateCcw className="w-4 h-4 text-rose-700" />
                <span>Returned for Revision by Manager</span>
              </div>
              <p className="font-medium text-slate-800 bg-white p-3 rounded-lg border border-rose-200 leading-relaxed">
                "{initiative.manager_remarks || 'Please clarify specific scope and findings.'}"
              </p>
              <p className="text-[11px] text-rose-800">
                Update the necessary details below and describe your corrections in the Resubmission Note.
              </p>
            </div>
          )}

          {/* Initiative Title */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Initiative Title <span className="text-rose-600">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Type & Category */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Initiative Type</label>
              <select
                value={initiativeType}
                onChange={(e) => setInitiativeType(e.target.value as InitiativeType)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs sm:text-sm"
              >
                {INITIATIVE_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>
                    {t.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Category</label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value as InitiativeCategory)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs sm:text-sm"
              >
                {INITIATIVE_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Region, Facility, Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Region</label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs"
              >
                {PHILIPPINE_REGIONS.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Facility / Location</label>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Activity Date</label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs"
                required
              />
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Description / Identified Concern <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={2}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Action Details */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Proposed Action / Action Taken <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={2}
              value={actionDetails}
              onChange={(e) => setActionDetails(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Expected Outcome */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Expected Outcome / Actual Accomplishment <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={2}
              value={expectedOutcome}
              onChange={(e) => setExpectedOutcome(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Justification */}
          <div>
            <label className="block font-medium text-slate-700 mb-1">
              Justification / Operational Value <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={2}
              value={justification}
              onChange={(e) => setJustification(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
              required
            />
          </div>

          {/* Supporting Doc & Related Task */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">Supporting Reference</label>
              <input
                type="text"
                value={supportingDocument}
                onChange={(e) => setSupportingDocument(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">Related Manager Task</label>
              <select
                value={relatedTaskId}
                onChange={(e) => setRelatedTaskId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs sm:text-sm"
              >
                <option value="">None (Independent Initiative)</option>
                {tasks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.id}: {t.title.slice(0, 36)}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Resubmission Note (if returned) */}
          {initiative.status === 'returned' && (
            <div className="p-3.5 bg-amber-50 border border-amber-300 rounded-lg space-y-1">
              <label className="block text-xs font-semibold text-amber-900">
                Resubmission Note for Manager <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Detail what you corrected or added in response to the manager's revision instructions..."
                value={resubmitNote}
                onChange={(e) => setResubmitNote(e.target.value)}
                className="w-full px-3 py-2 border border-amber-300 bg-white rounded-lg text-xs text-slate-900 focus:ring-2 focus:ring-blue-500"
                required
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <button
            type="button"
            onClick={onClose}
            disabled={loading}
            className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-100 text-xs font-medium transition"
          >
            Cancel
          </button>

          <div className="flex items-center space-x-2">
            {initiative.status === 'draft' && (
              <button
                type="button"
                disabled={loading}
                onClick={() => handleSubmit(true)}
                className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
              >
                <Save className="w-3.5 h-3.5 text-slate-500" />
                <span>Save Draft</span>
              </button>
            )}

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {loading
                  ? 'Saving...'
                  : initiative.status === 'returned'
                  ? 'Resubmit for Review'
                  : 'Submit for Review'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
