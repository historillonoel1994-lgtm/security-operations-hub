import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { MemberInitiative, InitiativeHistory } from '../types/index.ts';
import { INITIATIVE_STATUS_CONFIG, INITIATIVE_TYPES } from '../lib/initiativeConstants.ts';
import { formatPhilippineDate, formatPhilippineDateTime } from '../lib/dateUtils.ts';
import {
  X,
  Award,
  CheckCircle,
  RotateCcw,
  AlertCircle,
  FileText,
  MapPin,
  Calendar,
  User,
  Shield,
  ShieldAlert,
  Play,
  Send,
  Trash2,
  Edit3,
  Clock,
  ExternalLink,
  Ban,
} from 'lucide-react';

interface InitiativeDetailModalProps {
  initiative: MemberInitiative | null;
  isOpen: boolean;
  onClose: () => void;
  onOpenEdit?: (initiative: MemberInitiative) => void;
  onOpenSubmitAccomplishment?: (initiative: MemberInitiative) => void;
}

export const InitiativeDetailModal: React.FC<InitiativeDetailModalProps> = ({
  initiative,
  isOpen,
  onClose,
  onOpenEdit,
  onOpenSubmitAccomplishment,
}) => {
  const { currentUser, isManager, isApproved } = useAuth();
  const {
    initiativeHistory,
    reviewInitiative,
    startInitiativeProgress,
    deleteDraftInitiative,
  } = useData();

  // Manager action inputs
  const [managerAction, setManagerAction] = useState<
    'approve' | 'return' | 'reject' | 'recognize' | 'revoke' | null
  >(null);
  const [managerNote, setManagerNote] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  if (!isOpen || !initiative) return null;

  const isAuthor = initiative.submitted_by === currentUser?.id;
  const historyList: InitiativeHistory[] = initiativeHistory[initiative.id] || [];
  const statusCfg = INITIATIVE_STATUS_CONFIG[initiative.status] || INITIATIVE_STATUS_CONFIG.draft;
  const typeCfg = INITIATIVE_TYPES.find((t) => t.value === initiative.initiative_type) || INITIATIVE_TYPES[0];

  const handleManagerDecision = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!managerAction) return;
    setErrorMessage(null);
    setSuccessMessage(null);

    if (['return', 'reject', 'revoke'].includes(managerAction) && !managerNote.trim()) {
      setErrorMessage(`Please provide a written operational reason for choosing to ${managerAction} this initiative.`);
      return;
    }

    setLoading(true);
    try {
      await reviewInitiative(initiative.id, managerAction, managerNote);
      setManagerAction(null);
      setManagerNote('');
      setSuccessMessage(
        managerAction === 'recognize'
          ? 'Initiative officially validated and recognized in department reports!'
          : managerAction === 'approve'
          ? 'Proposal authorized to proceed with field execution.'
          : managerAction === 'return'
          ? 'Initiative returned to member for revision.'
          : managerAction === 'revoke'
          ? 'Initiative recognition revoked and returned for correction.'
          : 'Initiative rejected.'
      );
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit review.');
    } finally {
      setLoading(false);
    }
  };

  const handleStartProgress = async () => {
    setLoading(true);
    try {
      await startInitiativeProgress(initiative.id);
      setSuccessMessage('Initiative marked as In Progress. You can now execute field actions.');
      setTimeout(() => setSuccessMessage(null), 3000);
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to start initiative.');
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDraft = async () => {
    if (!window.confirm('Are you sure you want to delete this draft initiative?')) return;
    setLoading(true);
    try {
      await deleteDraftInitiative(initiative.id);
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to delete draft.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-3xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-start justify-between">
          <div className="space-y-1.5 pr-4">
            <div className="flex flex-wrap items-center gap-2">
              <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}>
                {statusCfg.label}
              </span>
              <span className="text-xs bg-slate-800 text-slate-200 px-2.5 py-0.5 rounded border border-slate-700">
                {typeCfg.label}
              </span>
              <span className="text-xs bg-blue-950 text-blue-300 px-2.5 py-0.5 rounded border border-blue-800">
                {initiative.category}
              </span>
            </div>
            <h2 className="text-base sm:text-lg font-bold text-white tracking-tight">
              {initiative.title}
            </h2>
            <div className="text-[11px] text-slate-400 flex items-center space-x-2">
              <span>ID: <strong className="font-mono text-slate-300">{initiative.id}</strong></span>
              <span>•</span>
              <span>Submitted: {formatPhilippineDateTime(initiative.created_at)}</span>
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

        {/* Modal Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-6 text-sm flex-1">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}
          {successMessage && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-start space-x-2 text-xs">
              <CheckCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* Key Metadata Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-slate-50 rounded-lg border border-slate-200 text-xs">
            <div className="flex items-center space-x-2 text-slate-700">
              <User className="w-4 h-4 text-blue-600 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Submitted By</span>
                <span className="font-medium text-slate-900">{initiative.submitted_by_name || 'Authorized Member'}</span>
                <span className="text-[10px] text-slate-500 block truncate max-w-[160px]">{initiative.submitted_by_email}</span>
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <MapPin className="w-4 h-4 text-emerald-600 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Facility / Site</span>
                <span className="font-medium text-slate-900">{initiative.region}</span>
                {initiative.location && (
                  <span className="text-[10px] text-slate-500 block truncate max-w-[160px]">{initiative.location}</span>
                )}
              </div>
            </div>

            <div className="flex items-center space-x-2 text-slate-700">
              <Calendar className="w-4 h-4 text-amber-600 flex-shrink-0" />
              <div>
                <span className="text-slate-400 block text-[10px]">Activity Date (PHT)</span>
                <span className="font-medium text-slate-900">{formatPhilippineDate(initiative.activity_date)}</span>
              </div>
            </div>
          </div>

          {/* Official Recognition Banner if recognized */}
          {initiative.status === 'recognized' && (
            <div className="p-4 bg-emerald-50 border border-emerald-300 rounded-xl space-y-1.5 text-xs text-emerald-950">
              <div className="flex items-center space-x-2 text-emerald-900 font-bold">
                <Award className="w-5 h-5 text-emerald-700" />
                <span className="text-sm">Officially Recognized Security Initiative</span>
              </div>
              <p className="text-emerald-800 leading-relaxed">
                Validated and approved by <strong>{initiative.reviewed_by_name || 'Security Management'}</strong> on{' '}
                {formatPhilippineDateTime(initiative.recognized_at || initiative.updated_at)}. This initiative is officially counted in departmental accomplishment reporting.
              </p>
              {initiative.manager_remarks && (
                <div className="mt-2 p-2.5 bg-white/80 rounded border border-emerald-200 text-slate-800">
                  <span className="font-semibold block text-emerald-900 text-[11px]">Manager Commendation:</span>
                  <span>{initiative.manager_remarks}</span>
                </div>
              )}
            </div>
          )}

          {/* Returned Banner if returned */}
          {initiative.status === 'returned' && (
            <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl space-y-1.5 text-xs text-rose-950">
              <div className="flex items-center space-x-1.5 font-bold text-rose-900">
                <RotateCcw className="w-4 h-4 text-rose-700" />
                <span>Returned for Revision by Manager</span>
              </div>
              <p className="font-medium text-slate-800 bg-white p-3 rounded border border-rose-200">
                "{initiative.manager_remarks || 'Please update and clarify details per manager feedback.'}"
              </p>
              {isAuthor && onOpenEdit && (
                <button
                  type="button"
                  onClick={() => {
                    onClose();
                    onOpenEdit(initiative);
                  }}
                  className="mt-2 px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>Open Form to Revise & Resubmit</span>
                </button>
              )}
            </div>
          )}

          {/* 4 Core Content Blocks */}
          <div className="space-y-4">
            {/* 1. Description */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                1. Identified Concern / Operational Opportunity
              </span>
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-xs">
                {initiative.description}
              </div>
            </div>

            {/* 2. Action Taken / Proposed */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                2. {initiative.initiative_type === 'self_initiated' ? 'Action Taken' : 'Proposed Action Plan'}
              </span>
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-xs">
                {initiative.action_details}
              </div>
            </div>

            {/* 3. Expected Outcome / Accomplishment */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                3. {initiative.initiative_type === 'self_initiated' ? 'Accomplishment & Findings' : 'Expected Outcome & Deliverables'}
              </span>
              <div className="p-3.5 bg-white border border-slate-200 rounded-lg text-slate-800 text-xs sm:text-sm whitespace-pre-wrap leading-relaxed shadow-xs">
                {initiative.expected_outcome}
              </div>
            </div>

            {/* 4. Justification */}
            <div className="space-y-1">
              <span className="text-xs font-semibold text-slate-700 uppercase tracking-wider block">
                4. Operational Justification & Risk Mitigation Value
              </span>
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg text-slate-800 text-xs whitespace-pre-wrap leading-relaxed">
                {initiative.justification}
              </div>
            </div>
          </div>

          {/* References & Links */}
          {(initiative.supporting_document || initiative.related_task_title || initiative.remarks) && (
            <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2 text-xs">
              <span className="font-semibold text-slate-800 block">Supporting References & Context:</span>
              <div className="space-y-1 text-slate-600">
                {initiative.supporting_document && (
                  <div>
                    <span className="font-medium text-slate-700">Supporting Reference:</span>{' '}
                    <span className="font-mono text-slate-800">{initiative.supporting_document}</span>
                  </div>
                )}
                {initiative.related_task_title && (
                  <div>
                    <span className="font-medium text-slate-700">Related Task:</span>{' '}
                    <span>{initiative.related_task_title}</span>
                  </div>
                )}
                {initiative.remarks && (
                  <div>
                    <span className="font-medium text-slate-700">Member Remarks:</span>{' '}
                    <span>{initiative.remarks}</span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Operational Safeguard Reminder */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex items-start space-x-2 text-[11px] text-slate-500">
            <Shield className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <span>
              Official recognition acknowledges proactive contribution to corporate physical security. It does not waive required company approvals for restricted areas, door access systems, or investigations.
            </span>
          </div>

          {/* Audit History Timeline */}
          <div className="space-y-3 pt-2">
            <h3 className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center space-x-1.5">
              <Clock className="w-3.5 h-3.5 text-slate-500" />
              <span>Initiative Audit & Transition Timeline ({historyList.length})</span>
            </h3>

            {historyList.length === 0 ? (
              <p className="text-xs text-slate-400 italic p-3 bg-slate-50 rounded-lg border border-slate-100">
                No history entries recorded yet.
              </p>
            ) : (
              <div className="space-y-2.5">
                {historyList.map((h) => (
                  <div
                    key={h.id}
                    className="p-3 rounded-lg border border-slate-200 bg-slate-50 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <span className="font-semibold text-slate-900">{h.actor_name || 'User'}</span>
                        <span className="text-[10px] bg-white px-1.5 py-0.2 rounded border border-slate-200 uppercase font-medium text-slate-600">
                          {h.actor_role}
                        </span>
                        {h.new_status && (
                          <span className="text-[10px] text-slate-500 font-mono">
                            → {h.new_status.replace(/_/g, ' ')}
                          </span>
                        )}
                      </div>
                      <span className="text-[10px] text-slate-400">
                        {formatPhilippineDateTime(h.created_at)}
                      </span>
                    </div>
                    {h.notes && (
                      <p className="text-slate-700 leading-relaxed whitespace-pre-wrap">{h.notes}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Manager Review Controls */}
          {isManager && isApproved && (
            <div className="p-4 bg-slate-900 text-white rounded-xl space-y-3">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <ShieldAlert className="w-4 h-4 text-amber-400" />
                  <span className="text-xs font-semibold text-white uppercase tracking-wider">
                    Manager Review & Disposition Panel
                  </span>
                </div>
                {(initiative.status === 'pending_review' || initiative.status === 'accomplishment_submitted') && (
                  <span className="text-[11px] bg-amber-500 text-slate-900 font-bold px-2 py-0.5 rounded">
                    Action Required
                  </span>
                )}
              </div>

              {!managerAction ? (
                <div className="flex flex-wrap gap-2 pt-1">
                  {/* Proposed in Pending Review */}
                  {initiative.status === 'pending_review' && initiative.initiative_type === 'proposed' && (
                    <>
                      <button
                        type="button"
                        onClick={() => setManagerAction('approve')}
                        className="px-3.5 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <CheckCircle className="w-3.5 h-3.5" />
                        <span>Authorize to Proceed</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagerAction('return')}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return for Revision</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagerAction('reject')}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Reject Proposal</span>
                      </button>
                    </>
                  )}

                  {/* Self-initiated in Pending Review OR Completed proposal in Accomplishment Submitted */}
                  {(initiative.status === 'accomplishment_submitted' ||
                    (initiative.status === 'pending_review' && initiative.initiative_type === 'self_initiated')) && (
                    <>
                      <button
                        type="button"
                        onClick={() => setManagerAction('recognize')}
                        className="px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer shadow-xs"
                      >
                        <Award className="w-3.5 h-3.5" />
                        <span>Validate & Officially Recognize</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagerAction('return')}
                        className="px-3.5 py-2 bg-rose-600 hover:bg-rose-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>Return for Clarification</span>
                      </button>
                      <button
                        type="button"
                        onClick={() => setManagerAction('reject')}
                        className="px-3.5 py-2 bg-slate-700 hover:bg-slate-600 text-slate-200 font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      >
                        <Ban className="w-3.5 h-3.5" />
                        <span>Reject</span>
                      </button>
                    </>
                  )}

                  {/* Recognized - Manager can revoke if material error discovered */}
                  {initiative.status === 'recognized' && (
                    <button
                      type="button"
                      onClick={() => setManagerAction('revoke')}
                      className="px-3.5 py-2 bg-amber-600 hover:bg-amber-700 text-white font-medium rounded-lg text-xs flex items-center space-x-1.5 transition cursor-pointer"
                      title="Revoke official recognition if an error is discovered"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      <span>Revoke Recognition (Correction)</span>
                    </button>
                  )}
                </div>
              ) : (
                <form onSubmit={handleManagerDecision} className="space-y-3 pt-2">
                  <div>
                    <label className="block text-xs font-medium text-slate-300 mb-1">
                      {managerAction === 'recognize'
                        ? 'Recognition Commendation Note (Optional):'
                        : managerAction === 'approve'
                        ? 'Manager Authorization Guidance (Optional):'
                        : 'Documented Operational Reason (Required):'}
                    </label>
                    <textarea
                      rows={2}
                      placeholder={
                        managerAction === 'recognize'
                          ? 'e.g., Validated inspection findings. Preventive physical security enhancements verified.'
                          : managerAction === 'approve'
                          ? 'e.g., Work plan authorized. Coordinate with Facility Lead before testing.'
                          : 'e.g., Please attach missing photo evidence, or clarify scope of verification...'
                      }
                      value={managerNote}
                      onChange={(e) => setManagerNote(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-800 border border-slate-700 rounded-lg text-xs text-white focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                      required={['return', 'reject', 'revoke'].includes(managerAction)}
                    />
                  </div>

                  <div className="flex items-center space-x-2">
                    <button
                      type="submit"
                      disabled={loading}
                      className={`px-4 py-1.5 text-xs font-semibold rounded-lg text-white transition cursor-pointer ${
                        managerAction === 'recognize'
                          ? 'bg-emerald-600 hover:bg-emerald-700'
                          : managerAction === 'approve'
                          ? 'bg-blue-600 hover:bg-blue-700'
                          : 'bg-rose-600 hover:bg-rose-700'
                      }`}
                    >
                      {loading
                        ? 'Processing...'
                        : managerAction === 'recognize'
                        ? 'Confirm Recognition'
                        : managerAction === 'approve'
                        ? 'Confirm Authorization'
                        : managerAction === 'revoke'
                        ? 'Confirm Revocation'
                        : `Confirm ${managerAction}`}
                    </button>
                    <button
                      type="button"
                      onClick={() => setManagerAction(null)}
                      className="px-3 py-1.5 text-xs text-slate-400 hover:text-white"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              )}
            </div>
          )}

          {/* Member In-Progress Actions */}
          {isAuthor && initiative.status === 'approved_to_proceed' && (
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-center justify-between gap-3 text-xs text-blue-950">
              <div>
                <span className="font-bold block">Proposal Authorized by Manager!</span>
                <span>You may now proceed with field execution. Click to mark In Progress.</span>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={handleStartProgress}
                className="px-3.5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg flex items-center space-x-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5" />
                <span>Start Field Work</span>
              </button>
            </div>
          )}

          {isAuthor && initiative.status === 'in_progress' && onOpenSubmitAccomplishment && (
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-xl flex items-center justify-between gap-3 text-xs text-purple-950">
              <div>
                <span className="font-bold block">Field Activity In Progress</span>
                <span>When finished, document your findings and submit for official Manager Recognition.</span>
              </div>
              <button
                type="button"
                onClick={() => {
                  onClose();
                  onOpenSubmitAccomplishment(initiative);
                }}
                className="px-3.5 py-2 bg-purple-700 hover:bg-purple-800 text-white font-semibold rounded-lg flex items-center space-x-1.5 transition cursor-pointer whitespace-nowrap"
              >
                <Award className="w-3.5 h-3.5" />
                <span>Submit Accomplishment</span>
              </button>
            </div>
          )}

          {/* Member Draft Actions */}
          {isAuthor && initiative.status === 'draft' && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-center justify-between gap-3 text-xs">
              <span className="text-slate-600">
                This initiative is saved as a private Draft and is not yet visible to your Manager.
              </span>
              <div className="flex items-center space-x-2">
                <button
                  type="button"
                  disabled={loading}
                  onClick={handleDeleteDraft}
                  className="px-3 py-1.5 bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100 font-semibold rounded-lg flex items-center space-x-1 transition cursor-pointer"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>Delete</span>
                </button>
                {onOpenEdit && (
                  <button
                    type="button"
                    onClick={() => {
                      onClose();
                      onOpenEdit(initiative);
                    }}
                    className="px-3.5 py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg flex items-center space-x-1 transition cursor-pointer"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    <span>Edit & Submit</span>
                  </button>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Modal Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex justify-end">
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
