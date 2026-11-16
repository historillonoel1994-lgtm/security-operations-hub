import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  Task,
  MemberInitiative,
  DateRangePreset,
  RegionalPerformanceSummary,
} from '../types/index.ts';
import {
  TASK_STATUS_CONFIG,
  PHILIPPINE_REGIONS,
} from '../lib/philippinesRegions.ts';
import {
  formatPhilippineDate,
  formatPhilippineDateTime,
  getDueStatusLabel,
  getPhilippineToday,
} from '../lib/dateUtils.ts';
import {
  computePersonnelPerformance,
  computeUnitPerformanceSummaries,
  computeRegionalPerformanceSummaries,
  computeConsolidatedRegionRollups,
  computeDepartmentReconciledMetrics,
  computeMonthlyTrendBuckets,
  getDateRangeForPreset,
} from '../lib/performanceUtils.ts';
import { resolveOperatingRegionId } from '../lib/orgDefaults.ts';
import {
  CheckSquare,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Plus,
  Search,
  Eye,
  Calendar,
  Award,
  Lightbulb,
  Users,
  UserCheck,
  UserX,
  RefreshCw,
  TrendingUp,
  Clock,
  Building2,
  MapPin,
  ShieldAlert,
  FileSearch,
  Shield,
  ClipboardCheck,
  X,
  ArrowRight,
  Layers,
} from 'lucide-react';

