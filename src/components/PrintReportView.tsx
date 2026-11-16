import React, { useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  formatPhilippineDate,
  formatPhilippineDateTime,
  getDueStatusLabel,
} from '../lib/dateUtils.ts';
import {
  computePersonnelPerformance,
  computeUnitPerformanceSummaries,
  computeRegionalPerformanceSummaries,
  getDateRangeForPreset,
  isTaskInReportingCohort,
  isWithinDateWindow,
} from '../lib/performanceUtils.ts';
import { OPERATIONAL_STATUS_CONFIG } from '../lib/orgDefaults.ts';
import { ArrowLeft, Printer, Shield, Award, User, ShieldAlert } from 'lucide-react';

interface PrintReportViewProps {
  onBack: () => void;
  targetUserId?: string | null;
  reportFromDate?: string;
  reportToDate?: string;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({
  onBack,
  targetUserId = null,
  reportFromDate,
  reportToDate,
}) => {
  const { currentUser, isManager, allProfiles } = useAuth();
  const {
    tasks,
    allDepartmentTasks,
    taskUpdates,
    activities,
    initiatives,
    allDepartmentInitiatives,
    initiativeHistory,
    organizationalUnits,
    positions,
    operatingRegions,
    assignmentsByUserId,
    mySupervisor,
  } = useData();

  const defaultMonth = getDateRangeForPreset('month');
  const fromDate = reportFromDate || defaultMonth.fromDate;
  const toDate = reportToDate || defaultMonth.toDate;

  const sourceTasks = isManager ? allDepartmentTasks : tasks;
  const sourceInitiatives = isManager ? allDepartmentInitiatives : initiatives;

  const profilesById = useMemo(() => {
    const map: Record<string, (typeof allProfiles)[number]> = {};
    for (const p of allProfiles) map[p.id] = p;
    if (currentUser && !map[currentUser.id]) map[currentUser.id] = currentUser;
    return map;
  }, [allProfiles, currentUser]);

  // Security guard: non-managers may only print their own individual report
  const unauthorizedIndividualRequest =
    Boolean(targetUserId) && !isManager && targetUserId !== currentUser?.id;

  const targetUser = useMemo(() => {
    if (!targetUserId || unauthorizedIndividualRequest) return null;
    return profilesById[targetUserId] || null;
  }, [targetUserId, unauthorizedIndividualRequest, profilesById]);

  const individualRecord = useMemo(() => {
    if (!targetUser) return null;
    return computePersonnelPerformance({
      user: targetUser,
      assignment: assignmentsByUserId[targetUser.id] || null,
      units: organizationalUnits,
      positions,
      regions: operatingRegions,
      profilesById,
      assignmentsById: assignmentsByUserId,
      tasks: sourceTasks,
      taskUpdates,
      activities,
      initiatives: sourceInitiatives,
      initiativeHistory,
      fromDate,
      toDate,
    });
  }, [
    targetUser,
    assignmentsByUserId,
    organizationalUnits,
    positions,
    operatingRegions,
    profilesById,
    sourceTasks,
    taskUpdates,
    activities,
    sourceInitiatives,
    initiativeHistory,
    fromDate,
    toDate,
  ]);

  // Individual filtered lists
  const individualTasks = useMemo(() => {
    if (!targetUser) return [];
    return sourceTasks.filter(
      (t) => t.assigned_to === targetUser.id && isTaskInReportingCohort(t, fromDate, toDate)
    );
  }, [targetUser, sourceTasks, fromDate, toDate]);

  const individualActivities = useMemo(() => {
    if (!targetUser) return [];
    return activities.filter(
      (a) => a.author_id === targetUser.id && isWithinDateWindow(a.activity_date, fromDate, toDate)
    );
  }, [targetUser, activities, fromDate, toDate]);

  const individualInitiatives = useMemo(() => {
    if (!targetUser) return [];
    return sourceInitiatives.filter(
      (i) =>
        i.submitted_by === targetUser.id &&
        i.status !== 'draft' &&
        isWithinDateWindow(i.activity_date || i.created_at, fromDate, toDate)
    );
  }, [targetUser, sourceInitiatives, fromDate, toDate]);

  // Department Executive Mode computations
  const activeTasks = sourceTasks.filter((t) => t.status !== 'completed');
  const completedTasks = sourceTasks.filter((t) => t.status === 'completed');
  const overdueTasks = sourceTasks.filter((t) => getDueStatusLabel(t.due_date, t.status).isOverdue);
  const recognizedInitiatives = sourceInitiatives.filter((i) => i.status === 'recognized');

  const deptPersonnelRecords = useMemo(() => {
    if (!isManager || targetUserId) return [];
    return allProfiles
      .filter((p) => p.approved)
      .map((user) =>
        computePersonnelPerformance({
          user,
          assignment: assignmentsByUserId[user.id] || null,
          units: organizationalUnits,
          positions,
          regions: operatingRegions,
          profilesById,
          assignmentsById: assignmentsByUserId,
          tasks: sourceTasks,
          taskUpdates,
          activities,
          initiatives: sourceInitiatives,
          initiativeHistory,
          fromDate,
          toDate,
        })
      );
  }, [
    isManager,
    targetUserId,
    allProfiles,
    assignmentsByUserId,
    organizationalUnits,
    positions,
    operatingRegions,
    profilesById,
    sourceTasks,
    taskUpdates,
    activities,
    sourceInitiatives,
    initiativeHistory,
    fromDate,
    toDate,
  ]);

  const unitSummaries = useMemo(() => {
    if (!isManager || targetUserId) return [];
    return computeUnitPerformanceSummaries({
      units: organizationalUnits,
      personnelRecords: deptPersonnelRecords,
    });
  }, [isManager, targetUserId, organizationalUnits, deptPersonnelRecords]);

  const regionalSummaries = useMemo(() => {
    if (!isManager || targetUserId) return [];
    return computeRegionalPerformanceSummaries({
      regions: operatingRegions,
      personnelRecords: deptPersonnelRecords,
      tasks: sourceTasks,
      taskUpdates,
      activities,
      initiatives: sourceInitiatives,
      fromDate,
      toDate,
    });
  }, [
    isManager,
    targetUserId,
    operatingRegions,
    deptPersonnelRecords,
    sourceTasks,
    taskUpdates,
    activities,
    sourceInitiatives,
    fromDate,
    toDate,
  ]);

  const handlePrint = () => {
    window.print();
  };

  if (unauthorizedIndividualRequest) {
    return (
      <div className="min-h-screen bg-slate-100 p-8 flex flex-col items-center justify-center text-slate-900">
        <div className="max-w-md bg-white p-6 rounded-xl border border-rose-200 shadow-sm text-center space-y-3">
          <ShieldAlert className="w-8 h-8 text-rose-600 mx-auto" />
          <h2 className="font-bold text-base">Access Restricted</h2>
          <p className="text-xs text-slate-600">
            Team Members can only print their own performance summary. Other personnel reports require Security Manager authorization.
          </p>
          <button
            type="button"
            onClick={onBack}
            className="px-4 py-2 bg-slate-800 text-white text-xs font-semibold rounded-lg"
          >
            Back to Operations Hub
          </button>
        </div>
      </div>
    );
  }

  const supervisorName =
    individualRecord?.supervisor?.name ||
    (targetUser?.id === currentUser?.id ? mySupervisor?.supervisor_name : null) ||
    'Not Assigned';

  const supervisorPosition =
    individualRecord?.supervisor?.positionTitle ||
    (targetUser?.id === currentUser?.id ? mySupervisor?.position_title : null) ||
    '';

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      {/* Non-print controls bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition cursor-pointer"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Operations Hub</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition shadow-xs cursor-pointer"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* ================================================================= */}
      {/* MODE A: INDIVIDUAL PERSONNEL ACCOMPLISHMENT & PERFORMANCE REPORT  */}
      {/* ================================================================= */}
      {targetUserId && individualRecord ? (
        <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-6">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-5 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-slate-900">
                <Shield className="w-6 h-6 text-blue-900" />
                <span className="text-lg font-bold uppercase tracking-wider">
                  Corporate Security Operations Hub
                </span>
              </div>
              <p className="text-xs text-slate-700 font-semibold">
                Individual Personnel Accomplishment & Operational Performance Report
              </p>
              <p className="text-[11px] text-slate-500">
                Reporting Window: {formatPhilippineDate(fromDate)} to {formatPhilippineDate(toDate)} (Asia/Manila)
              </p>
            </div>

            <div className="text-right text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Date Generated:</span>{' '}
                {formatPhilippineDateTime(new Date().toISOString())}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Prepared For / Requested By:</span>{' '}
                {currentUser?.display_name || 'Authorized User'}
              </div>
            </div>
          </div>

          {/* Personnel Profile & Hierarchy Block */}
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-lg grid grid-cols-2 sm:grid-cols-3 gap-3 text-xs">
            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500 flex items-center space-x-1">
                <User className="w-3 h-3" />
                <span>Personnel Name</span>
              </span>
              <div className="font-bold text-slate-900 mt-0.5">{individualRecord.user.display_name}</div>
              <div className="text-[11px] text-slate-500">{individualRecord.user.email}</div>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Position & Unit</span>
              <div className="font-semibold text-slate-900 mt-0.5">
                {individualRecord.position?.title ||
                  (individualRecord.user.role === 'manager' ? 'Security Manager' : 'Security Officer')}
              </div>
              <div className="text-[11px] text-slate-600">
                {individualRecord.unit?.name || 'Unassigned Unit'}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Region & Site</span>
              <div className="font-semibold text-slate-900 mt-0.5">
                {individualRecord.region?.name || individualRecord.user.regional_assignment || 'Unassigned'}
              </div>
              <div className="text-[11px] text-slate-600">
                {individualRecord.assignment?.assigned_site || 'Regional Field Coverage'}
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Immediate Supervisor</span>
              <div className="font-semibold text-slate-900 mt-0.5">{supervisorName}</div>
              {supervisorPosition && <div className="text-[11px] text-slate-500">{supervisorPosition}</div>}
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Operational Status</span>
              <div className="font-semibold text-slate-900 mt-0.5">
                {
                  OPERATIONAL_STATUS_CONFIG[
                    individualRecord.assignment?.operational_status ||
                      (individualRecord.user.active ? 'active' : 'inactive')
                  ].label
                }
              </div>
            </div>

            <div>
              <span className="text-[10px] font-semibold uppercase text-slate-500">Last Activity Logged</span>
              <div className="font-semibold text-slate-900 mt-0.5">
                {individualRecord.lastRecordedActivityDate
                  ? formatPhilippineDate(individualRecord.lastRecordedActivityDate)
                  : 'No Data'}
              </div>
            </div>
          </div>

          {/* KPI Summary Metrics */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-2.5 p-4 bg-white border border-slate-300 rounded-lg text-center text-xs">
            <div>
              <span className="text-slate-500 font-medium text-[11px]">Tasks in Cohort</span>
              <div className="text-lg font-bold text-slate-900 mt-0.5">{individualRecord.totalAssignedTasks}</div>
            </div>
            <div>
              <span className="text-emerald-700 font-medium text-[11px]">Completed</span>
              <div className="text-lg font-bold text-emerald-800 mt-0.5">{individualRecord.completedTasksCount}</div>
            </div>
            <div>
              <span className="text-rose-700 font-medium text-[11px]">Overdue</span>
              <div className="text-lg font-bold text-rose-800 mt-0.5">{individualRecord.overdueTasksCount}</div>
            </div>
            <div>
              <span className="text-slate-600 font-medium text-[11px]">Completion Rate</span>
              <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                {individualRecord.completionRate.display}
              </div>
            </div>
            <div>
              <span className="text-slate-600 font-medium text-[11px]">On-Time Rate</span>
              <div className="text-sm font-bold text-slate-900 mt-1 font-mono">
                {individualRecord.onTimeRate.display}
              </div>
            </div>
            <div>
              <span className="text-indigo-700 font-medium text-[11px]">Recognized</span>
              <div className="text-lg font-bold text-indigo-800 mt-0.5">
                {individualRecord.recognizedInitiativesCount}
              </div>
            </div>
          </div>

          {/* Function-Specific Indicators */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              1. Role-Specific Operational Indicators
            </h2>
            <div className="grid grid-cols-3 gap-3 text-xs">
              {individualRecord.functionIndicators.map((ind) => (
                <div key={ind.label} className="p-3 border border-slate-200 rounded-lg bg-slate-50">
                  <div className="text-[11px] font-semibold text-slate-600">{ind.label}</div>
                  <div className="text-sm font-bold text-slate-900 mt-0.5">{ind.value}</div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{ind.detail}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Assigned Tasks Table */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              2. Assigned Tasks & Disposition ({individualTasks.length})
            </h2>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-semibold border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="p-2">Task Title</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Recorded Region / Site</th>
                  <th className="p-2">Due Date</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {individualTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                      No tasks recorded in this reporting window.
                    </td>
                  </tr>
                ) : (
                  individualTasks.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 font-medium text-slate-900">{t.title}</td>
                      <td className="p-2 text-slate-600">{t.category}</td>
                      <td className="p-2 text-slate-600">{t.region}</td>
                      <td className="p-2 text-slate-800">{formatPhilippineDate(t.due_date)}</td>
                      <td className="p-2 capitalize font-semibold">{t.status.replace('_', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Daily Shift Logs */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              3. Daily Shift Activities & Patrol Logs ({individualActivities.length})
            </h2>
            {individualActivities.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-1">No daily shift logs recorded in this period.</p>
            ) : (
              <div className="space-y-1.5 text-xs">
                {individualActivities.slice(0, 12).map((act) => (
                  <div key={act.id} className="p-2 border border-slate-200 rounded">
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>{act.title}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        {formatPhilippineDate(act.activity_date)} • {act.region || 'Site'}
                      </span>
                    </div>
                    <p className="text-slate-700 text-[11px] mt-0.5">{act.description}</p>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Member Initiatives */}
          <div className="space-y-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              4. Proactive Security Initiatives ({individualInitiatives.length})
            </h2>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-semibold border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="p-2">Initiative Title</th>
                  <th className="p-2">Category</th>
                  <th className="p-2">Date</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Manager Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {individualInitiatives.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                      No initiatives submitted in this period.
                    </td>
                  </tr>
                ) : (
                  individualInitiatives.map((i) => (
                    <tr key={i.id}>
                      <td className="p-2 font-medium text-slate-900">{i.title}</td>
                      <td className="p-2 text-slate-600">{i.category}</td>
                      <td className="p-2 text-slate-700">{formatPhilippineDate(i.activity_date)}</td>
                      <td className="p-2 capitalize font-semibold">{i.status.replace('_', ' ')}</td>
                      <td className="p-2 text-slate-600">{i.manager_remarks || '—'}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Sign-Off Block */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-12">
              <div>
                <span className="font-semibold block text-slate-700">Personnel Acknowledgment:</span>
                <p className="text-slate-500 text-[11px]">{individualRecord.user.display_name}</p>
              </div>
              <div className="border-t border-slate-400 pt-1 text-slate-600">
                Signature over Printed Name / Date
              </div>
            </div>

            <div className="space-y-12">
              <div>
                <span className="font-semibold block text-slate-700">Reviewed & Verified By:</span>
                <p className="text-slate-500 text-[11px]">Corporate Security Manager</p>
              </div>
              <div className="border-t border-slate-400 pt-1 text-slate-600">
                Signature over Printed Name / Date
              </div>
            </div>
          </div>

          <p className="text-[10px] text-slate-500 italic pt-2">
            Disclaimer: Operational metrics represent recorded Security Operations Hub activity and support supervisory coordination. This summary does not replace formal corporate HR evaluation records.
          </p>
        </div>
      ) : (
        /* ================================================================= */
        /* MODE B: DEPARTMENT EXECUTIVE OPERATIONS & COMPLIANCE REPORT       */
        /* ================================================================= */
        <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-6">
          {/* Document Header */}
          <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
            <div className="space-y-1">
              <div className="flex items-center space-x-2 text-slate-900">
                <Shield className="w-6 h-6 text-blue-900" />
                <span className="text-xl font-bold uppercase tracking-wider">
                  Corporate Security Operations Hub
                </span>
              </div>
              <p className="text-xs text-slate-600 font-medium">
                Regional Security Operations & Compliance Summary Report (Philippines)
              </p>
            </div>

            <div className="text-right text-xs text-slate-600">
              <div>
                <span className="font-semibold text-slate-800">Date Generated:</span>{' '}
                {formatPhilippineDateTime(new Date().toISOString())}
              </div>
              <div>
                <span className="font-semibold text-slate-800">Prepared By:</span>{' '}
                {currentUser?.display_name || 'Security Department'}
              </div>
            </div>
          </div>

          {/* Executive Summary Metrics */}
          <div className="grid grid-cols-5 gap-3 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs">
            <div>
              <span className="text-slate-500 font-medium">Total Active Tasks</span>
              <div className="text-xl font-bold text-slate-900 mt-0.5">{activeTasks.length}</div>
            </div>
            <div>
              <span className="text-rose-700 font-medium">Overdue Tasks</span>
              <div className="text-xl font-bold text-rose-800 mt-0.5">{overdueTasks.length}</div>
            </div>
            <div>
              <span className="text-emerald-700 font-medium">Completed Tasks</span>
              <div className="text-xl font-bold text-emerald-800 mt-0.5">{completedTasks.length}</div>
            </div>
            <div>
              <span className="text-blue-700 font-medium">Shift Activities</span>
              <div className="text-xl font-bold text-blue-800 mt-0.5">{activities.length}</div>
            </div>
            <div>
              <span className="text-amber-700 font-medium flex items-center justify-center space-x-1">
                <Award className="w-3 h-3 text-amber-600" />
                <span>Recognized</span>
              </span>
              <div className="text-xl font-bold text-amber-800 mt-0.5">{recognizedInitiatives.length}</div>
            </div>
          </div>

          {/* Manager-Only: Unit & Philippine Regional Summaries for Current Month */}
          {isManager && unitSummaries.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  Organizational Unit Summary ({formatPhilippineDate(fromDate)} – {formatPhilippineDate(toDate)})
                </h2>
                <table className="w-full text-left text-[11px] border border-slate-200">
                  <thead className="bg-slate-100 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-1.5">Unit</th>
                      <th className="p-1.5 text-center">Staff</th>
                      <th className="p-1.5 text-center">Done</th>
                      <th className="p-1.5">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {unitSummaries.map((u) => (
                      <tr key={u.unit.id}>
                        <td className="p-1.5 font-medium">{u.unit.name}</td>
                        <td className="p-1.5 text-center">{u.activeUsersCount}</td>
                        <td className="p-1.5 text-center">{u.completedTasksCount}</td>
                        <td className="p-1.5 font-mono">{u.completionRate.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="space-y-2">
                <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
                  Philippine Regional Performance
                </h2>
                <table className="w-full text-left text-[11px] border border-slate-200">
                  <thead className="bg-slate-100 font-semibold border-b border-slate-200">
                    <tr>
                      <th className="p-1.5">Region</th>
                      <th className="p-1.5 text-center">Done</th>
                      <th className="p-1.5 text-center">Overdue</th>
                      <th className="p-1.5">Completion</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200">
                    {regionalSummaries.map((r) => (
                      <tr key={r.region.id}>
                        <td className="p-1.5 font-medium">{r.region.name}</td>
                        <td className="p-1.5 text-center">{r.completedTasksCount}</td>
                        <td className="p-1.5 text-center">{r.overdueTasksCount}</td>
                        <td className="p-1.5 font-mono">{r.completionRate.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* Section 1: Active Tasks Roster */}
          <div className="space-y-3">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              1. Current Active Security Tasks & Assignments
            </h2>
            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-semibold border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="p-2">Task</th>
                  <th className="p-2">Assigned Personnel</th>
                  <th className="p-2">Facility / Site</th>
                  <th className="p-2">Due Date</th>
                  <th className="p-2">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {activeTasks.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                      No active tasks currently pending.
                    </td>
                  </tr>
                ) : (
                  activeTasks.map((t) => (
                    <tr key={t.id}>
                      <td className="p-2 font-medium text-slate-900">{t.title}</td>
                      <td className="p-2 text-slate-700">{t.assigned_user_name}</td>
                      <td className="p-2 text-slate-600">{t.region}</td>
                      <td className="p-2 text-slate-800 font-medium">{formatPhilippineDate(t.due_date)}</td>
                      <td className="p-2 capitalize font-semibold">{t.status.replace('_', ' ')}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {/* Section 2: Recent Shift Activities */}
          <div className="space-y-3 pt-2">
            <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
              2. Shift Accomplishments & Daily Log Summary
            </h2>
            <div className="space-y-2 text-xs">
              {activities.length === 0 ? (
                <p className="text-slate-400 italic py-2">No shift activities recorded.</p>
              ) : (
                activities.slice(0, 8).map((act) => (
                  <div key={act.id} className="p-2.5 border border-slate-200 rounded text-xs space-y-1">
                    <div className="flex justify-between font-semibold text-slate-900">
                      <span>{act.title}</span>
                      <span className="text-[11px] font-normal text-slate-500">
                        {formatPhilippineDate(act.activity_date)} • {act.region || 'Site'}
                      </span>
                    </div>
                    <p className="text-slate-700">{act.description}</p>
                    <div className="text-[10px] text-slate-500">Logged by {act.author_name}</div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Section 3: Recognized Member Security Initiatives */}
          <div className="space-y-3 pt-2">
            <div className="flex items-center justify-between border-b border-slate-300 pb-1">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 flex items-center space-x-1.5">
                <Award className="w-4 h-4 text-amber-600 print:text-slate-900" />
                <span>3. Recognized Member Security Initiatives & Proactive Checks</span>
              </h2>
              <span className="text-[10px] text-slate-500">Manager-Validated Non-Assigned Contributions</span>
            </div>

            <table className="w-full text-left text-xs border border-slate-200">
              <thead className="bg-slate-100 font-semibold border-b border-slate-200 text-slate-700">
                <tr>
                  <th className="p-2">Initiative Title & Category</th>
                  <th className="p-2">Initiated By</th>
                  <th className="p-2">Facility / Site</th>
                  <th className="p-2">Date Recognized</th>
                  <th className="p-2">Manager Validation & Commendation</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {recognizedInitiatives.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                      No member initiatives currently recognized in this period.
                    </td>
                  </tr>
                ) : (
                  recognizedInitiatives.map((init) => (
                    <tr key={init.id}>
                      <td className="p-2">
                        <div className="font-semibold text-slate-900">{init.title}</div>
                        <div className="text-[10px] text-amber-700">{init.category}</div>
                      </td>
                      <td className="p-2 text-slate-700">
                        <div className="font-medium">{init.submitted_by_name || 'Security Personnel'}</div>
                        <div className="text-[10px] text-slate-500">Security Team Member</div>
                      </td>
                      <td className="p-2 text-slate-600">
                        <div>{init.region}</div>
                        {init.location && <div className="text-[10px] text-slate-500">{init.location}</div>}
                      </td>
                      <td className="p-2 text-slate-800 font-medium">
                        {init.recognized_at
                          ? formatPhilippineDate(init.recognized_at)
                          : formatPhilippineDate(init.created_at)}
                      </td>
                      <td className="p-2 text-slate-700">
                        <div className="font-medium text-emerald-800">
                          Validated by {init.reviewed_by_name || 'Security Manager'}
                        </div>
                        {init.manager_remarks && (
                          <div className="text-[11px] italic text-slate-600 mt-0.5">
                            &ldquo;{init.manager_remarks}&rdquo;
                          </div>
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
            <p className="text-[10px] text-slate-500 italic">
              * Note: Administrative recognition reflects initiative and vigilance. Proactive checks comply with corporate SOP and do not substitute statutory permits.
            </p>
          </div>

          {/* Section 4: Manager Sign-Off Block */}
          <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
            <div className="space-y-12">
              <div>
                <span className="font-semibold block text-slate-700">Prepared & Filed By:</span>
                <p className="text-slate-500 text-[11px]">Authorized Security Supervisor / Lead</p>
              </div>
              <div className="border-t border-slate-400 pt-1 text-slate-600">
                Signature over Printed Name / Date
              </div>
            </div>

            <div className="space-y-12">
              <div>
                <span className="font-semibold block text-slate-700">Reviewed & Approved By:</span>
                <p className="text-slate-500 text-[11px]">Corporate Security Manager</p>
              </div>
              <div className="border-t border-slate-400 pt-1 text-slate-600">
                Signature over Printed Name / Date
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
