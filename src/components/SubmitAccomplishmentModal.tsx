import React, { useState } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { MemberInitiative } from '../types/index.ts';
import {
  X,
  Award,
  AlertCircle,
  CheckCircle,
  FileText,
  Send,
  Upload,
} from 'lucide-react';

interface SubmitAccomplishmentModalProps {
  initiative: MemberInitiative | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const SubmitAccomplishmentModal: React.FC<SubmitAccomplishmentModalProps> = ({
  initiative,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, isApproved } = useAuth();
  const { submitInitiativeAccomplishment } = useData();

  const [actualAccomplishment, setActualAccomplishment] = useState('');
  const [supportingDocument, setSupportingDocument] = useState('');
  const [remarks, setRemarks] = useState('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  if (!isOpen || !initiative) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isApproved) {
      setErrorMessage('Access Denied: Only approved personnel can submit accomplishments.');
      return;
    }

    if (!actualAccomplishment.trim()) {
      setErrorMessage('Please describe the actual accomplishment, findings, or completed deliverables.');
      return;
    }

    setLoading(true);
    try {
      await submitInitiativeAccomplishment(initiative.id, {
        actual_accomplishment: actualAccomplishment.trim(),
        supporting_document: supportingDocument.trim() || undefined,
        remarks: remarks.trim() || undefined,
      });

      setActualAccomplishment('');
      setSupportingDocument('');
      setRemarks('');
      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to submit accomplishment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-xl w-full overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2">
            <Award className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-semibold">Submit Accomplishment for Validation</h2>
              <p className="text-xs text-slate-400">
                Initiative: <span className="text-slate-200 font-medium">{initiative.title}</span>
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
        <form onSubmit={handleSubmit} className="p-6 space-y-4 text-sm">
          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-xs text-blue-900 space-y-1">
            <span className="font-bold block">Manager Validation Requirement</span>
            <p className="leading-relaxed">
              Once submitted, your Security Manager will review these completed findings. Upon manager sign-off, this initiative will officially count as a <strong>Recognized Initiative</strong> in departmental accomplishment reports.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Actual Accomplishment & Findings <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={4}
              placeholder="Describe the final results, findings observed, corrective actions taken, or physical hazards eliminated..."
              value={actualAccomplishment}
              onChange={(e) => setActualAccomplishment(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Supporting Evidence / Photo / Document Reference (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Incident Report #12-A, photo reference, or cloud folder link"
              value={supportingDocument}
              onChange={(e) => setSupportingDocument(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Additional Remarks for Security Manager (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Handed over findings to regional facility engineer."
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            />
          </div>

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
              className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg text-xs shadow-xs transition flex items-center space-x-1.5 disabled:opacity-50 cursor-pointer"
            >
              <Send className="w-3.5 h-3.5" />
              <span>{loading ? 'Submitting...' : 'Submit for Recognition'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