interface DashboardViewProps {
  onCreateTask: () => void;
  onSelectTask: (task: Task) => void;
  onNavigateToTasks: (statusFilter?: string) => void;
  onNavigateToInitiatives?: () => void;
  onSelectInitiative?: (initiative: MemberInitiative) => void;
  onNavigateToPersonnel?: () => void;
  onNavigateToMyPerformance?: () => void;
  onOpenApprovals?: () => void;
  onViewPersonnelPerformance?: (userId: string) => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onCreateTask,
  onSelectTask,
  onNavigateToTasks,
  onNavigateToInitiatives,
  onSelectInitiative,
  onNavigateToPersonnel,
  onNavigateToMyPerformance,
  onOpenApprovals,
  onViewPersonnelPerformance,
}) => {
  const { currentUser, isManager, allProfiles } = useAuth();
  const {
    tasks,
    allDepartmentTasks,
    taskUpdates,
    activities,
    summary,
    initiatives,
    allDepartmentInitiatives,
    initiativeHistory,
    initiativeSummary,
    organizationalUnits,
    positions,
    operatingRegions,
    assignmentsByUserId,
    performanceTargets,
    lastUpdatedAt,
    realtimeStatus,
    dataError,
    refreshData,
  } = useData();

  // Manager Date Filter State (preserved on Refresh)
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => getDateRangeForPreset('month').fromDate);
  const [customTo, setCustomTo] = useState<string>(() => getDateRangeForPreset('month').toDate);
  const [refreshing, setRefreshing] = useState(false);

  // Region Drill-Down Modal State
  const [drillRegionSummary, setDrillRegionSummary] = useState<RegionalPerformanceSummary | null>(
    null
  );

  const { fromDate, toDate } = useMemo(() => {
    if (preset === 'custom') return { fromDate: customFrom, toDate: customTo };
    return getDateRangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  // Task Search & Filter State (preserved on Refresh)
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const profilesById = useMemo(() => {
    const map: Record<string, typeof allProfiles[number]> = {};
    for (const p of allProfiles) map[p.id] = p;
    return map;
  }, [allProfiles]);

  // Canonical Department Reconciled Metrics (Zero-Discrepancy across Cards, Overdue, Units, Regions)
  const managerCommandMetrics = useMemo(() => {
    if (!isManager) return null;
    return computeDepartmentReconciledMetrics({
      allProfiles,
      allDepartmentTasks,
      allDepartmentInitiatives,
      fromDate,
      toDate,
    });
  }, [isManager, allProfiles, allDepartmentTasks, allDepartmentInitiatives, fromDate, toDate]);

  // Personnel Performance Records
  const personnelRecords = useMemo(() => {
    if (!isManager) return [];
    return allProfiles.map((user) =>
      computePersonnelPerformance({
        user,
        assignment: assignmentsByUserId[user.id] || null,
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
      })
    );
  }, [
    isManager,
    allProfiles,
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

  const unitSummaries = useMemo(() => {
    if (!isManager) return [];
    return computeUnitPerformanceSummaries({
      units: organizationalUnits,
      personnelRecords,
    });
  }, [isManager, organizationalUnits, personnelRecords]);

  const regionalSummaries = useMemo(() => {
    if (!isManager) return [];
    return computeRegionalPerformanceSummaries({
      regions: operatingRegions,
      personnelRecords,
      tasks: allDepartmentTasks,
      taskUpdates,
      activities,
      initiatives: allDepartmentInitiatives,
      fromDate,
      toDate,
    });
  }, [
    isManager,
    operatingRegions,
    personnelRecords,
    allDepartmentTasks,
    taskUpdates,
    activities,
    allDepartmentInitiatives,
    fromDate,
    toDate,
  ]);

  const consolidatedRollups = useMemo(() => {
    if (!isManager) return null;
    return computeConsolidatedRegionRollups(regionalSummaries);
  }, [isManager, regionalSummaries]);

  const monthlyTrends = useMemo(() => {
    if (!isManager) return [];
    return computeMonthlyTrendBuckets({
      tasks: allDepartmentTasks,
      initiatives: allDepartmentInitiatives,
      monthsCount: 4,
    });
  }, [isManager, allDepartmentTasks, allDepartmentInitiatives]);

  // Filter tasks table
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesAssignee = (task.assigned_user_name || '').toLowerCase().includes(query);
        const matchesRegion = task.region.toLowerCase().includes(query);
        const matchesInstructions = task.instructions.toLowerCase().includes(query);
        if (!matchesTitle && !matchesAssignee && !matchesRegion && !matchesInstructions) {
          return false;
        }
      }

      if (statusFilter === 'overdue') {
        const dueInfo = getDueStatusLabel(task.due_date, task.status);
        if (!dueInfo.isOverdue) return false;
      } else if (statusFilter === 'due_today') {
        const dueInfo = getDueStatusLabel(task.due_date, task.status);
        if (!dueInfo.isToday) return false;
      } else if (statusFilter === 'active') {
        if (task.status === 'completed') return false;
      } else if (statusFilter !== 'all') {
        if (task.status !== statusFilter) return false;
      }

      if (regionFilter !== 'all' && task.region !== regionFilter) {
        return false;
      }

      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, searchTerm, statusFilter, regionFilter, priorityFilter]);

  // Region Drill-Down derived personnel and tasks
  const drillRegionDetails = useMemo(() => {
    if (!drillRegionSummary) return null;
    const matchIds = drillRegionSummary.isConsolidatedGroup
      ? drillRegionSummary.childRegionIds || []
      : [drillRegionSummary.region.id];

    const regionPersonnel = personnelRecords.filter(
      (p) => p.user.approved && p.user.active && p.region && matchIds.includes(p.region.id)
    );
    const regionTasks = allDepartmentTasks.filter((t) =>
      matchIds.includes(resolveOperatingRegionId(t.region, operatingRegions))
    );
    const overdueInRegion = regionTasks.filter(
      (t) => getDueStatusLabel(t.due_date, t.status).isOverdue
    );

    return { regionPersonnel, regionTasks, overdueInRegion };
  }, [drillRegionSummary, personnelRecords, allDepartmentTasks, operatingRegions]);

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const scrollToTasksTable = (filterVal: string) => {
    setStatusFilter(filterVal);
    const el = document.getElementById('dashboard-tasks-section');
    if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
  };

  return (
    <div className="space-y-6">
      {/* Header & Live Sync Controls */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            {isManager ? 'Security Manager Command Dashboard' : 'Security Operations Dashboard'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isManager
              ? 'Security Department live command & control over personnel, regional operations, approvals, and initiatives'
              : 'Your assigned security inspections, investigations, and proactive contributions'}
            {' • '}
            <span className="font-medium text-slate-700">
              Philippine Time: {formatPhilippineDate(getPhilippineToday())}
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          {/* Live Timestamp & Refresh */}
          <div className="px-3 py-2 bg-white border border-slate-200 rounded-lg flex items-center space-x-2 text-slate-600 shadow-xs">
            <span
              className={`w-2 h-2 rounded-full ${
                dataError
                  ? 'bg-rose-500'
                  : realtimeStatus === 'live'
                  ? 'bg-emerald-500 animate-pulse'
                  : 'bg-amber-500'
              }`}
              title={
                dataError
                  ? 'Sync warning encountered'
                  : realtimeStatus === 'live'
                  ? 'Live Supabase Realtime connected'
                  : 'Polling / Manual sync active'
              }
            />
            <span>
              Last Successful Sync: <strong>{formatPhilippineDateTime(lastUpdatedAt)}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-xs transition space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>{refreshing ? 'Syncing...' : 'Refresh'}</span>
          </button>

          {isManager ? (
            <button
              type="button"
              onClick={onCreateTask}
              className="inline-flex items-center justify-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs sm:text-sm font-semibold rounded-lg shadow-sm transition space-x-1.5 cursor-pointer"
            >
              <Plus className="w-4 h-4" />
              <span>Create Task</span>
            </button>
          ) : (
            onNavigateToMyPerformance && (
              <button
                type="button"
                onClick={onNavigateToMyPerformance}
                className="inline-flex items-center justify-center px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg shadow-sm transition space-x-1.5 cursor-pointer"
              >
                <TrendingUp className="w-4 h-4" />
                <span>View My Performance</span>
              </button>
            )
          )}
        </div>
      </div>

      {/* Explicit Data Sync Error Banner with Retry (never silently displays zeros on error) */}
      {dataError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-rose-900 shadow-xs">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="w-5 h-5 text-rose-600 flex-shrink-0 mt-0.5" />
            <div>
              <div className="font-bold">Supabase Sync Warning</div>
              <p className="text-rose-800 mt-0.5">{dataError}</p>
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="px-3 py-1.5 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-lg transition cursor-pointer whitespace-nowrap self-start sm:self-auto"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* =====================================================================
          MANAGER COMMAND DASHBOARD: SECTIONS A–E
         ===================================================================== */}
      {isManager && managerCommandMetrics ? (
        <>
          {/* Reporting Date Filter Strip */}
          <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
            <div className="flex items-center space-x-2 text-slate-700">
              <Calendar className="w-4 h-4 text-blue-600" />
              <span>
                Reporting Cohort:{' '}
                <strong>
                  {formatPhilippineDate(fromDate)} – {formatPhilippineDate(toDate)}
                </strong>{' '}
                <span className="text-slate-400">(Asia/Manila)</span>
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              {(['today', 'week', 'month', 'quarter', 'custom'] as DateRangePreset[]).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPreset(p)}
                  className={`px-2.5 py-1 rounded-md font-semibold capitalize transition cursor-pointer ${
                    preset === p
                      ? 'bg-blue-700 text-white'
                      : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                  }`}
                >
                  {p === 'week'
                    ? 'This Week'
                    : p === 'month'
                    ? 'This Month'
                    : p === 'quarter'
                    ? 'This Quarter'
                    : p === 'custom'
                    ? 'Custom Range'
                    : 'Today'}
                </button>
              ))}

              {preset === 'custom' && (
                <div className="flex items-center space-x-1 ml-1">
                  <input
                    type="date"
                    value={customFrom}
                    onChange={(e) => setCustomFrom(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                  <span>to</span>
                  <input
                    type="date"
                    value={customTo}
                    onChange={(e) => setCustomTo(e.target.value)}
                    className="px-2 py-1 border border-slate-300 rounded text-xs"
                  />
                </div>
              )}
            </div>
          </div>

          {/* SECTION A: EXECUTIVE SECURITY OVERVIEW (6 CARDS) */}
          <section className="space-y-2.5">
            <div className="flex items-center justify-between">
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-600 flex items-center space-x-1.5">
                <Shield className="w-3.5 h-3.5 text-blue-700" />
                <span>Section A • Executive Security Overview</span>
              </h2>
              <span className="text-[11px] text-slate-500">
                Live operational metrics vs. roadmap placeholders (never fabricated)
              </span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6 gap-3 text-xs">
              {/* 1. Critical / Active Incidents (Phase 3 Placeholder) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Critical Incidents</span>
                  <ShieldAlert className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-slate-700 pt-1">Not Configured</div>
                <div className="text-[10px] text-slate-500">
                  Phase 3 Module (Incidents & Case Registry)
                </div>
              </div>

              {/* 2. Open Investigations (Phase 3 Placeholder) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Open Investigations</span>
                  <FileSearch className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-slate-700 pt-1">Not Configured</div>
                <div className="text-[10px] text-slate-500">
                  Phase 3 Module (Case Tracking & Escalation)
                </div>
              </div>

              {/* 3. Currently Overdue Tasks (Live Reconciled) */}
              <div
                onClick={() => onNavigateToTasks('overdue')}
                className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                  managerCommandMetrics.overdue > 0
                    ? 'bg-rose-50 border-rose-300 hover:border-rose-500'
                    : 'bg-white border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 uppercase">
                  <span>Currently Overdue</span>
                  <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-rose-900">
                  {managerCommandMetrics.overdue}
                </div>
                <div className="text-[10px] text-rose-700 mt-0.5 font-medium">
                  {managerCommandMetrics.becameOverdueInPeriodCount} in period •{' '}
                  {managerCommandMetrics.historicalOverdueCount} prior →
                </div>
              </div>

              {/* 4. Approved SOH Personnel & Guard Duty Logs */}
              <div
                onClick={() => onNavigateToPersonnel?.()}
                className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 uppercase">
                  <span>Approved SOH Staff</span>
                  <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-emerald-900">
                  {managerCommandMetrics.activeApprovedPersonnel}{' '}
                  <span className="text-xs font-normal text-slate-500">
                    / {managerCommandMetrics.totalRegisteredPersonnel}
                  </span>
                </div>
                <div className="text-[10px] text-slate-500 mt-0.5">
                  Guard Duty Logs: <span className="font-semibold">Data Unavailable (Ph. 4)</span>
                </div>
              </div>

              {/* 5. Facility Security Coverage (Phase 4 Placeholder) */}
              <div className="p-3.5 bg-slate-50 rounded-xl border border-dashed border-slate-300 space-y-1">
                <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase">
                  <span>Facility Coverage</span>
                  <Building2 className="w-3.5 h-3.5 text-slate-400" />
                </div>
                <div className="text-sm font-bold text-slate-700 pt-1">Not Configured</div>
                <div className="text-[10px] text-slate-500">
                  Phase 4 Module (Site Posts & Guard Rosters)
                </div>
              </div>

              {/* 6. Pending Management Approvals (Accounts + Task Reviews + Initiatives) */}
              <div
                onClick={() => {
                  const el = document.getElementById('management-action-center');
                  if (el) el.scrollIntoView({ behavior: 'smooth' });
                }}
                className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                  managerCommandMetrics.totalPendingManagementApprovals > 0
                    ? 'bg-amber-50 border-amber-300 hover:border-amber-500'
                    : 'bg-white border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 uppercase">
                  <span>Pending Approvals</span>
                  <ClipboardCheck className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="mt-1 text-2xl font-bold text-amber-900">
                  {managerCommandMetrics.totalPendingManagementApprovals}
                </div>
                <div className="text-[10px] text-amber-800 mt-0.5 font-medium">
                  {managerCommandMetrics.pendingApprovals} Accts • {managerCommandMetrics.forReview} Tasks •{' '}
                  {managerCommandMetrics.pendingInitiativesCount} Init.
                </div>
              </div>
            </div>

            {/* Secondary Reconciled Task & Workforce Operations Strip */}
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5 text-xs">
              <div
                onClick={() => scrollToTasksTable('active')}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-blue-700 uppercase">
                  <span>Open Tasks (All)</span>
                  <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
                </div>
                <div className="mt-1 text-xl font-bold text-slate-900">
                  {managerCommandMetrics.allOpenTasksCount}
                </div>
                <div className="text-[10px] text-slate-400">
                  {managerCommandMetrics.totalActiveTasks} in cohort
                </div>
              </div>

              <div
                onClick={() => scrollToTasksTable('due_today')}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  managerCommandMetrics.dueToday > 0
                    ? 'bg-amber-50/70 border-amber-300'
                    : 'bg-white border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-amber-800 uppercase">
                  <span>Due Today (PHT)</span>
                  <Calendar className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="mt-1 text-xl font-bold text-amber-900">
                  {managerCommandMetrics.dueToday}
                </div>
                <div className="text-[10px] text-amber-700">Today&apos;s deadline</div>
              </div>

              <div
                onClick={() => onNavigateToTasks('for_review')}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-indigo-800 uppercase">
                  <span>Tasks For Review</span>
                  <Eye className="w-3.5 h-3.5 text-indigo-600" />
                </div>
                <div className="mt-1 text-xl font-bold text-indigo-900">
                  {managerCommandMetrics.forReview}
                </div>
                <div className="text-[10px] text-indigo-700">Awaiting sign-off</div>
              </div>

              <div
                onClick={() => scrollToTasksTable('completed')}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-emerald-700 uppercase">
                  <span>Completed (Cohort)</span>
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                </div>
                <div className="mt-1 text-xl font-bold text-emerald-900">
                  {managerCommandMetrics.completed}
                </div>
                <div className="text-[10px] text-slate-400">
                  {managerCommandMetrics.completedLateInPeriodCount} closed late
                </div>
              </div>

              <div
                onClick={() => onNavigateToInitiatives?.()}
                className="p-3 bg-white rounded-xl border border-slate-200 hover:border-blue-400 transition cursor-pointer"
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-amber-700 uppercase">
                  <span>Recognized Init.</span>
                  <Award className="w-3.5 h-3.5 text-amber-600" />
                </div>
                <div className="mt-1 text-xl font-bold text-amber-900">
                  {managerCommandMetrics.recognizedInitiatives}
                </div>
                <div className="text-[10px] text-amber-700">Validated in cohort</div>
              </div>

              <div
                onClick={() => {
                  if (
                    managerCommandMetrics.personnelWithOverdueList.length === 1 &&
                    onViewPersonnelPerformance
                  ) {
                    onViewPersonnelPerformance(managerCommandMetrics.personnelWithOverdueList[0].id);
                  } else {
                    onNavigateToPersonnel?.();
                  }
                }}
                className={`p-3 rounded-xl border transition cursor-pointer ${
                  managerCommandMetrics.personnelWithOverdueList.length > 0
                    ? 'bg-rose-50/70 border-rose-300'
                    : 'bg-white border-slate-200 hover:border-blue-400'
                }`}
              >
                <div className="flex items-center justify-between text-[10px] font-semibold text-rose-800 uppercase">
                  <span>Staff w/ Overdue</span>
                  <UserX className="w-3.5 h-3.5 text-rose-600" />
                </div>
                <div className="mt-1 text-xl font-bold text-rose-900">
                  {managerCommandMetrics.personnelWithOverdueList.length}
                </div>
                <div className="text-[10px] text-rose-700">
                  {managerCommandMetrics.personnelWithoutAssignmentsList.length} w/o open tasks
                </div>
              </div>
            </div>
          </section>

          {/* SECTION B: REGIONAL SECURITY OPERATIONS (WITH CONSOLIDATED VISAYAS / MINDANAO & DRILL-DOWN) */}
          <section className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <span>Section B • Regional Security Operations & Consolidated Island Rollups</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Click any regional row for Supervisors, Assigned Personnel, Open/Overdue Tasks, and Phase 3/4 status
                </p>
              </div>
              <button
                type="button"
                onClick={() => onNavigateToPersonnel?.()}
                className="text-xs text-blue-700 hover:underline font-semibold cursor-pointer"
              >
                Full Personnel & Region Matrix →
              </button>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-2.5">Operating Region</th>
                    <th className="px-4 py-2.5">Assigned Regional Supervisor</th>
                    <th className="px-4 py-2.5 text-center">SOH Staff</th>
                    <th className="px-4 py-2.5 text-center">Open Tasks</th>
                    <th className="px-4 py-2.5 text-center">Completed</th>
                    <th className="px-4 py-2.5 text-center">Currently Overdue</th>
                    <th className="px-4 py-2.5 text-center">Pending Reviews</th>
                    <th className="px-4 py-2.5">On-Time SLA</th>
                    <th className="px-4 py-2.5">Site Coverage</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {regionalSummaries.map((r) => (
                    <tr
                      key={r.region.id}
                      onClick={() => setDrillRegionSummary(r)}
                      className="hover:bg-blue-50/50 cursor-pointer transition"
                    >
                      <td className="px-4 py-2.5">
                        <div className="font-bold text-slate-900">{r.region.name}</div>
                        <div className="text-[10px] text-slate-500">
                          {r.region.island_group} ({r.region.code})
                        </div>
                      </td>
                      <td className="px-4 py-2.5">
                        {r.assignedSupervisors.length > 0 ? (
                          <div className="space-y-0.5">
                            {r.assignedSupervisors.map((sup) => (
                              <div key={sup.id} className="text-slate-800 font-medium">
                                {sup.name}
                              </div>
                            ))}
                          </div>
                        ) : (
                          <span className="text-slate-400 italic">Not Assigned</span>
                        )}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-slate-800">
                        {r.assignedPersonnelCount}
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-blue-700">
                        {r.allOpenTasksCount}
                      </td>
                      <td className="px-4 py-2.5 text-center font-bold text-emerald-700">
                        {r.completedTasksCount}
                      </td>
                      <td className="px-4 py-2.5 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full ${
                            r.overdueTasksCount > 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'text-slate-500'
                          }`}
                        >
                          {r.overdueTasksCount}
                        </span>
                      </td>
                      <td className="px-4 py-2.5 text-center font-semibold text-amber-800">
                        {r.pendingReviewsCount}
                      </td>
                      <td className="px-4 py-2.5 font-mono font-semibold text-slate-800">
                        {r.onTimeRate.display}
                      </td>
                      <td className="px-4 py-2.5 text-[10px] text-slate-400 italic">
                        Not Configured (Ph. 4)
                      </td>
                    </tr>
                  ))}

                  {/* Consolidated Island Rollup Rows */}
                  {consolidatedRollups &&
                    [
                      consolidatedRollups.consolidatedVisayas,
                      consolidatedRollups.consolidatedMindanao,
                    ].map((cr) => (
                      <tr
                        key={cr.region.id}
                        onClick={() => setDrillRegionSummary(cr)}
                        className="bg-slate-50/90 hover:bg-blue-50 cursor-pointer transition border-t-2 border-slate-200"
                      >
                        <td className="px-4 py-2.5">
                          <div className="font-bold text-blue-900 flex items-center space-x-1.5">
                            <Layers className="w-3.5 h-3.5 text-blue-700" />
                            <span>{cr.region.name}</span>
                          </div>
                          <div className="text-[10px] text-blue-700">
                            Consolidated Rollup ({cr.region.island_group})
                          </div>
                        </td>
                        <td className="px-4 py-2.5 text-slate-700 font-medium">
                          {cr.assignedSupervisors.length > 0
                            ? cr.assignedSupervisors.map((s) => s.name).join(', ')
                            : 'Not Assigned'}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-slate-900">
                          {cr.assignedPersonnelCount}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-blue-800">
                          {cr.allOpenTasksCount}
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-emerald-800">
                          {cr.completedTasksCount}
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span
                            className={`font-bold px-2 py-0.5 rounded-full ${
                              cr.overdueTasksCount > 0
                                ? 'bg-rose-100 text-rose-800'
                                : 'text-slate-600'
                            }`}
                          >
                            {cr.overdueTasksCount}
                          </span>
                        </td>
                        <td className="px-4 py-2.5 text-center font-bold text-amber-800">
                          {cr.pendingReviewsCount}
                        </td>
                        <td className="px-4 py-2.5 font-mono font-bold text-slate-900">
                          {cr.onTimeRate.display}
                        </td>
                        <td className="px-4 py-2.5 text-[10px] text-slate-400 italic">
                          Not Configured (Ph. 4)
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </section>

          {/* SECTION C: DEPARTMENT, PERSONNEL & UNIT PERFORMANCE OVERVIEW */}
          <section className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
            {/* Column 1: KPI Rates & Monthly Trends */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900">
                  Section C • Department Performance
                </h2>
                <button
                  type="button"
                  onClick={() => onNavigateToPersonnel?.()}
                  className="text-blue-700 hover:underline font-semibold cursor-pointer"
                >
                  Team View →
                </button>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] text-slate-500 uppercase font-bold block">
                    Completion Rate
                  </span>
                  <div className="text-base font-bold text-slate-900 mt-0.5 font-mono">
                    {managerCommandMetrics.completionRate.display}
                  </div>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    Closed ÷ cohort tasks
                  </div>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    On-Time Completion
                  </span>
                  <div className="text-base font-bold text-emerald-900 mt-0.5 font-mono">
                    {managerCommandMetrics.onTimeRate.display}
                  </div>
                  <div className="text-[10px] text-emerald-700 mt-0.5">
                    Closed ≤ due date (PHT)
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-700 uppercase">
                  Monthly Operational Trend (PHT)
                </div>
                <div className="space-y-2">
                  {monthlyTrends.map((m) => (
                    <div key={m.monthKey} className="p-2 bg-slate-50 border border-slate-200 rounded-lg">
                      <div className="flex items-center justify-between font-semibold text-slate-800 mb-1">
                        <span>{m.label}</span>
                        <span className="text-[10px] text-slate-500">
                          {m.completedTasks} Done • {m.overdueTasks} Overdue • {m.pendingReviews} Review •{' '}
                          {m.recognizedInitiatives} Recog.
                        </span>
                      </div>
                      <div className="flex h-2 rounded-full overflow-hidden bg-slate-200">
                        {m.completedTasks > 0 && (
                          <div
                            className="bg-emerald-600"
                            style={{ width: `${Math.min(100, m.completedTasks * 12)}%` }}
                            title={`Completed: ${m.completedTasks}`}
                          />
                        )}
                        {m.pendingReviews > 0 && (
                          <div
                            className="bg-amber-500"
                            style={{ width: `${Math.min(100, m.pendingReviews * 12)}%` }}
                            title={`Pending Review: ${m.pendingReviews}`}
                          />
                        )}
                        {m.overdueTasks > 0 && (
                          <div
                            className="bg-rose-600"
                            style={{ width: `${Math.min(100, m.overdueTasks * 12)}%` }}
                            title={`Overdue: ${m.overdueTasks}`}
                          />
                        )}
                        {m.recognizedInitiatives > 0 && (
                          <div
                            className="bg-indigo-600"
                            style={{ width: `${Math.min(100, m.recognizedInitiatives * 12)}%` }}
                            title={`Recognized Initiatives: ${m.recognizedInitiatives}`}
                          />
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Column 2: Workload Distribution by Unit */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                  <Building2 className="w-4 h-4 text-blue-600" />
                  <span>Workload Distribution by Unit</span>
                </h2>
              </div>

              <div className="space-y-2.5">
                {unitSummaries.map((u) => {
                  const totalLoad = u.allOpenTasksCount + u.completedTasksCount;
                  const maxUnitLoad = Math.max(
                    1,
                    ...unitSummaries.map((x) => x.allOpenTasksCount + x.completedTasksCount)
                  );
                  return (
                    <div
                      key={u.unit.id}
                      onClick={() => onNavigateToPersonnel?.()}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 cursor-pointer transition space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span className="truncate pr-2">{u.unit.name}</span>
                        <span className="text-[11px] text-slate-600 whitespace-nowrap">
                          {u.activeUsersCount} Staff • {u.allOpenTasksCount} Open
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-700 h-full"
                          style={{ width: `${(totalLoad / maxUnitLoad) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Done: {u.completedTasksCount}</span>
                        <span className={u.overdueTasksCount > 0 ? 'text-rose-700 font-bold' : ''}>
                          Curr. Overdue: {u.overdueTasksCount}
                        </span>
                        <span>On-Time: {u.onTimeRate.display}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Section D (Future Phase Modules) + Quick Personnel Workload */}
            <div className="space-y-4">
              {/* SECTION D: INCIDENT & GUARD COVERAGE PLACEHOLDER */}
              <div className="bg-slate-50 p-5 rounded-xl border border-dashed border-slate-300 space-y-2.5">
                <h2 className="font-bold text-sm text-slate-800 flex items-center space-x-1.5">
                  <ShieldAlert className="w-4 h-4 text-slate-500" />
                  <span>Section D • Incident & Guard Operations</span>
                </h2>
                <p className="text-[11px] text-slate-600 leading-relaxed">
                  Per Security Department rollout phasing, the following modules are prepared as future roadmap extensions and are intentionally marked <strong>Not Configured</strong> until enabled:
                </p>
                <div className="space-y-1.5 text-[11px]">
                  <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Incidents & Investigations</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      Not Configured (Phase 3)
                    </span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Facility Coverage & Guard Logs</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      Not Configured (Phase 4)
                    </span>
                  </div>
                  <div className="p-2 bg-white border border-slate-200 rounded-lg flex items-center justify-between">
                    <span className="font-semibold text-slate-700">Security Projects & Audits</span>
                    <span className="px-2 py-0.5 rounded bg-slate-100 text-slate-600 font-medium">
                      Planned (Phase 5)
                    </span>
                  </div>
                </div>
              </div>

              {/* Staff Overdue Snapshot */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2">
                <div className="flex items-center justify-between">
                  <h3 className="font-bold text-xs uppercase text-slate-700">
                    Personnel Overdue Reconciliation
                  </h3>
                  <button
                    type="button"
                    onClick={() => onNavigateToPersonnel?.()}
                    className="text-blue-700 hover:underline font-semibold text-[11px] cursor-pointer"
                  >
                    Directory →
                  </button>
                </div>
                {managerCommandMetrics.personnelWithOverdueList.length === 0 ? (
                  <p className="text-emerald-700 text-[11px]">
                    All approved personnel currently have zero overdue tasks.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {personnelRecords
                      .filter((r) => r.overdueTasksCount > 0)
                      .slice(0, 4)
                      .map((r) => (
                        <div
                          key={r.user.id}
                          onClick={() => onViewPersonnelPerformance?.(r.user.id)}
                          className="p-2 bg-rose-50/70 border border-rose-200 rounded-lg flex items-center justify-between cursor-pointer hover:border-blue-400"
                        >
                          <div className="truncate pr-2">
                            <div className="font-semibold text-slate-900 truncate">
                              {r.user.display_name}
                            </div>
                            <div className="text-[10px] text-slate-500">
                              {r.region?.name || 'Site'} • {r.overdueTasksCount} overdue task(s)
                            </div>
                          </div>
                          <ArrowRight className="w-3.5 h-3.5 text-rose-600 flex-shrink-0" />
                        </div>
                      ))}
                  </div>
                )}
              </div>
            </div>
          </section>

          {/* SECTION E: MANAGEMENT ACTION CENTER */}
          <section
            id="management-action-center"
            className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 space-y-4 text-xs"
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
              <div>
                <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                  <ClipboardCheck className="w-4 h-4 text-blue-700" />
                  <span>Section E • Management Action Center</span>
                </h2>
                <p className="text-xs text-slate-500">
                  Prioritized actionable items requiring Security Manager decision, validation, or follow-up
                </p>
              </div>
              <span className="text-[11px] font-semibold text-slate-600">
                {managerCommandMetrics.pendingApprovals +
                  managerCommandMetrics.forReview +
                  managerCommandMetrics.pendingInitiativesCount +
                  managerCommandMetrics.overdue +
                  managerCommandMetrics.returnedForRevision}{' '}
                item(s) tracked
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {/* 1. Pending Account Approvals */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase text-[11px]">
                    1. Account Approvals ({managerCommandMetrics.pendingApprovals})
                  </span>
                  <button
                    type="button"
                    onClick={() => onOpenApprovals?.()}
                    className="text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    Open Approvals →
                  </button>
                </div>
                {managerCommandMetrics.pendingApprovalProfiles.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">No pending account requests.</p>
                ) : (
                  <div className="space-y-1.5">
                    {managerCommandMetrics.pendingApprovalProfiles.slice(0, 3).map((u) => (
                      <div
                        key={u.id}
                        onClick={() => onOpenApprovals?.()}
                        className="p-2 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:border-blue-400"
                      >
                        <div className="font-semibold text-slate-900 truncate">{u.display_name}</div>
                        <div className="text-[10px] text-slate-600 font-mono truncate">{u.email}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 2. Tasks Awaiting Review + Currently Overdue */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase text-[11px]">
                    2. Reviews ({managerCommandMetrics.forReview}) & Overdue ({managerCommandMetrics.overdue})
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToTasks('overdue')}
                    className="text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    Tasks Board →
                  </button>
                </div>
                {managerCommandMetrics.allForReviewTasks.length === 0 &&
                managerCommandMetrics.allCurrentlyOverdueTasks.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    No tasks awaiting review or currently overdue.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {managerCommandMetrics.allForReviewTasks.slice(0, 2).map((t) => (
                      <div
                        key={`rev-${t.id}`}
                        onClick={() => onSelectTask(t)}
                        className="p-2 bg-indigo-50 border border-indigo-200 rounded-lg cursor-pointer hover:border-blue-400"
                      >
                        <div className="text-[10px] font-bold text-indigo-800 uppercase">For Review</div>
                        <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                        <div className="text-[10px] text-slate-600 truncate">
                          {t.assigned_user_name} • {t.region}
                        </div>
                      </div>
                    ))}
                    {managerCommandMetrics.allCurrentlyOverdueTasks.slice(0, 2).map((t) => (
                      <div
                        key={`ov-${t.id}`}
                        onClick={() => onSelectTask(t)}
                        className="p-2 bg-rose-50 border border-rose-200 rounded-lg cursor-pointer hover:border-blue-400"
                      >
                        <div className="text-[10px] font-bold text-rose-800 uppercase">
                          Overdue (Due {formatPhilippineDate(t.due_date)})
                        </div>
                        <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                        <div className="text-[10px] text-slate-600 truncate">
                          {t.assigned_user_name} • {t.region}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* 3. Pending Initiatives & Returned Revisions */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-slate-800 uppercase text-[11px]">
                    3. Initiatives ({managerCommandMetrics.pendingInitiativesCount}) & Returned (
                    {managerCommandMetrics.returnedForRevision})
                  </span>
                  <button
                    type="button"
                    onClick={() => onNavigateToInitiatives?.()}
                    className="text-blue-700 hover:underline font-semibold cursor-pointer"
                  >
                    Initiatives →
                  </button>
                </div>
                {managerCommandMetrics.pendingInitiatives.length === 0 &&
                managerCommandMetrics.allReturnedTasks.length === 0 &&
                managerCommandMetrics.returnedInitiatives.length === 0 ? (
                  <p className="text-[11px] text-slate-400 italic">
                    No pending initiatives or returned revisions.
                  </p>
                ) : (
                  <div className="space-y-1.5">
                    {managerCommandMetrics.pendingInitiatives.slice(0, 2).map((init) => (
                      <div
                        key={`pinit-${init.id}`}
                        onClick={() => onSelectInitiative?.(init)}
                        className="p-2 bg-amber-50 border border-amber-200 rounded-lg cursor-pointer hover:border-blue-400"
                      >
                        <div className="text-[10px] font-bold text-amber-800 uppercase">
                          Initiative Review
                        </div>
                        <div className="font-semibold text-slate-900 truncate">{init.title}</div>
                        <div className="text-[10px] text-slate-600 truncate">
                          By {init.submitted_by_name} • {init.region}
                        </div>
                      </div>
                    ))}
                    {managerCommandMetrics.allReturnedTasks.slice(0, 2).map((t) => (
                      <div
                        key={`rt-${t.id}`}
                        onClick={() => onSelectTask(t)}
                        className="p-2 bg-white border border-rose-200 rounded-lg cursor-pointer hover:border-blue-400"
                      >
                        <div className="text-[10px] font-bold text-rose-700 uppercase">
                          Returned Task
                        </div>
                        <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </section>
        </>
      ) : (
        /* TEAM MEMBER 5 SUMMARY CARDS */
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
          <div
            onClick={() => setStatusFilter('all')}
            className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Active Tasks
              </span>
              <CheckSquare className="w-4 h-4 text-blue-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.activeTasks}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Incomplete assignments</div>
          </div>

          <div
            onClick={() => setStatusFilter('due_today')}
            className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
              summary.dueToday > 0 ? 'bg-amber-50/80 border-amber-300' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">
                Due Today
              </span>
              <Calendar className="w-4 h-4 text-amber-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-amber-900">{summary.dueToday}</div>
            <div className="text-[11px] text-amber-700/80 mt-0.5">Deadline is today</div>
          </div>

          <div
            onClick={() => setStatusFilter('overdue')}
            className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
              summary.overdue > 0 ? 'bg-rose-50/80 border-rose-300' : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-rose-800 uppercase tracking-wider">
                Overdue
              </span>
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-rose-900">{summary.overdue}</div>
            <div className="text-[11px] text-rose-700/80 mt-0.5">Past due date</div>
          </div>

          <div
            onClick={() => setStatusFilter('for_review')}
            className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
              summary.forReview > 0
                ? 'bg-indigo-50/80 border-indigo-300'
                : 'bg-white border-slate-200'
            }`}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-indigo-800 uppercase tracking-wider">
                For Review
              </span>
              <RotateCcw className="w-4 h-4 text-indigo-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-indigo-900">{summary.forReview}</div>
            <div className="text-[11px] text-indigo-700/80 mt-0.5">Awaiting Manager sign-off</div>
          </div>

          <div
            onClick={() => setStatusFilter('completed')}
            className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer col-span-2 sm:col-span-1"
          >
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
                Completed
              </span>
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            </div>
            <div className="mt-2 text-2xl font-bold text-slate-900">{summary.completed}</div>
            <div className="text-[11px] text-slate-400 mt-0.5">Officially closed</div>
          </div>
        </div>
      )}

      {/* Member Initiative & Recognition Highlight Banner */}
      <div className="p-4 bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl shadow-xs border border-blue-800 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div className="flex items-center space-x-3">
          <div className="p-2.5 bg-blue-600/60 rounded-lg text-amber-300">
            <Award className="w-6 h-6" />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h3 className="font-bold text-sm tracking-tight text-white">
                Member Initiative & Activity Recognition
              </h3>
            </div>
            <p className="text-xs text-slate-300 mt-0.5">
              Proactive inspections & permitted routine checks recognized separately from direct manager assignments
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-4 self-start sm:self-auto text-xs">
          <div className="text-right">
            <span className="text-slate-400 text-[11px] block">Officially Recognized</span>
            <span className="text-lg font-bold text-emerald-400">
              {initiativeSummary.recognized}
            </span>
          </div>

          <div className="text-right border-l border-slate-700 pl-4">
            <span className="text-slate-400 text-[11px] block">Awaiting Review</span>
            <span className="text-lg font-bold text-amber-300">
              {initiativeSummary.pendingReview}
            </span>
          </div>

          {onNavigateToInitiatives && (
            <button
              type="button"
              onClick={onNavigateToInitiatives}
              className="ml-2 px-3 py-2 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded-lg shadow-xs transition flex items-center space-x-1 cursor-pointer whitespace-nowrap"
            >
              <span>{isManager ? 'Open Reviews' : 'My Initiatives'}</span>
            </button>
          )}
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div id="dashboard-tasks-section" className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks, officers, or facilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900"
            />
          </div>

          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="active">Active (Open Only)</option>
              <option value="due_today">Due Today</option>
              <option value="overdue">Overdue Only</option>
              <option value="for_review">For Review</option>
              <option value="in_progress">In Progress</option>
              <option value="assigned">Assigned</option>
              <option value="returned">Returned for Revision</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <div>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="all">All Philippine Regions / Sites</option>
              {PHILIPPINE_REGIONS.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent Priority</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal Priority</option>
            </select>
          </div>
        </div>

        {(statusFilter !== 'all' || regionFilter !== 'all' || priorityFilter !== 'all' || searchTerm) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Showing <span className="font-bold text-slate-800">{filteredTasks.length}</span> matching record(s)
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setRegionFilter('all');
                setPriorityFilter('all');
              }}
              className="text-blue-700 hover:underline font-medium cursor-pointer"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Compact Tasks Table */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-slate-900">
            {isManager ? 'Department Security Tasks' : 'My Assigned Work'}
          </h2>
          <div className="flex items-center space-x-3 text-xs">
            <span className="text-slate-500 font-medium">{filteredTasks.length} total</span>
            <button
              type="button"
              onClick={() => onNavigateToTasks(statusFilter)}
              className="text-blue-700 hover:underline font-semibold cursor-pointer"
            >
              Full Tasks Board →
            </button>
          </div>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No security tasks match your current filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Task Details</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Region / Facility</th>
                  <th className="px-4 py-3">Due Date (PHT)</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTasks.map((task) => {
                  const statusCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.assigned;
                  const dueInfo = getDueStatusLabel(task.due_date, task.status);

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => onSelectTask(task)}
                    >
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 max-w-xs truncate">
                          {task.title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                          <span>{task.category}</span>
                          {task.progress_percent !== undefined && (
                            <span>• {task.progress_percent}% complete</span>
                          )}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {task.assigned_user_name || 'Assigned Officer'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {task.assigned_user_email}
                        </div>
                      </td>

                      <td className="px-4 py-3">
                        <div className="text-slate-700 max-w-[180px] truncate" title={task.region}>
                          {task.region}
                        </div>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {formatPhilippineDate(task.due_date)}
                        </div>
                        {dueInfo.isOverdue && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            {dueInfo.label}
                          </span>
                        )}
                        {dueInfo.isToday && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            Due Today
                          </span>
                        )}
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border capitalize ${
                            task.priority === 'urgent'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : task.priority === 'high'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask(task);
                          }}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* REGION DRILL-DOWN MODAL */}
      {isManager && drillRegionSummary && drillRegionDetails && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/65 backdrop-blur-xs">
          <div className="bg-white rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] flex flex-col overflow-hidden border border-slate-200">
            <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
              <div>
                <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">
                  Regional Security Operations Drill-Down ({drillRegionSummary.region.island_group})
                </div>
                <h3 className="text-base sm:text-lg font-bold">{drillRegionSummary.region.name}</h3>
              </div>
              <button
                type="button"
                onClick={() => setDrillRegionSummary(null)}
                className="text-slate-400 hover:text-white p-1 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-6 overflow-y-auto space-y-5 text-xs flex-1">
              {/* Regional KPI Summary */}
              <div className="grid grid-cols-2 sm:grid-cols-5 gap-3 text-center">
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-slate-500">SOH Staff</span>
                  <div className="text-lg font-bold text-slate-900 mt-0.5">
                    {drillRegionSummary.assignedPersonnelCount}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-blue-700">Open Tasks</span>
                  <div className="text-lg font-bold text-blue-900 mt-0.5">
                    {drillRegionSummary.allOpenTasksCount}
                  </div>
                </div>
                <div className="p-3 bg-rose-50 border border-rose-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-rose-700">
                    Curr. Overdue
                  </span>
                  <div className="text-lg font-bold text-rose-900 mt-0.5">
                    {drillRegionSummary.overdueTasksCount}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] uppercase font-bold text-emerald-700">On-Time SLA</span>
                  <div className="text-sm font-bold text-emerald-900 mt-1 font-mono">
                    {drillRegionSummary.onTimeRate.display}
                  </div>
                </div>
                <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg col-span-2 sm:col-span-1">
                  <span className="text-[10px] uppercase font-bold text-slate-500">
                    Guard Coverage
                  </span>
                  <div className="text-xs font-bold text-slate-600 mt-1.5">
                    Not Configured (Ph. 4)
                  </div>
                </div>
              </div>

              {/* Supervisors & Personnel */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase text-[11px] text-slate-700">
                  Assigned Personnel & Supervisors ({drillRegionDetails.regionPersonnel.length})
                </h4>
                {drillRegionDetails.regionPersonnel.length === 0 ? (
                  <p className="text-slate-400 italic">
                    No approved personnel currently assigned to this region.
                  </p>
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {drillRegionDetails.regionPersonnel.map((p) => (
                      <div
                        key={p.user.id}
                        onClick={() => {
                          setDrillRegionSummary(null);
                          onViewPersonnelPerformance?.(p.user.id);
                        }}
                        className="p-3 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-slate-900">{p.user.display_name}</div>
                          <div className="text-[10px] text-slate-500">
                            {p.position?.title || 'Personnel'} •{' '}
                            {p.assignment?.assigned_site || drillRegionSummary.region.name}
                          </div>
                        </div>
                        <div className="text-right text-[10px]">
                          <div className="font-semibold text-slate-700">
                            Open: {p.allOpenTasksCount} • Overdue:{' '}
                            <span className={p.overdueTasksCount > 0 ? 'text-rose-700 font-bold' : ''}>
                              {p.overdueTasksCount}
                            </span>
                          </div>
                          <span className="text-blue-700 font-semibold">View Profile →</span>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Regional Tasks */}
              <div className="space-y-2">
                <h4 className="font-bold uppercase text-[11px] text-slate-700">
                  Tasks Recorded in Region ({drillRegionDetails.regionTasks.length} total •{' '}
                  {drillRegionDetails.overdueInRegion.length} currently overdue)
                </h4>
                {drillRegionDetails.regionTasks.length === 0 ? (
                  <p className="text-slate-400 italic">No tasks recorded under this region yet.</p>
                ) : (
                  <div className="border border-slate-200 rounded-lg overflow-hidden">
                    <table className="w-full text-left text-xs">
                      <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                        <tr>
                          <th className="p-2.5">Task</th>
                          <th className="p-2.5">Assigned To</th>
                          <th className="p-2.5">Due Date</th>
                          <th className="p-2.5">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {drillRegionDetails.regionTasks.slice(0, 8).map((t) => {
                          const dueInfo = getDueStatusLabel(t.due_date, t.status);
                          const cfg = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.assigned;
                          return (
                            <tr
                              key={t.id}
                              onClick={() => {
                                setDrillRegionSummary(null);
                                onSelectTask(t);
                              }}
                              className="hover:bg-blue-50 cursor-pointer"
                            >
                              <td className="p-2.5 font-semibold text-slate-900">{t.title}</td>
                              <td className="p-2.5 text-slate-700">{t.assigned_user_name}</td>
                              <td className="p-2.5">
                                {formatPhilippineDate(t.due_date)}
                                {dueInfo.isOverdue && (
                                  <span className="ml-1.5 text-[10px] font-bold text-rose-700">
                                    ({dueInfo.label})
                                  </span>
                                )}
                              </td>
                              <td className="p-2.5">
                                <span
                                  className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${cfg.badgeClass}`}
                                >
                                  {cfg.label}
                                </span>
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>

              {/* Phase 3/4 Placeholders inside Drill-Down */}
              <div className="p-3 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-[11px] text-slate-600 flex flex-wrap gap-4 justify-between">
                <span>
                  <strong>Incidents & Investigations:</strong> Not Configured (Phase 3)
                </span>
                <span>
                  <strong>Agency Guard Duty Roster:</strong> Data Unavailable (Phase 4)
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
