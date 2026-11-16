import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  Task,
  MemberInitiative,
  DateRangePreset,
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
  isTaskDueToday,
  isTaskOverdue,
} from '../lib/dateUtils.ts';
import {
  computePersonnelPerformance,
  computeUnitPerformanceSummaries,
  computeRegionalPerformanceSummaries,
  computeMonthlyTrendBuckets,
  computeKpiFraction,
  getDateRangeForPreset,
  isTaskInReportingCohort,
  isWithinDateWindow,
  isCompletedOnTime,
} from '../lib/performanceUtils.ts';
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
} from 'lucide-react';

interface DashboardViewProps {
  onCreateTask: () => void;
  onSelectTask: (task: Task) => void;
  onNavigateToTasks: () => void;
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
    lastUpdatedAt,
    realtimeStatus,
    refreshData,
  } = useData();

  // Manager Date Filter State
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => getDateRangeForPreset('month').fromDate);
  const [customTo, setCustomTo] = useState<string>(() => getDateRangeForPreset('month').toDate);
  const [refreshing, setRefreshing] = useState(false);

  const { fromDate, toDate } = useMemo(() => {
    if (preset === 'custom') return { fromDate: customFrom, toDate: customTo };
    return getDateRangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  // Task Search & Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  const profilesById = useMemo(() => {
    const map: Record<string, typeof allProfiles[number]> = {};
    for (const p of allProfiles) map[p.id] = p;
    return map;
  }, [allProfiles]);

  // Manager Command Metrics (Live Supabase Calculations)
  const managerCommandMetrics = useMemo(() => {
    if (!isManager) return null;

    const totalRegisteredPersonnel = allProfiles.length;
    const approvedActiveUsers = allProfiles.filter((p) => p.approved && p.active);
    const pendingApprovals = allProfiles.filter((p) => !p.approved).length;

    const cohortTasks = allDepartmentTasks.filter((t) =>
      isTaskInReportingCohort(t, fromDate, toDate)
    );
    const activeTasks = cohortTasks.filter((t) => t.status !== 'completed');
    const dueToday = activeTasks.filter((t) => isTaskDueToday(t.due_date, t.status)).length;
    const overdue = activeTasks.filter((t) => isTaskOverdue(t.due_date, t.status)).length;
    const forReview = activeTasks.filter((t) => t.status === 'for_review').length;
    const completed = cohortTasks.filter((t) => t.status === 'completed');
    const completedWithDue = completed.filter((t) => Boolean(t.due_date));
    const onTimeCompleted = completedWithDue.filter((t) => isCompletedOnTime(t));

    const returnedTasks = cohortTasks.filter((t) => t.status === 'returned').length;
    const returnedInitiatives = allDepartmentInitiatives.filter(
      (i) => i.status === 'returned'
    ).length;

    const recognizedInitiatives = allDepartmentInitiatives.filter(
      (i) =>
        i.status === 'recognized' &&
        Boolean(i.recognized_at) &&
        isWithinDateWindow(i.recognized_at, fromDate, toDate)
    ).length;

    // Personnel workload calculations (open assignments across all approved active staff)
    const personnelWithoutCurrentAssignments = approvedActiveUsers.filter(
      (u) => !allDepartmentTasks.some((t) => t.assigned_to === u.id && t.status !== 'completed')
    );
    const personnelWithOverdueAssignments = approvedActiveUsers.filter((u) =>
      allDepartmentTasks.some(
        (t) => t.assigned_to === u.id && isTaskOverdue(t.due_date, t.status)
      )
    );

    const completionRate = computeKpiFraction(completed.length, cohortTasks.length);
    const onTimeRate = computeKpiFraction(onTimeCompleted.length, completedWithDue.length);

    return {
      totalRegisteredPersonnel,
      activeApprovedPersonnel: approvedActiveUsers.length,
      pendingApprovals,
      totalActiveTasks: activeTasks.length,
      dueToday,
      overdue,
      forReview,
      completed: completed.length,
      recognizedInitiatives,
      returnedForRevision: returnedTasks + returnedInitiatives,
      personnelWithoutAssignmentsList: personnelWithoutCurrentAssignments,
      personnelWithOverdueList: personnelWithOverdueAssignments,
      completionRate,
      onTimeRate,
    };
  }, [
    isManager,
    allProfiles,
    allDepartmentTasks,
    allDepartmentInitiatives,
    fromDate,
    toDate,
  ]);

  // Personnel & Team summaries for Department Performance Overview
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

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData({ silent: true });
    } finally {
      setRefreshing(false);
    }
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
              ? 'Live department-wide oversight of personnel, regional tasks, approvals, and initiatives'
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
                realtimeStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
              title={
                realtimeStatus === 'live'
                  ? 'Live Supabase Realtime connected'
                  : 'Polling / Manual sync active'
              }
            />
            <span>
              Last Updated: <strong>{formatPhilippineDateTime(lastUpdatedAt)}</strong>
            </span>
          </div>

          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 font-semibold rounded-lg shadow-xs transition space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
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

      {/* =====================================================================
          MANAGER COMMAND DASHBOARD: DATE FILTERS & 12 SUMMARY CARDS
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
                </strong>
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

          {/* 12 Live Manager Summary Cards (One-Click Navigation) */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6 gap-3">
            {/* 1. Total Registered Personnel */}
            <div
              onClick={() => onNavigateToPersonnel?.()}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-500 uppercase">
                <span>Registered Staff</span>
                <Users className="w-3.5 h-3.5 text-slate-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-slate-900">
                {managerCommandMetrics.totalRegisteredPersonnel}
              </div>
              <div className="text-[10px] text-blue-700 mt-0.5 font-medium">Open Directory →</div>
            </div>

            {/* 2. Active Approved Personnel */}
            <div
              onClick={() => onNavigateToPersonnel?.()}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 uppercase">
                <span>Active Approved</span>
                <UserCheck className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-emerald-900">
                {managerCommandMetrics.activeApprovedPersonnel}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Authorized accounts</div>
            </div>

            {/* 3. Pending Account Approvals */}
            <div
              onClick={() => onOpenApprovals?.()}
              className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                managerCommandMetrics.pendingApprovals > 0
                  ? 'bg-amber-50 border-amber-300 hover:border-amber-500'
                  : 'bg-white border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 uppercase">
                <span>Pending Approvals</span>
                <Clock className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-amber-900">
                {managerCommandMetrics.pendingApprovals}
              </div>
              <div className="text-[10px] text-amber-800 mt-0.5 font-medium">Review Accounts →</div>
            </div>

            {/* 4. Total Active Tasks */}
            <div
              onClick={() => setStatusFilter('active')}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-blue-700 uppercase">
                <span>Active Tasks</span>
                <CheckSquare className="w-3.5 h-3.5 text-blue-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-slate-900">
                {managerCommandMetrics.totalActiveTasks}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Open in cohort</div>
            </div>

            {/* 5. Tasks Due Today */}
            <div
              onClick={() => setStatusFilter('due_today')}
              className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                managerCommandMetrics.dueToday > 0
                  ? 'bg-amber-50/70 border-amber-300'
                  : 'bg-white border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-800 uppercase">
                <span>Due Today</span>
                <Calendar className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-amber-900">
                {managerCommandMetrics.dueToday}
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5">PHT deadline today</div>
            </div>

            {/* 6. Overdue Tasks */}
            <div
              onClick={() => setStatusFilter('overdue')}
              className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                managerCommandMetrics.overdue > 0
                  ? 'bg-rose-50 border-rose-300'
                  : 'bg-white border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 uppercase">
                <span>Overdue Tasks</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-rose-900">
                {managerCommandMetrics.overdue}
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 font-medium">Filter Overdue →</div>
            </div>

            {/* 7. Tasks For Review */}
            <div
              onClick={() => setStatusFilter('for_review')}
              className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                managerCommandMetrics.forReview > 0
                  ? 'bg-indigo-50 border-indigo-300'
                  : 'bg-white border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-indigo-800 uppercase">
                <span>Tasks For Review</span>
                <Eye className="w-3.5 h-3.5 text-indigo-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-indigo-900">
                {managerCommandMetrics.forReview}
              </div>
              <div className="text-[10px] text-indigo-700 mt-0.5">Awaiting sign-off</div>
            </div>

            {/* 8. Completed Tasks */}
            <div
              onClick={() => setStatusFilter('completed')}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-emerald-700 uppercase">
                <span>Completed Tasks</span>
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-emerald-900">
                {managerCommandMetrics.completed}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Verified & closed</div>
            </div>

            {/* 9. Recognized Member Initiatives */}
            <div
              onClick={() => onNavigateToInitiatives?.()}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-amber-700 uppercase">
                <span>Recognized Init.</span>
                <Award className="w-3.5 h-3.5 text-amber-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-amber-900">
                {managerCommandMetrics.recognizedInitiatives}
              </div>
              <div className="text-[10px] text-amber-700 mt-0.5 font-medium">Open Initiatives →</div>
            </div>

            {/* 10. Returned for Revision */}
            <div
              onClick={() => setStatusFilter('returned')}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-700 uppercase">
                <span>Returned Revision</span>
                <RotateCcw className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-slate-900">
                {managerCommandMetrics.returnedForRevision}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">Tasks + initiatives</div>
            </div>

            {/* 11. Personnel Without Current Assignments */}
            <div
              onClick={() => onNavigateToPersonnel?.()}
              className="p-3.5 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-blue-400 transition cursor-pointer"
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-slate-600 uppercase">
                <span>Unassigned Staff</span>
                <UserX className="w-3.5 h-3.5 text-slate-500" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-slate-900">
                {managerCommandMetrics.personnelWithoutAssignmentsList.length}
              </div>
              <div className="text-[10px] text-slate-400 mt-0.5">No open tasks</div>
            </div>

            {/* 12. Personnel With Overdue Assignments */}
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
              className={`p-3.5 rounded-xl border shadow-xs transition cursor-pointer ${
                managerCommandMetrics.personnelWithOverdueList.length > 0
                  ? 'bg-rose-50/70 border-rose-300'
                  : 'bg-white border-slate-200 hover:border-blue-400'
              }`}
            >
              <div className="flex items-center justify-between text-[11px] font-semibold text-rose-800 uppercase">
                <span>Staff w/ Overdue</span>
                <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
              </div>
              <div className="mt-1.5 text-2xl font-bold text-rose-900">
                {managerCommandMetrics.personnelWithOverdueList.length}
              </div>
              <div className="text-[10px] text-rose-700 mt-0.5 font-medium">Review Staff →</div>
            </div>
          </div>

          {/* DEPARTMENT PERFORMANCE OVERVIEW */}
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 text-xs">
            {/* Column 1: KPI Rates & Monthly Trends */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900">Department Performance Overview</h2>
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
                  <div className="text-base font-bold text-slate-900 mt-0.5">
                    {managerCommandMetrics.completionRate.display}
                  </div>
                </div>
                <div className="p-3 bg-emerald-50/70 border border-emerald-200 rounded-lg">
                  <span className="text-[10px] text-emerald-800 uppercase font-bold block">
                    On-Time Completion
                  </span>
                  <div className="text-base font-bold text-emerald-900 mt-0.5">
                    {managerCommandMetrics.onTimeRate.display}
                  </div>
                </div>
              </div>

              <div className="space-y-2 pt-1">
                <div className="text-[11px] font-bold text-slate-700 uppercase">
                  Monthly Operational Trend (Completed / Overdue / Review / Initiatives)
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
                  const totalLoad = u.activeTasksCount + u.completedTasksCount;
                  const maxUnitLoad = Math.max(
                    1,
                    ...unitSummaries.map((x) => x.activeTasksCount + x.completedTasksCount)
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
                          {u.activeUsersCount} Staff • {u.activeTasksCount} Active
                        </span>
                      </div>
                      <div className="w-full h-2 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="bg-blue-700 h-full"
                          style={{ width: `${(totalLoad / maxUnitLoad) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Completed: {u.completedTasksCount}</span>
                        <span className={u.overdueTasksCount > 0 ? 'text-rose-700 font-bold' : ''}>
                          Overdue: {u.overdueTasksCount}
                        </span>
                        <span>On-Time: {u.onTimeRate.display}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Column 3: Workload Distribution by Philippine Region */}
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-1.5">
                  <MapPin className="w-4 h-4 text-emerald-600" />
                  <span>Workload by Operating Region</span>
                </h2>
              </div>

              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                {regionalSummaries.map((r) => {
                  const totalRegTasks = r.activeTasksCount + r.completedTasksCount;
                  const maxReg = Math.max(
                    1,
                    ...regionalSummaries.map((x) => x.activeTasksCount + x.completedTasksCount)
                  );
                  return (
                    <div
                      key={r.region.id}
                      onClick={() => onNavigateToPersonnel?.()}
                      className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg hover:border-blue-300 cursor-pointer transition space-y-1"
                    >
                      <div className="flex items-center justify-between font-semibold text-slate-900">
                        <span>{r.region.name}</span>
                        <span className="text-[11px] text-slate-600">
                          {r.activeTasksCount} Active • {r.completedTasksCount} Done
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-slate-200 rounded-full overflow-hidden">
                        <div
                          className="bg-emerald-600 h-full"
                          style={{ width: `${(totalRegTasks / maxReg) * 100}%` }}
                        />
                      </div>
                      <div className="flex justify-between text-[10px] text-slate-500">
                        <span>Staff: {r.assignedPersonnelCount}</span>
                        <span>Shift Logs: {r.activitiesCount}</span>
                        <span className={r.overdueTasksCount > 0 ? 'text-rose-700 font-bold' : ''}>
                          Overdue: {r.overdueTasksCount}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
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

      {/* Manager Specific: Quick Initiatives for Review Alert */}
      {isManager &&
        initiatives.filter(
          (i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted'
        ).length > 0 && (
          <div className="p-4 bg-amber-50/90 border border-amber-300 rounded-xl space-y-3 shadow-xs">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <Lightbulb className="w-4 h-4 text-amber-700" />
                <h3 className="font-bold text-xs uppercase tracking-wider text-amber-900">
                  Initiatives Awaiting Manager Review (
                  {
                    initiatives.filter(
                      (i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted'
                    ).length
                  }
                  )
                </h3>
              </div>
              {onNavigateToInitiatives && (
                <button
                  type="button"
                  onClick={onNavigateToInitiatives}
                  className="text-xs font-semibold text-blue-800 hover:underline cursor-pointer"
                >
                  View All Reviews →
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
              {initiatives
                .filter(
                  (i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted'
                )
                .slice(0, 4)
                .map((item) => (
                  <div
                    key={item.id}
                    onClick={() => onSelectInitiative?.(item)}
                    className="p-3 bg-white border border-amber-200 rounded-lg text-xs hover:border-blue-400 hover:shadow-xs transition cursor-pointer flex items-center justify-between"
                  >
                    <div className="space-y-0.5 truncate pr-2">
                      <div className="font-semibold text-slate-900 truncate">{item.title}</div>
                      <div className="text-[11px] text-slate-500">
                        By {item.submitted_by_name} • {item.region} •{' '}
                        <span className="font-medium text-amber-800 capitalize">
                          {item.status.replace(/_/g, ' ')}
                        </span>
                      </div>
                    </div>
                    <span className="text-[11px] font-semibold text-blue-700 hover:underline whitespace-nowrap">
                      Review →
                    </span>
                  </div>
                ))}
            </div>
          </div>
        )}

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
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
              onClick={onNavigateToTasks}
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
    </div>
  );
};
