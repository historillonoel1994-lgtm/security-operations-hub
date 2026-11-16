import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  PersonnelPerformanceRecord,
  Task,
  MemberInitiative,
  DateRangePreset,
} from '../types/index.ts';
import {
  formatPhilippineDate,
  formatPhilippineDateTime,
  getDueStatusLabel,
} from '../lib/dateUtils.ts';
import { TASK_STATUS_CONFIG } from '../lib/philippinesRegions.ts';
import { INITIATIVE_STATUS_CONFIG } from '../lib/initiativeConstants.ts';
import { OPERATIONAL_STATUS_CONFIG } from '../lib/orgDefaults.ts';
import {
  computePersonnelPerformance,
  computeMonthlyTrendBuckets,
  getDateRangeForPreset,
} from '../lib/performanceUtils.ts';
import {
  X,
  User,
  Mail,
  Building2,
  MapPin,
  GitBranch,
  CheckSquare,
  CalendarCheck,
  Lightbulb,
  Award,
  AlertTriangle,
  RotateCcw,
  Clock,
  Plus,
  Printer,
  Edit3,
  History,
  MessageSquare,
  Info,
  TrendingUp,
} from 'lucide-react';

interface PersonnelPerformanceModalProps {
  userId: string | null;
  isOpen: boolean;
  onClose: () => void;
  onAssignTask: (userId: string) => void;
  onEditAssignment: (userId: string) => void;
  onSelectTask: (task: Task) => void;
  onSelectInitiative: (initiative: MemberInitiative) => void;
  onOpenPrintIndividualReport: (userId: string, fromDate: string, toDate: string) => void;
}

type DetailTab = 'overview' | 'tasks' | 'updates' | 'activities' | 'initiatives' | 'history';

