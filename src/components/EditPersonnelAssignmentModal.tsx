import React, { useState, useEffect, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  UserProfile,
  EmploymentCategory,
  OperationalStatus,
  UserRole,
} from '../types/index.ts';
import {
  EMPLOYMENT_CATEGORY_LABELS,
  OPERATIONAL_STATUS_CONFIG,
} from '../lib/orgDefaults.ts';
import { getPhilippineToday } from '../lib/dateUtils.ts';
import { wouldCreateReportingCycle } from '../lib/performanceUtils.ts';
import {
  X,
  UserCog,
  AlertCircle,
  CheckCircle,
  ShieldAlert,
  GitBranch,
  Building2,
} from 'lucide-react';

interface EditPersonnelAssignmentModalProps {
  person: UserProfile | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

export const EditPersonnelAssignmentModal: React.FC<EditPersonnelAssignmentModalProps> = ({
  person,
  isOpen,
  onClose,
  onSuccess,
}) => {
  const { currentUser, isManager, isApproved, allProfiles } = useAuth();
  const {
    organizationalUnits,
    positions,
    operatingRegions,
    assignmentsByUserId,
    updatePersonnelAssignment,
    orgTablesReady,
  } = useData();

  const [unitId, setUnitId] = useState<string>('unit-rso');
  const [positionId, setPositionId] = useState<string>('pos-sec-off');
  const [reportsToUserId, setReportsToUserId] = useState<string>('');
  const [regionId, setRegionId] = useState<string>('reg-ncr');
  const [assignedSite, setAssignedSite] = useState<string>('');
  const [employmentCategory, setEmploymentCategory] =
    useState<EmploymentCategory>('organic_personnel');
  const [operationalStatus, setOperationalStatus] =
    useState<OperationalStatus>('active');
  const [effectiveFrom, setEffectiveFrom] = useState<string>(getPhilippineToday());
  const [appRole, setAppRole] = useState<UserRole>('member');
  const [notes, setNotes] = useState<string>('');
  const [changeReason, setChangeReason] = useState<string>('');

  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (person && isOpen) {
      const existing = assignmentsByUserId[person.id];
      setUnitId(
        existing?.organizational_unit_id ||
          (person.role === 'manager' ? 'unit-exec' : 'unit-rso')
      );
      setPositionId(
        existing?.position_id ||
          (person.role === 'manager' ? 'pos-mgr' : 'pos-sec-off')
      );
      setReportsToUserId(existing?.reports_to_user_id || '');
      setRegionId(existing?.region_id || 'reg-ncr');
      setAssignedSite(existing?.assigned_site || person.regional_assignment || '');
      setEmploymentCategory(
        existing?.employment_category ||
          (person.role === 'manager' ? 'management' : 'organic_personnel')
      );
      setOperationalStatus(existing?.operational_status || (person.active ? 'active' : 'inactive'));
      setEffectiveFrom(getPhilippineToday());
      setAppRole(person.role);
      setNotes(existing?.notes || '');
      setChangeReason('');
      setErrorMessage(null);
    }
  }, [person, isOpen, assignmentsByUserId]);

  // Eligible supervisors: approved active personnel who wouldn't create a circular chain
  const eligibleSupervisors = useMemo(() => {
    if (!person) return [];
    return allProfiles.filter((candidate) => {
      if (!candidate.approved || !candidate.active) return false;
      if (candidate.id === person.id) return false;
      if (wouldCreateReportingCycle(person.id, candidate.id, assignmentsByUserId)) {
        return false;
      }
      return true;
    });
  }, [person, allProfiles, assignmentsByUserId]);

  if (!isOpen || !person) return null;

  const isSelf = person.id === currentUser?.id;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (!isManager || !isApproved) {
      setErrorMessage('Access Denied: Only approved Security Managers can edit personnel assignments.');
      return;
    }
    if (!changeReason.trim()) {
      setErrorMessage(
        'Please specify an administrative reason for this update (recorded in personnel reporting history).'
      );
      return;
    }

    const selectedRegion = operatingRegions.find((r) => r.id === regionId);
    const regionLabel = assignedSite.trim()
      ? `${selectedRegion?.name || ''} (${assignedSite.trim()})`.trim()
      : selectedRegion?.name || person.regional_assignment || 'NCR - Metro Manila';

    setLoading(true);
    try {
      await updatePersonnelAssignment({
        profile_user_id: person.id,
        organizational_unit_id: unitId || null,
        position_id: positionId || null,
        reports_to_user_id: reportsToUserId || null,
        region_id: regionId || null,
        assigned_site: assignedSite.trim(),
        employment_category: employmentCategory,
        operational_status: operationalStatus,
        effective_from: effectiveFrom || getPhilippineToday(),
        notes: notes.trim(),
        change_reason: changeReason.trim(),
        app_role: !isSelf ? appRole : undefined,
        regional_assignment_label: regionLabel,
      });

      onSuccess?.();
      onClose();
    } catch (err: any) {
      setErrorMessage(err.message || 'Failed to save personnel organizational assignment.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-2xl w-full max-h-[92vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <UserCog className="w-5 h-5 text-blue-400" />
            <div>
              <h2 className="text-base font-semibold">Manage Personnel Assignment & Hierarchy</h2>
              <p className="text-xs text-slate-400">
                {person.display_name} • <span className="font-mono">{person.email}</span>
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

        <form onSubmit={handleSubmit} className="p-6 overflow-y-auto space-y-4 text-xs sm:text-sm flex-1">
          {!orgTablesReady && (
            <div className="p-3 bg-amber-50 border border-amber-300 text-amber-900 rounded-lg text-xs flex items-start space-x-2">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5 text-amber-700" />
              <div>
                <strong>Database Migration Pending:</strong> Run{' '}
                <code className="bg-amber-100 px-1 rounded">supabase/migration_personnel_hierarchy.sql</code>{' '}
                in your Supabase SQL Editor before saving organizational assignments.
              </div>
            </div>
          )}

          {errorMessage && (
            <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-start space-x-2 text-xs">
              <AlertCircle className="w-4 h-4 flex-shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* Unique Identity Box */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 text-xs">
            <div>
              <span className="text-slate-400 uppercase font-bold text-[10px] block">
                Registered Personnel Identity
              </span>
              <span className="font-bold text-slate-900">{person.display_name}</span>{' '}
              <span className="text-slate-500 font-mono">({person.email})</span>
            </div>
            <div className="text-[10px] font-mono text-slate-500 bg-white px-2 py-1 rounded border border-slate-200">
              UUID: {person.id.slice(0, 14)}...
            </div>
          </div>

          {/* Department Unit & Position */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1 flex items-center space-x-1">
                <Building2 className="w-3.5 h-3.5 text-blue-600" />
                <span>Department Unit</span>
              </label>
              <select
                value={unitId}
                onChange={(e) => setUnitId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs sm:text-sm"
              >
                {organizationalUnits
                  .filter((u) => u.is_active)
                  .map((u) => (
                    <option key={u.id} value={u.id}>
                      {u.name} ({u.code})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Position / Designation
              </label>
              <select
                value={positionId}
                onChange={(e) => setPositionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs sm:text-sm"
              >
                {positions
                  .filter((p) => p.is_active)
                  .map((pos) => (
                    <option key={pos.id} value={pos.id}>
                      {pos.title} {pos.is_supervisory ? '(Supervisory)' : ''}
                    </option>
                  ))}
              </select>
            </div>
          </div>

          {/* Reporting Hierarchy (Immediate Supervisor) */}
          <div className="p-3.5 bg-blue-50/60 border border-blue-200 rounded-xl space-y-2">
            <label className="block font-semibold text-blue-950 flex items-center space-x-1.5 text-xs sm:text-sm">
              <GitBranch className="w-4 h-4 text-blue-700" />
              <span>Immediate Supervisor (Reports To)</span>
            </label>
            <select
              value={reportsToUserId}
              onChange={(e) => setReportsToUserId(e.target.value)}
              className="w-full px-3 py-2 border border-blue-300 rounded-lg text-slate-900 bg-white text-xs sm:text-sm"
            >
              <option value="">-- Top Level / Direct Executive Oversight --</option>
              {eligibleSupervisors.map((sup) => {
                const supAssign = assignmentsByUserId[sup.id];
                const supPos = supAssign?.position_id
                  ? positions.find((p) => p.id === supAssign.position_id)?.title
                  : sup.role === 'manager'
                  ? 'Security Manager'
                  : 'Team Member';
                return (
                  <option key={sup.id} value={sup.id}>
                    {sup.display_name} — {supPos} ({sup.email})
                  </option>
                );
              })}
            </select>
            <p className="text-[11px] text-blue-800">
              Circular reporting chains and self-supervision are automatically blocked. Assigning a Supervisory position (e.g., Regional Security Supervisor) does NOT automatically elevate system approval permissions.
            </p>
          </div>

          {/* Operating Region & Assigned Site */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Operating Region
              </label>
              <select
                value={regionId}
                onChange={(e) => setRegionId(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs sm:text-sm"
              >
                {operatingRegions
                  .filter((r) => r.is_active)
                  .map((r) => (
                    <option key={r.id} value={r.id}>
                      {r.name} ({r.island_group})
                    </option>
                  ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1">
                Assigned Facility / Site
              </label>
              <input
                type="text"
                placeholder="e.g., Head Office BGC, Taguig Data Center, Clark Hub"
                value={assignedSite}
                onChange={(e) => setAssignedSite(e.target.value)}
                className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-xs sm:text-sm"
              />
            </div>
          </div>

          {/* Category, Operational Status, Effective Date */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div>
              <label className="block font-medium text-slate-700 mb-1 text-xs">
                Personnel Category
              </label>
              <select
                value={employmentCategory}
                onChange={(e) => setEmploymentCategory(e.target.value as EmploymentCategory)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs"
              >
                {Object.entries(EMPLOYMENT_CATEGORY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>
                    {label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 text-xs">
                Operational Status
              </label>
              <select
                value={operationalStatus}
                onChange={(e) => setOperationalStatus(e.target.value as OperationalStatus)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs"
              >
                {Object.entries(OPERATIONAL_STATUS_CONFIG).map(([val, cfg]) => (
                  <option key={val} value={val}>
                    {cfg.label}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block font-medium text-slate-700 mb-1 text-xs">
                Effective Date (PHT)
              </label>
              <input
                type="date"
                value={effectiveFrom}
                onChange={(e) => setEffectiveFrom(e.target.value)}
                className="w-full px-2.5 py-2 border border-slate-300 rounded-lg text-slate-900 bg-white text-xs"
              />
            </div>
          </div>

          {/* Explicit Application Authorization Role (Manager-only) */}
          {!isSelf && (
            <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs">
              <div className="flex items-center justify-between">
                <label className="font-semibold text-slate-800 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-amber-600" />
                  <span>SOH Application Access Role</span>
                </label>
                <select
                  value={appRole}
                  onChange={(e) => setAppRole(e.target.value as UserRole)}
                  className="px-2.5 py-1 border border-slate-300 rounded bg-white font-semibold text-slate-900"
                >
                  <option value="member">Team Member (Standard Access)</option>
                  <option value="manager">Security Manager (Department Admin)</option>
                </select>
              </div>
              <p className="text-[11px] text-slate-500">
                Keep supervisors as <strong>Team Member</strong> unless they explicitly require full department-wide Manager approval rights.
              </p>
            </div>
          )}

          {/* Mandatory Administrative Reason (Preserves Historical Reporting) */}
          <div>
            <label className="block font-medium text-slate-700 mb-1 text-xs sm:text-sm">
              Reason for Assignment / Transfer <span className="text-rose-600">*</span>
            </label>
            <textarea
              rows={2}
              placeholder="e.g., Initial organizational onboarding, or Regional rotation to South Luzon. Prior regional metrics remain preserved under original region."
              value={changeReason}
              onChange={(e) => setChangeReason(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-xs sm:text-sm"
              required
            />
          </div>

          <div>
            <label className="block font-medium text-slate-700 mb-1 text-xs">
              Additional Remarks (Optional)
            </label>
            <input
              type="text"
              placeholder="e.g., Direct oversight of agency guards at North Gate"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 text-xs"
            />
          </div>

          <div className="pt-4 border-t border-slate-200 flex items-center justify-end space-x-3">
            <button
              type="button"
              onClick={onClose}
              disabled={loading}
              className="px-4 py-2 border border-slate-300 rounded-lg text-slate-700 hover:bg-slate-50 text-xs font-semibold transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !orgTablesReady}
              className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg shadow-xs transition flex items-center space-x-1.5 text-xs disabled:opacity-50 cursor-pointer"
            >
              <CheckCircle className="w-4 h-4" />
              <span>{loading ? 'Saving Assignment...' : 'Save Assignment'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
