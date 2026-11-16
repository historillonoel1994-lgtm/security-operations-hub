import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { InitiativeCategory, InitiativeType } from '../types/index.ts';
import { PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { INITIATIVE_CATEGORIES, INITIATIVE_TYPES } from '../lib/initiativeConstants.ts';
import { getPhilippineToday } from '../lib/dateUtils.ts';
import {
  X,
  Lightbulb,
  AlertCircle,
  CheckCircle,
  ShieldAlert,
  Save,
  Send,
  Info,
} from 'lucide-react';

interface CreateInitiativeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const CreateInitiativeModal: React.FC<CreateInitiativeModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, isApproved } = useAuth();
  const { createInitiative, tasks } = useData();

  const [title, setTitle] = useState('');
  const [initiativeType, setInitiativeType] = useState<InitiativeType>('proposed');
  const [category, setCategory] = useState<InitiativeCategory>('Security Inspection');
  const [region, setRegion] = useState(currentUser?.regional_assignment || PHILIPPINE_REGIONS[0]);
  const [location, setLocation] = useState('');
  const [activityDate, setActivityDate] = useState(getPhilippineToday());
  const [description, setDescription] = useState('');
  const [actionDetails, setActionDetails] = useState('');
  const [expectedOutcome, setExpectedOutcome] = useState('');
  const [justification, setJustification] = useState('');
  const [supportingDocument, setSupportingDocument] = useState('');
  const [remarks, setRemarks] = useState('');
  const [relatedTaskId, setRelatedTaskId] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleSubmit = async (isDraft: boolean) => {
    setErrorMessage(null);

    if (!isApproved) {
      setErrorMessage('Access Denied: Only approved personnel can submit initiatives.');
      return;
    }

    if (!title.trim()) {
      setErrorMessage('Initiative Title is required.');
      return;
    }
    if (!description.trim()) {
      setErrorMessage('Identified Concern / Opportunity description is required.');
      return;
    }
    if (!actionDetails.trim()) {
      setErrorMessage('Proposed Action or Action Taken is required.');
      return;
    }
    if (!expectedOutcome.trim()) {
      setErrorMessage(
        initiativeType === 'self_initiated'
          ? 'Actual Accomplishment / Result is required.'
          : 'Expected Result / Deliverable is required.'
      );
      return;
    }
    if (!justification.trim()) {
      setErrorMessage('Justification / Reason for Initiative is required.');
      return;
    }
    if (!activityDate) {
      setErrorMessage('Activity Date is required.');
      return;
    }

    setLoading(true);
    try {
      await createInitiative({
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
        is_draft: isDraft,
      });

      // Reset fields
      setTitle('');
      setDescription('');
      setActionDetails('');
      setExpectedOutcome('');
      setJustification('');
      setSupportingDocument('');
      setRemarks('');
      setRelatedTaskId('');
      setLocation('');

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit initiative.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <Lightbulb className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <h2 className="text-base font-semibold">New Security Initiative</h2>
              <p className="text-xs text-slate-400">
                Propose an activity or submit a self-initiated routine accomplishment for Manager recognition
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
        <div className="p-6 overflow-y-auto space-y-5 text-sm flex-1">
          {errorMessage && (
            <div className="p-3.5 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Operational Policy & Safeguard Alert */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1 text-xs text-slate-700">
            <div className="flex items-center space-x-1.5 font-semibold text-slate-900">
              <ShieldAlert className="w-4 h-4 text-blue-600" />
              <span>Security Department Policy & Governance</span>
            </div>
            <p className="text-[11px] text-slate-600 leading-relaxed">
              Initiatives submitted here recognize proactive security contributions and routine preventive checks.
              Manager recognition authorizes company accomplishment reporting, but <strong>does not substitute</strong> for mandatory formal work permits or specialized authorizations required for CCTV server rooms, high-voltage substations, or investigations.
            </p>
          </div>

          {/* 1. Initiative Type Selector */}
          <div>
            <label className="block text-xs font-semibold text-slate-800 mb-1.5 uppercase tracking-wider">
              1. Initiative Type <span className="text-rose-600">*</span>
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {INITIATIVE_TYPES.map((t) => {
                const isSelected = initiativeType === t.value;
                return (
                  <div
                    key={t.value}
                    onClick={() => setInitiativeType(t.value)}
                    className={`p-3.5 rounded-xl border cursor-pointer transition flex flex-col justify-between ${
                      isSelected
                        ? 'border-blue-600 bg-blue-50/60 ring-2 ring-blue-500/20'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="font-semibold text-xs text-slate-900">{t.label}</span>
                        {isSelected && (
                          <span className="w-2 h-2 rounded-full bg-blue-600"></span>
                        )}
                      </div>
                      <p className="text-[11px] text-slate-600 leading-relaxed">{t.description}</p>
                    </div>
                    <span className="text-[10px] text-blue-700 font-medium mt-2 pt-2 border-t border-slate-100 block">
                      {t.workflowHint}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {/* 2. Basic Information (Title, Category, Region, Specific Facility, Activity Date) */}
          <div className="space-y-4 pt-1">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Initiative Title <span className="text-rose-600">*</span>
              </label>
              <input
                type="text"
                placeholder="e.g., CCTV Blind Spot Risk Assessment at Bay 4 Loading Dock"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                required
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Activity Category <span className="text-rose-600">*</span>
                </label>
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

              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Region / Site <span className="text-rose-600">*</span>
                </label>
                <select
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white text-xs sm:text-sm"
                >
                  {PHILIPPINE_REGIONS.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block font-medium text-slate-700 mb-1">
                  Specific Facility / Post / Checkpoint
                </label>
                <input
                  type="text"
                  placeholder="e.g., Building B Main Guard Post, Warehouse 2"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
                />
              </div>

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
            </div>
          </div>

          {/* 3. Detailed Scope & Justification */}
          <div className="space-y-4 pt-1">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Identified Concern or Operational Opportunity <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Describe the physical security condition, potential risk, or process bottleneck you observed..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {initiativeType === 'self_initiated'
                  ? 'Action Taken (Completed Routine Work)'
                  : 'Proposed Action Plan'}{' '}
                <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                placeholder={
                  initiativeType === 'self_initiated'
                    ? 'Detail the specific inspection, verification, or coordination you performed...'
                    : 'Detail the steps you intend to carry out if authorized by the Security Manager...'
                }
                value={actionDetails}
                onChange={(e) => setActionDetails(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                {initiativeType === 'self_initiated'
                  ? 'Actual Accomplishment & Findings'
                  : 'Expected Outcome & Deliverables'}{' '}
                <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                placeholder={
                  initiativeType === 'self_initiated'
                    ? 'What was discovered or resolved? (e.g., Identified 2 defective door contacts, re-secured perimeter latch)'
                    : 'What will be achieved? (e.g., A mapped coverage diagram showing angle recommendations for Bay 4)'
                }
                value={expectedOutcome}
                onChange={(e) => setExpectedOutcome(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                required
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Justification / Operational Value <span className="text-rose-600">*</span>
              </label>
              <textarea
                rows={2}
                placeholder="Explain why this initiative enhances facility protection, asset safety, or risk mitigation..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900"
                required
              />
            </div>
          </div>

          {/* 4. Optional Context: Supporting Document / Photo Reference & Linked Task */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Supporting Evidence / Document Link (Optional)
              </label>
              <input
                type="text"
                placeholder="e.g., Logbook entry #418, photo reference, or cloud folder link"
                value={supportingDocument}
                onChange={(e) => setSupportingDocument(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              />
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Related Manager Task (Optional)
              </label>
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

          {/* Member Identity Stamp */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-center justify-between text-xs text-slate-500">
            <span>
              Author: <strong className="text-slate-800">{currentUser?.display_name}</strong> ({currentUser?.email})
            </span>
            <span>Recorded Automatically</span>
          </div>
        </div>

        {/* Footer Actions: Save Draft vs Submit */}
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
            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(true)}
              className="px-3.5 py-2 bg-white border border-slate-300 hover:bg-slate-100 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Save className="w-3.5 h-3.5 text-slate-500" />
              <span>Save Draft</span>
            </button>

            <button
              type="button"
              disabled={loading}
              onClick={() => handleSubmit(false)}
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>
                {loading
                  ? 'Submitting...'
                  : initiativeType === 'self_initiated'
                  ? 'Submit for Manager Validation'
                  : 'Submit for Manager Review'}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