export const PersonnelPerformanceModal: React.FC<PersonnelPerformanceModalProps> = ({
  userId,
  isOpen,
  onClose,
  onAssignTask,
  onEditAssignment,
  onSelectTask,
  onSelectInitiative,
  onOpenPrintIndividualReport,
}) => {
  const { isManager, allProfiles } = useAuth();
  const {
    allDepartmentTasks,
    taskUpdates,
    activities,
    allDepartmentInitiatives,
    initiativeHistory,
    organizationalUnits,
    positions,
    operatingRegions,
    assignmentsByUserId,
    reportingHistory,
    performanceTargets,
    lastUpdatedAt,
  } = useData();

  const [detailTab, setDetailTab] = useState<DetailTab>('overview');
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => getDateRangeForPreset('month').fromDate);
  const [customTo, setCustomTo] = useState<string>(() => getDateRangeForPreset('month').toDate);

  const { fromDate, toDate } = useMemo(() => {
    if (preset === 'custom') return { fromDate: customFrom, toDate: customTo };
    return getDateRangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const targetUser = useMemo(
    () => (userId ? allProfiles.find((p) => p.id === userId) || null : null),
    [userId, allProfiles]
  );

  const profilesById = useMemo(() => {
    const map: Record<string, typeof allProfiles[number]> = {};
    for (const p of allProfiles) map[p.id] = p;
    return map;
  }, [allProfiles]);

  const record: PersonnelPerformanceRecord | null = useMemo(() => {
    if (!targetUser) return null;
    return computePersonnelPerformance({
      user: targetUser,
      assignment: assignmentsByUserId[targetUser.id] || null,
      units: organizationalUnits,
      positions,
      regions: operatingRegions,
      profilesById,
      assignmentsById: assignmentsByUserId,
      tasks: allDepartmentTasks,
      taskUpdates,
      activities,
      initiatives: allDepartmentInitiatives,
      initiativeHistory,
      performanceTargets,
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
    allDepartmentTasks,
    taskUpdates,
    activities,
    allDepartmentInitiatives,
    initiativeHistory,
    performanceTargets,
    fromDate,
    toDate,
  ]);

  const userTasks = useMemo(
    () => (userId ? allDepartmentTasks.filter((t) => t.assigned_to === userId) : []),
    [userId, allDepartmentTasks]
  );

  const userActivities = useMemo(
    () => (userId ? activities.filter((a) => a.author_id === userId) : []),
    [userId, activities]
  );

  const userInitiatives = useMemo(
    () =>
      userId
        ? allDepartmentInitiatives.filter((i) => i.submitted_by === userId && i.status !== 'draft')
        : [],
    [userId, allDepartmentInitiatives]
  );

  const userTaskUpdates = useMemo(() => {
    if (!userId) return [];
    const list: { task: Task; update: typeof taskUpdates[string][number] }[] = [];
    for (const t of userTasks) {
      for (const upd of taskUpdates[t.id] || []) {
        list.push({ task: t, update: upd });
      }
    }
    return list.sort((a, b) => b.update.created_at.localeCompare(a.update.created_at));
  }, [userId, userTasks, taskUpdates]);

  const userReportingHistory = useMemo(
    () => (userId ? reportingHistory.filter((h) => h.profile_user_id === userId) : []),
    [userId, reportingHistory]
  );

  const monthlyTrends = useMemo(
    () =>
      computeMonthlyTrendBuckets({
        tasks: userTasks,
        initiatives: userInitiatives,
        monthsCount: 4,
      }),
    [userTasks, userInitiatives]
  );

  if (!isOpen || !isManager || !targetUser || !record) return null;

  const opStatus = record.assignment?.operational_status || (targetUser.active ? 'active' : 'inactive');
  const opBadge = OPERATIONAL_STATUS_CONFIG[opStatus] || OPERATIONAL_STATUS_CONFIG.active;

  const pendingTasks = userTasks.filter((t) => t.status !== 'completed');
  const overdueTasks = pendingTasks.filter((t) => getDueStatusLabel(t.due_date, t.status).isOverdue);
  const returnedTasks = userTasks.filter((t) => t.status === 'returned');
  const completedTasks = userTasks.filter((t) => t.status === 'completed');
  const recognizedInitiatives = userInitiatives.filter((i) => i.status === 'recognized');
  const managerComments = userTaskUpdates.filter(
    (x) => x.update.author_role === 'manager' || Boolean(x.update.manager_feedback)
  );

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl max-w-5xl w-full max-h-[94vh] flex flex-col overflow-hidden border border-slate-200">
        {/* Top Header */}
        <div className="px-6 py-4 bg-slate-900 text-white flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-start space-x-3">
            <div className="w-11 h-11 rounded-full bg-blue-600 flex items-center justify-center font-bold text-lg text-white flex-shrink-0">
              {targetUser.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">{targetUser.display_name}</h2>
                <span className="text-[10px] px-2 py-0.5 rounded-full bg-blue-950 text-blue-200 border border-blue-700 font-semibold uppercase">
                  {targetUser.role === 'manager' ? 'Security Manager' : 'Team Member'}
                </span>
                <span
                  className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${
                    targetUser.approved
                      ? 'bg-emerald-950/70 text-emerald-200 border-emerald-700'
                      : 'bg-amber-950/70 text-amber-200 border-amber-700'
                  }`}
                >
                  {targetUser.approved ? 'Approved Account' : 'Pending Approval'}
                </span>
                <span className={`text-[10px] px-2 py-0.5 rounded-full border font-semibold ${opBadge.badgeClass}`}>
                  {opBadge.label}
                </span>
              </div>
              <div className="text-xs text-slate-300 flex flex-wrap items-center gap-x-3 gap-y-1 mt-0.5">
                <span className="flex items-center space-x-1 font-mono">
                  <Mail className="w-3 h-3 text-slate-400" />
                  <span>{targetUser.email}</span>
                </span>
                <span className="text-slate-500">•</span>
                <span className="font-mono text-[10px] text-slate-300 select-all">
                  UUID: {targetUser.id}
                </span>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => {
                onClose();
                onAssignTask(targetUser.id);
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg flex items-center space-x-1 transition cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Assign Task</span>
            </button>
            <button
              type="button"
              onClick={() => {
                onClose();
                onEditAssignment(targetUser.id);
              }}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1 transition cursor-pointer"
            >
              <Edit3 className="w-3.5 h-3.5" />
              <span>Edit Org / Supervisor</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenPrintIndividualReport(targetUser.id, fromDate, toDate)}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold rounded-lg border border-slate-700 flex items-center space-x-1 transition cursor-pointer"
            >
              <Printer className="w-3.5 h-3.5 text-blue-300" />
              <span>Performance Report</span>
            </button>
            <button
              type="button"
              onClick={onClose}
              className="text-slate-400 hover:text-white p-1 rounded-md transition"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Org Line & Date Filter Strip */}
        <div className="px-6 py-3 bg-slate-50 border-b border-slate-200 flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-slate-700">
            <span className="flex items-center space-x-1.5">
              <Building2 className="w-3.5 h-3.5 text-blue-600" />
              <span>
                <strong>Unit:</strong> {record.unit?.name || 'Unassigned Unit'}
              </span>
            </span>
            <span className="flex items-center space-x-1.5">
              <User className="w-3.5 h-3.5 text-indigo-600" />
              <span>
                <strong>Position:</strong> {record.position?.title || 'Unassigned Position'}
              </span>
            </span>
            <span className="flex items-center space-x-1.5">
              <MapPin className="w-3.5 h-3.5 text-emerald-600" />
              <span>
                <strong>Region / Site:</strong>{' '}
                {record.region?.name || targetUser.regional_assignment || 'Not Set'}
                {record.assignment?.assigned_site ? ` (${record.assignment.assigned_site})` : ''}
              </span>
            </span>
            <span className="flex items-center space-x-1.5">
              <GitBranch className="w-3.5 h-3.5 text-amber-600" />
              <span>
                <strong>Reports To:</strong>{' '}
                {record.supervisor ? `${record.supervisor.name} (${record.supervisor.positionTitle})` : 'Top Level / Direct'}
              </span>
            </span>
          </div>

          {/* Period Filter */}
          <div className="flex flex-wrap items-center gap-1.5">
            {(['today', 'week', 'month', 'quarter', 'custom'] as DateRangePreset[]).map((p) => (
              <button
                key={p}
                type="button"
                onClick={() => setPreset(p)}
                className={`px-2 py-1 rounded text-[11px] font-semibold capitalize transition cursor-pointer ${
                  preset === p
                    ? 'bg-blue-700 text-white'
                    : 'bg-white border border-slate-300 text-slate-600 hover:bg-slate-100'
                }`}
              >
                {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'quarter' ? 'This Quarter' : p}
              </button>
            ))}
            {preset === 'custom' && (
              <div className="flex items-center space-x-1 ml-1">
                <input
                  type="date"
                  value={customFrom}
                  onChange={(e) => setCustomFrom(e.target.value)}
                  className="px-1.5 py-0.5 border border-slate-300 rounded text-[11px]"
                />
                <span>-</span>
                <input
                  type="date"
                  value={customTo}
                  onChange={(e) => setCustomTo(e.target.value)}
                  className="px-1.5 py-0.5 border border-slate-300 rounded text-[11px]"
                />
              </div>
            )}
          </div>
        </div>

        {/* Sub-Navigation Tabs + Quick Buttons */}
        <div className="px-6 border-b border-slate-200 bg-white flex items-center space-x-2 overflow-x-auto text-xs">
          {[
            { id: 'overview', label: 'Overview & Trends', icon: TrendingUp },
            { id: 'tasks', label: `Task History (${userTasks.length})`, icon: CheckSquare },
            { id: 'updates', label: `Progress & Feedback (${userTaskUpdates.length})`, icon: MessageSquare },
            { id: 'activities', label: `Daily Activities (${userActivities.length})`, icon: CalendarCheck },
            { id: 'initiatives', label: `Initiatives (${userInitiatives.length})`, icon: Lightbulb },
            { id: 'history', label: `Reporting Line History (${userReportingHistory.length})`, icon: History },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = detailTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setDetailTab(tab.id as DetailTab)}
                className={`py-2.5 px-3 font-semibold border-b-2 transition flex items-center space-x-1.5 whitespace-nowrap cursor-pointer ${
                  active
                    ? 'border-blue-700 text-blue-800'
                    : 'border-transparent text-slate-500 hover:text-slate-800'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{tab.label}</span>
              </button>
            );
          })}
        </div>

        {/* Scrollable Body */}
        <div className="p-6 overflow-y-auto space-y-5 flex-1 text-xs">
          {/* Empty Data / Newly Registered Protection */}
          {!record.hasAnyHistory && (
            <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-3 text-slate-700">
              <Info className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-slate-900">No Operational History Recorded Yet</div>
                <p className="text-slate-600 mt-0.5">
                  This personnel account currently has no assigned tasks, shift activities, or submitted initiatives. Indicators display <strong>N/A</strong> rather than assigning zero or negative scores.
                </p>
              </div>
            </div>
          )}

          {/* TAB 1: OVERVIEW & TRENDS */}
          {detailTab === 'overview' && (
            <div className="space-y-5">
              {/* KPI Grid with Operational Index & Numerator/Denominator */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
                <div className="p-3.5 bg-blue-50/70 border border-blue-200 rounded-xl">
                  <span className="text-[10px] font-bold text-blue-800 uppercase">Operational Index</span>
                  <div className="text-lg font-bold text-blue-950 mt-1 font-mono">
                    {record.operationalIndex.display}
                  </div>
                  <span className="text-[10px] text-blue-700">Non-appraisal weighted</span>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-slate-500 uppercase">Task Completion</span>
                  <div className="text-lg font-bold text-slate-900 mt-1 font-mono">{record.completionRate.display}</div>
                  <span className="text-[10px] text-slate-400">Completed / period cohort</span>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-emerald-700 uppercase">On-Time SLA</span>
                  <div className="text-lg font-bold text-emerald-900 mt-1 font-mono">{record.onTimeRate.display}</div>
                  <span className="text-[10px] text-slate-400">Closed ≤ due date (PHT)</span>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl">
                  <span className="text-[10px] font-semibold text-rose-700 uppercase">Curr. Overdue / Ret.</span>
                  <div className="text-lg font-bold text-rose-800 mt-1">
                    {record.overdueTasksCount} Overdue • {record.returnedTasksCount} Ret.
                  </div>
                  <span className="text-[10px] text-slate-400">
                    Open total: {record.allOpenTasksCount} task(s)
                  </span>
                </div>
                <div className="p-3.5 bg-white border border-slate-200 rounded-xl col-span-2 sm:col-span-1">
                  <span className="text-[10px] font-semibold text-amber-700 uppercase flex items-center space-x-1">
                    <Award className="w-3.5 h-3.5" />
                    <span>Recognized Init.</span>
                  </span>
                  <div className="text-lg font-bold text-amber-900 mt-1">{record.recognizedInitiativesCount}</div>
                  <span className="text-[10px] text-slate-400">Daily Logs: {record.activitiesCount}</span>
                </div>
              </div>

              {/* Overdue Cohort Reconciliation Strip */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 p-3 bg-slate-50 border border-slate-200 rounded-xl text-[11px]">
                <div>
                  <span className="text-slate-500 block">Currently Overdue (All Open)</span>
                  <strong className="text-rose-800">{record.overdueTasksCount} task(s)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Became Overdue in Period</span>
                  <strong className="text-slate-900">{record.becameOverdueInPeriodCount} task(s)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Historical Overdue (Prior)</span>
                  <strong className="text-slate-900">{record.historicalOverdueCount} task(s)</strong>
                </div>
                <div>
                  <span className="text-slate-500 block">Completed Late in Period</span>
                  <strong className="text-slate-900">{record.completedLateInPeriodCount} task(s)</strong>
                </div>
              </div>

              {/* Function-Specific Indicators */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    Function-Specific Operational Indicators ({record.position?.title || 'Security Role'})
                  </h3>
                  <span className="text-[10px] text-slate-500">Non-punitive operational context</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {record.functionIndicators.map((ind) => (
                    <div key={ind.label} className="p-3 bg-white border border-slate-200 rounded-lg">
                      <div className="text-[11px] text-slate-500 font-medium">{ind.label}</div>
                      <div className="text-base font-bold text-blue-900 mt-0.5">{ind.value}</div>
                      <div className="text-[10px] text-slate-400 mt-0.5">{ind.detail}</div>
                    </div>
                  ))}
                </div>
              </div>

              {/* KPI Formula & Source Records Transparency */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-1">
                  <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                    KPI Calculation Formulas, Weights & Source Records
                  </h3>
                  <span className="text-[10px] text-slate-500">
                    Target Profile:{' '}
                    <strong>
                      {record.appliedTarget
                        ? positions.find((p) => p.id === record.appliedTarget?.position_id)?.title ||
                          organizationalUnits.find((u) => u.id === record.appliedTarget?.unit_id)?.name ||
                          record.appliedTarget.notes?.split(':')[0] ||
                          'Standard Profile'
                        : 'Standard Profile'}
                    </strong>{' '}
                    • Synced {formatPhilippineDateTime(lastUpdatedAt)}
                  </span>
                </div>
                <div className="overflow-x-auto border border-slate-200 rounded-lg">
                  <table className="w-full text-left text-[11px]">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-2">Indicator</th>
                        <th className="p-2">Formula</th>
                        <th className="p-2 text-center">Weight</th>
                        <th className="p-2 text-center">Num / Den</th>
                        <th className="p-2">Value</th>
                        <th className="p-2">Source Record Set</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {record.kpiBreakdowns.map((b) => (
                        <tr key={b.metric}>
                          <td className="p-2 font-semibold text-slate-900">{b.metric}</td>
                          <td className="p-2 text-slate-600">{b.formula}</td>
                          <td className="p-2 text-center font-mono text-slate-700">{b.weightPercent}%</td>
                          <td className="p-2 text-center font-mono text-slate-700">
                            {b.numerator}/{b.denominator}
                          </td>
                          <td className="p-2 font-mono font-bold text-blue-900">{b.valueDisplay}</td>
                          <td className="p-2 text-slate-500 font-mono text-[10px]">{b.sourceRecordSet}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                <p className="text-[10px] text-slate-500">
                  {record.operationalIndex.formulaDescription}
                </p>
              </div>

              {/* Monthly Trend Chart */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-3">
                <h3 className="font-bold text-slate-900 text-xs uppercase tracking-wider">
                  Monthly Performance Trend (Last 4 Months, PHT)
                </h3>
                <div className="grid grid-cols-4 gap-3">
                  {monthlyTrends.map((b) => {
                    const maxVal = Math.max(
                      1,
                      ...monthlyTrends.map((x) =>
                        Math.max(x.completedTasks, x.overdueTasks, x.recognizedInitiatives)
                      )
                    );
                    return (
                      <div key={b.monthKey} className="p-3 bg-slate-50 rounded-lg border border-slate-200 space-y-2">
                        <div className="font-bold text-slate-800 text-center">{b.label}</div>
                        <div className="space-y-1.5 text-[11px]">
                          <div>
                            <div className="flex justify-between text-emerald-800">
                              <span>Completed</span>
                              <span className="font-bold">{b.completedTasks}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-emerald-600 h-full"
                                style={{ width: `${(b.completedTasks / maxVal) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-rose-700">
                              <span>Overdue</span>
                              <span className="font-bold">{b.overdueTasks}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-rose-600 h-full"
                                style={{ width: `${(b.overdueTasks / maxVal) * 100}%` }}
                              />
                            </div>
                          </div>
                          <div>
                            <div className="flex justify-between text-amber-800">
                              <span>Recognized</span>
                              <span className="font-bold">{b.recognizedInitiatives}</span>
                            </div>
                            <div className="w-full bg-slate-200 h-1.5 rounded-full overflow-hidden">
                              <div
                                className="bg-amber-500 h-full"
                                style={{ width: `${(b.recognizedInitiatives / maxVal) * 100}%` }}
                              />
                            </div>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Latest Manager Comments & Quick Buttons */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 uppercase text-[11px]">
                      Pending & Overdue Assignments ({pendingTasks.length})
                    </h4>
                    <button
                      type="button"
                      onClick={() => setDetailTab('tasks')}
                      className="text-blue-700 hover:underline font-semibold text-[11px] cursor-pointer"
                    >
                      View Task History →
                    </button>
                  </div>
                  {pendingTasks.length === 0 ? (
                    <p className="text-slate-400 italic py-2">No Current Tasks pending.</p>
                  ) : (
                    <div className="space-y-2">
                      {pendingTasks.slice(0, 4).map((t) => {
                        const dueInfo = getDueStatusLabel(t.due_date, t.status);
                        return (
                          <div
                            key={t.id}
                            onClick={() => onSelectTask(t)}
                            className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
                          >
                            <div className="truncate pr-2">
                              <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                              <div className="text-[10px] text-slate-500">
                                {t.region} • Due {formatPhilippineDate(t.due_date)}
                              </div>
                            </div>
                            <span
                              className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                                dueInfo.isOverdue
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'bg-blue-50 text-blue-700'
                              }`}
                            >
                              {dueInfo.isOverdue ? dueInfo.label : t.status.replace('_', ' ')}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                <div className="bg-white border border-slate-200 rounded-xl p-4 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <h4 className="font-bold text-slate-800 uppercase text-[11px]">
                      Recent Manager Comments & Follow-Ups
                    </h4>
                    <button
                      type="button"
                      onClick={() => setDetailTab('updates')}
                      className="text-blue-700 hover:underline font-semibold text-[11px] cursor-pointer"
                    >
                      View All Updates →
                    </button>
                  </div>
                  {managerComments.length === 0 ? (
                    <p className="text-slate-400 italic py-2">No manager review notes recorded yet.</p>
                  ) : (
                    <div className="space-y-2">
                      {managerComments.slice(0, 4).map(({ task, update }) => (
                        <div key={update.id} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg">
                          <div className="font-semibold text-slate-900 truncate">{task.title}</div>
                          <p className="text-[11px] text-slate-700 mt-0.5">
                            {update.manager_feedback || update.progress_note}
                          </p>
                          <div className="text-[10px] text-slate-400 mt-0.5">
                            {formatPhilippineDateTime(update.created_at)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: TASKS & COMPLETION HISTORY */}
          {detailTab === 'tasks' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">
                  Assigned Tasks & Completion History ({userTasks.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  Read-only historical record • Completed: {completedTasks.length}
                </span>
              </div>
              {userTasks.length === 0 ? (
                <p className="text-slate-400 italic py-6 text-center">No Current Tasks assigned to this user.</p>
              ) : (
                <div className="overflow-x-auto border border-slate-200 rounded-xl">
                  <table className="w-full text-left text-xs">
                    <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                      <tr>
                        <th className="p-3">Task</th>
                        <th className="p-3">Region / Site</th>
                        <th className="p-3">Due Date (PHT)</th>
                        <th className="p-3">Status</th>
                        <th className="p-3">Completed At</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {userTasks.map((t) => {
                        const cfg = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.assigned;
                        const dueInfo = getDueStatusLabel(t.due_date, t.status);
                        return (
                          <tr
                            key={t.id}
                            onClick={() => onSelectTask(t)}
                            className="hover:bg-slate-50 cursor-pointer"
                          >
                            <td className="p-3">
                              <div className="font-semibold text-slate-900">{t.title}</div>
                              <div className="text-[10px] text-slate-500">{t.category}</div>
                            </td>
                            <td className="p-3 text-slate-700">{t.region}</td>
                            <td className="p-3">
                              <div className="font-medium text-slate-900">{formatPhilippineDate(t.due_date)}</div>
                              {dueInfo.isOverdue && (
                                <span className="text-[10px] font-bold text-rose-700">{dueInfo.label}</span>
                              )}
                            </td>
                            <td className="p-3">
                              <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}>
                                {cfg.label}
                              </span>
                            </td>
                            <td className="p-3 text-slate-600">
                              {t.completed_at ? formatPhilippineDateTime(t.completed_at) : '—'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {/* TAB 3: PROGRESS UPDATES & MANAGER COMMENTS */}
          {detailTab === 'updates' && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900">
                Chronological Progress Updates & Manager Comments ({userTaskUpdates.length})
              </h3>
              {userTaskUpdates.length === 0 ? (
                <p className="text-slate-400 italic py-6 text-center">No task progress updates recorded.</p>
              ) : (
                <div className="space-y-2.5">
                  {userTaskUpdates.map(({ task, update }) => (
                    <div key={update.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-slate-900">
                          {task.title}{' '}
                          <span className="text-[10px] font-normal text-slate-500">
                            • by {update.author_name} ({update.author_role})
                          </span>
                        </span>
                        <span className="text-[10px] text-slate-500">
                          {formatPhilippineDateTime(update.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-700 whitespace-pre-wrap">{update.progress_note}</p>
                      {update.manager_feedback && (
                        <div className="p-2 bg-amber-50 border border-amber-200 rounded text-[11px] text-amber-900 mt-1">
                          <strong>Manager Feedback:</strong> {update.manager_feedback}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 4: DAILY ACTIVITIES */}
          {detailTab === 'activities' && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900">
                Daily Activity Submission History ({userActivities.length})
              </h3>
              {userActivities.length === 0 ? (
                <p className="text-slate-400 italic py-6 text-center">No daily activities logged yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {userActivities.map((act) => (
                    <div key={act.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{act.title}</span>
                        <span className="text-[11px] font-normal text-slate-500">
                          {formatPhilippineDate(act.activity_date)} • {act.region || 'Site'}
                        </span>
                      </div>
                      <p className="text-slate-700">{act.description}</p>
                      {act.linked_task_title && (
                        <div className="text-[10px] text-blue-700 font-medium">
                          Linked Task: {act.linked_task_title}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* TAB 5: MEMBER INITIATIVES */}
          {detailTab === 'initiatives' && (
            <div className="space-y-3">
              <h3 className="font-bold text-slate-900">
                Submitted & Recognized Member Initiatives ({userInitiatives.length})
              </h3>
              {userInitiatives.length === 0 ? (
                <p className="text-slate-400 italic py-6 text-center">No member initiatives submitted yet.</p>
              ) : (
                <div className="space-y-2.5">
                  {userInitiatives.map((init) => {
                    const stCfg = INITIATIVE_STATUS_CONFIG[init.status] || INITIATIVE_STATUS_CONFIG.pending_review;
                    return (
                      <div
                        key={init.id}
                        onClick={() => onSelectInitiative(init)}
                        className="p-3.5 bg-white border border-slate-200 rounded-xl hover:border-blue-400 cursor-pointer space-y-1"
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-bold text-slate-900">{init.title}</span>
                          <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${stCfg.badgeClass}`}>
                            {stCfg.label}
                          </span>
                        </div>
                        <div className="text-[11px] text-slate-500">
                          {init.category} • {init.region} • Activity Date: {formatPhilippineDate(init.activity_date)}
                        </div>
                        <p className="text-slate-700 line-clamp-2">{init.expected_outcome}</p>
                        {init.manager_remarks && (
                          <div className="text-[11px] text-emerald-800 bg-emerald-50 px-2 py-1 rounded border border-emerald-200">
                            Manager Commendation / Remarks: {init.manager_remarks}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          )}

          {/* TAB 6: REPORTING LINE & TRANSFER HISTORY */}
          {detailTab === 'history' && (
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900">
                  Organizational Reporting & Reassignment History ({userReportingHistory.length})
                </h3>
                <span className="text-[11px] text-slate-500">
                  Immutable audit trail preserving historical regional attribution
                </span>
              </div>
              {userReportingHistory.length === 0 ? (
                <p className="text-slate-400 italic py-6 text-center">
                  No organizational reassignment events logged yet.
                </p>
              ) : (
                <div className="space-y-2.5">
                  {userReportingHistory.map((h) => (
                    <div key={h.id} className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="font-semibold text-slate-900">
                          Effective {formatPhilippineDate(h.effective_date)}
                        </span>
                        <span className="text-[10px] text-slate-500">
                          Updated by {h.changed_by_name || 'Security Manager'} on{' '}
                          {formatPhilippineDateTime(h.created_at)}
                        </span>
                      </div>
                      <p className="text-slate-700">
                        <strong>Reason:</strong> {h.change_reason}
                      </p>
                      <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-4 gap-y-1">
                        <span>
                          Unit: {h.previous_unit_id || '—'} → <strong>{h.new_unit_id || '—'}</strong>
                        </span>
                        <span>
                          Region: {h.previous_region_id || '—'} → <strong>{h.new_region_id || '—'}</strong>
                        </span>
                        <span>
                          Site: {h.previous_assigned_site || '—'} → <strong>{h.new_assigned_site || '—'}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-[11px] text-slate-500">
          <span>
            Historical records are preserved read-only for corporate accountability. No automated disciplinary ratings are generated.
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-white border border-slate-300 text-slate-700 font-semibold rounded-lg hover:bg-slate-100 transition cursor-pointer"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
};
