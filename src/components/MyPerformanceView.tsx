import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  Task,
  MemberInitiative,
  DateRangePreset,
} from '../types/index.ts';
import {
  formatPhilippineDate,
  formatPhilippineDateTime,
  getDueStatusLabel,
  getPhilippineToday,
} from '../lib/dateUtils.ts';
import {
  computePersonnelPerformance,
  computeMonthlyTrendBuckets,
  getDateRangeForPreset,
} from '../lib/performanceUtils.ts';
import { TASK_STATUS_CONFIG } from '../lib/philippinesRegions.ts';
import { INITIATIVE_STATUS_CONFIG } from '../lib/initiativeConstants.ts';
import {
  TrendingUp,
  User,
  GitBranch,
  Building2,
  MapPin,
  CheckSquare,
  AlertTriangle,
  Clock,
  RotateCcw,
  Award,
  CheckCircle2,
  Printer,
  RefreshCw,
  Calendar,
  MessageSquare,
  Lightbulb,
  Info,
  ArrowRight,
} from 'lucide-react';

interface MyPerformanceViewProps {
  onSelectTask: (task: Task) => void;
  onSelectInitiative: (initiative: MemberInitiative) => void;
  onOpenPrintPersonalReport: (fromDate: string, toDate: string) => void;
}

export const MyPerformanceView: React.FC<MyPerformanceViewProps> = ({
  onSelectTask,
  onSelectInitiative,
  onOpenPrintPersonalReport,
}) => {
  const { currentUser } = useAuth();
  const {
    tasks,
    taskUpdates,
    activities,
    initiatives,
    initiativeHistory,
    organizationalUnits,
    positions,
    operatingRegions,
    assignmentsByUserId,
    mySupervisor,
    lastUpdatedAt,
    realtimeStatus,
    refreshData,
  } = useData();

  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => getDateRangeForPreset('month').fromDate);
  const [customTo, setCustomTo] = useState<string>(() => getDateRangeForPreset('month').toDate);
  const [refreshing, setRefreshing] = useState(false);

  const { fromDate, toDate } = useMemo(() => {
    if (preset === 'custom') return { fromDate: customFrom, toDate: customTo };
    return getDateRangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  const personalRecord = useMemo(() => {
    if (!currentUser) return null;
    return computePersonnelPerformance({
      user: currentUser,
      assignment: assignmentsByUserId[currentUser.id] || null,
      units: organizationalUnits,
      positions,
      regions: operatingRegions,
      profilesById: { [currentUser.id]: currentUser },
      assignmentsById: assignmentsByUserId,
      tasks,
      taskUpdates,
      activities,
      initiatives,
      initiativeHistory,
      fromDate,
      toDate,
    });
  }, [
    currentUser,
    assignmentsByUserId,
    organizationalUnits,
    positions,
    operatingRegions,
    tasks,
    taskUpdates,
    activities,
    initiatives,
    initiativeHistory,
    fromDate,
    toDate,
  ]);

  const monthlyTrends = useMemo(
    () =>
      computeMonthlyTrendBuckets({
        tasks,
        initiatives,
        monthsCount: 4,
      }),
    [tasks, initiatives]
  );

  // Needs Attention calculations
  const overdueTasks = useMemo(
    () => tasks.filter((t) => getDueStatusLabel(t.due_date, t.status).isOverdue),
    [tasks]
  );

  const approachingTasks = useMemo(() => {
    const today = getPhilippineToday();
    const d = new Date(`${today}T00:00:00+08:00`);
    d.setDate(d.getDate() + 3);
    const threeDaysStr = d.toISOString().split('T')[0];
    return tasks.filter(
      (t) =>
        t.status !== 'completed' &&
        t.due_date >= today &&
        t.due_date <= threeDaysStr
    );
  }, [tasks]);

  const returnedTasks = useMemo(
    () => tasks.filter((t) => t.status === 'returned'),
    [tasks]
  );

  const returnedInitiatives = useMemo(
    () => initiatives.filter((i) => i.status === 'returned'),
    [initiatives]
  );

  const upcomingDeadlines = useMemo(() => {
    return tasks
      .filter((t) => t.status !== 'completed')
      .sort((a, b) => a.due_date.localeCompare(b.due_date))
      .slice(0, 6);
  }, [tasks]);

  const recentCompletedTasks = useMemo(
    () =>
      tasks
        .filter((t) => t.status === 'completed')
        .sort((a, b) =>
          (b.completed_at || b.updated_at).localeCompare(a.completed_at || a.updated_at)
        )
        .slice(0, 5),
    [tasks]
  );

  const recognizedInitiatives = useMemo(
    () => initiatives.filter((i) => i.status === 'recognized'),
    [initiatives]
  );

  const latestManagerFeedback = useMemo(() => {
    const items: { id: string; title: string; note: string; date: string; kind: 'task' | 'initiative'; ref: any }[] = [];

    for (const t of tasks) {
      for (const u of taskUpdates[t.id] || []) {
        if (u.author_role === 'manager' || u.manager_feedback) {
          items.push({
            id: u.id,
            title: t.title,
            note: u.manager_feedback || u.progress_note,
            date: u.created_at,
            kind: 'task',
            ref: t,
          });
        }
      }
    }

    for (const i of initiatives) {
      if (i.manager_remarks && i.reviewed_at) {
        items.push({
          id: i.id,
          title: i.title,
          note: i.manager_remarks,
          date: i.reviewed_at,
          kind: 'initiative',
          ref: i,
        });
      }
    }

    return items.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  }, [tasks, taskUpdates, initiatives]);

  if (!currentUser || !personalRecord) return null;

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const needsAttentionCount =
    overdueTasks.length +
    approachingTasks.length +
    returnedTasks.length +
    returnedInitiatives.length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight flex items-center space-x-2">
            <TrendingUp className="w-6 h-6 text-blue-700" />
            <span>My Performance & Operational Summary</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Personal workload progress, deadlines, manager feedback, and verified accomplishments (Philippine Time)
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center space-x-2 text-slate-600">
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              Updated: <strong>{formatPhilippineDateTime(lastUpdatedAt)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 transition space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          <button
            type="button"
            onClick={() => onOpenPrintPersonalReport(fromDate, toDate)}
            className="inline-flex items-center px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-white font-semibold rounded-lg transition space-x-1.5 cursor-pointer"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print My Summary</span>
          </button>
        </div>
      </div>

      {/* My Profile, Supervisor & Assigned Region/Unit Banner */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs p-5 grid grid-cols-1 md:grid-cols-3 gap-4 text-xs">
        <div className="flex items-start space-x-3">
          <div className="w-11 h-11 rounded-full bg-blue-700 text-white font-bold text-base flex items-center justify-center flex-shrink-0">
            {currentUser.display_name.charAt(0).toUpperCase()}
          </div>
          <div>
            <span className="text-[10px] uppercase font-bold text-slate-400 block">My Profile</span>
            <div className="font-bold text-slate-900 text-sm">{currentUser.display_name}</div>
            <div className="text-slate-500 font-mono text-[11px]">{currentUser.email}</div>
            <div className="mt-1 inline-block text-[10px] font-semibold bg-blue-50 text-blue-800 px-2 py-0.5 rounded border border-blue-200">
              {personalRecord.position?.title || 'Security Team Member'}
            </div>
          </div>
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
            <GitBranch className="w-3 h-3 text-amber-600" />
            <span>My Immediate Supervisor</span>
          </span>
          {mySupervisor ? (
            <>
              <div className="font-bold text-slate-900 text-sm">{mySupervisor.supervisor_name}</div>
              <div className="text-slate-600">{mySupervisor.position_title}</div>
              <div className="text-[11px] text-slate-500">{mySupervisor.unit_name}</div>
            </>
          ) : (
            <div className="text-slate-500 italic">
              Reports directly to Corporate Security Management
            </div>
          )}
        </div>

        <div className="border-t md:border-t-0 md:border-l border-slate-200 pt-3 md:pt-0 md:pl-4 space-y-1">
          <span className="text-[10px] uppercase font-bold text-slate-400 flex items-center space-x-1">
            <Building2 className="w-3 h-3 text-blue-600" />
            <span>Assigned Unit & Operating Region</span>
          </span>
          <div className="font-bold text-slate-900 text-sm">
            {personalRecord.unit?.name || 'Regional Security Operations'}
          </div>
          <div className="text-slate-600 flex items-center space-x-1">
            <MapPin className="w-3.5 h-3.5 text-emerald-600" />
            <span>
              {personalRecord.region?.name || currentUser.regional_assignment || 'NCR - Metro Manila'}
              {personalRecord.assignment?.assigned_site
                ? ` • ${personalRecord.assignment.assigned_site}`
                : ''}
            </span>
          </div>
        </div>
      </div>

      {/* Period Filter Strip */}
      <div className="bg-white p-3.5 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 text-xs">
        <span className="font-semibold text-slate-700">
          Reporting Period: {formatPhilippineDate(fromDate)} to {formatPhilippineDate(toDate)}
        </span>
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
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'quarter' ? 'This Quarter' : p}
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

      {/* Empty State Banner if new user */}
      {!personalRecord.hasAnyHistory && (
        <div className="p-4 bg-blue-50 border border-blue-200 rounded-xl flex items-start space-x-3 text-xs text-blue-900">
          <Info className="w-5 h-5 text-blue-700 flex-shrink-0 mt-0.5" />
          <div>
            <div className="font-bold">Welcome to Security Operations Hub</div>
            <p className="mt-0.5">
              You currently have no assigned tasks or historical logs in this reporting period. Metrics display <strong>No Data</strong> until tasks or activities are recorded.
            </p>
          </div>
        </div>
      )}

      {/* Personal KPI Grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5 text-xs">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-slate-500 font-semibold uppercase text-[11px]">Total Assigned</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{personalRecord.totalAssignedTasks}</div>
          <span className="text-[11px] text-slate-400">
            Active: {personalRecord.activeTasksCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-emerald-700 font-semibold uppercase text-[11px]">Completed</span>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{personalRecord.completedTasksCount}</div>
          <span className="text-[11px] text-emerald-700">
            Rate: {personalRecord.completionRate.display}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-blue-700 font-semibold uppercase text-[11px]">Completed On Time</span>
          <div className="text-2xl font-bold text-blue-900 mt-1">{personalRecord.onTimeRate.display}</div>
          <span className="text-[11px] text-slate-400">Closed ≤ due date (PHT)</span>
        </div>

        <div
          className={`p-4 rounded-xl border shadow-xs ${
            personalRecord.overdueTasksCount > 0 || personalRecord.returnedTasksCount > 0
              ? 'bg-rose-50/70 border-rose-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <span className="text-rose-800 font-semibold uppercase text-[11px]">Overdue / Returned</span>
          <div className="text-2xl font-bold text-rose-900 mt-1">
            {personalRecord.overdueTasksCount} / {personalRecord.returnedTasksCount}
          </div>
          <span className="text-[11px] text-rose-700">
            Pending Review: {personalRecord.forReviewCount}
          </span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-amber-700 font-semibold uppercase text-[11px] flex items-center space-x-1">
            <Award className="w-3.5 h-3.5" />
            <span>My Initiatives</span>
          </span>
          <div className="text-2xl font-bold text-amber-900 mt-1">
            {personalRecord.recognizedInitiativesCount}{' '}
            <span className="text-xs font-normal text-slate-500">
              Recognized / {personalRecord.totalInitiativesCount} Submitted
            </span>
          </div>
          <span className="text-[11px] text-slate-400">Manager-validated checks</span>
        </div>
      </div>

      {/* Visual Progress Bars + Function-Specific Indicators */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-xs">
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-4">
          <h2 className="font-bold text-sm text-slate-900">Progress Indicators & Monthly Trend</h2>
          <div className="space-y-3">
            <div>
              <div className="flex justify-between mb-1 font-medium text-slate-700">
                <span>Task Completion Progress</span>
                <span className="font-bold">{personalRecord.completionRate.display}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-blue-600 h-full transition-all"
                  style={{ width: `${personalRecord.completionRate.percentage ?? 0}%` }}
                />
              </div>
            </div>

            <div>
              <div className="flex justify-between mb-1 font-medium text-slate-700">
                <span>On-Time Delivery Indicator</span>
                <span className="font-bold text-emerald-700">{personalRecord.onTimeRate.display}</span>
              </div>
              <div className="w-full bg-slate-100 h-2.5 rounded-full overflow-hidden border border-slate-200">
                <div
                  className="bg-emerald-600 h-full transition-all"
                  style={{ width: `${personalRecord.onTimeRate.percentage ?? 0}%` }}
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-4 gap-2 pt-2">
            {monthlyTrends.map((b) => (
              <div key={b.monthKey} className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg text-center">
                <div className="font-bold text-slate-700 text-[11px]">{b.label}</div>
                <div className="text-sm font-bold text-emerald-700 mt-1">{b.completedTasks} Done</div>
                <div className="text-[10px] text-amber-700">{b.recognizedInitiatives} Recog.</div>
              </div>
            ))}
          </div>
        </div>

        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h2 className="font-bold text-sm text-slate-900">
            Role-Specific Operational Summary ({personalRecord.position?.title || 'Field Operations'})
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {personalRecord.functionIndicators.map((ind) => (
              <div key={ind.label} className="p-3 bg-slate-50 border border-slate-200 rounded-lg">
                <div className="text-[11px] text-slate-500 font-medium">{ind.label}</div>
                <div className="text-base font-bold text-slate-900 mt-1">{ind.value}</div>
                <div className="text-[10px] text-slate-400 mt-1">{ind.detail}</div>
              </div>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 pt-1">
            Operational indicators reflect recorded workload activity and do not represent automated disciplinary or appraisal scores.
          </p>
        </div>
      </div>

      {/* NEEDS ATTENTION SECTION */}
      <div
        className={`rounded-xl border p-5 space-y-3 text-xs ${
          needsAttentionCount > 0
            ? 'bg-rose-50/60 border-rose-200'
            : 'bg-emerald-50/50 border-emerald-200'
        }`}
      >
        <div className="flex items-center justify-between">
          <h2
            className={`font-bold text-sm flex items-center space-x-2 ${
              needsAttentionCount > 0 ? 'text-rose-900' : 'text-emerald-900'
            }`}
          >
            {needsAttentionCount > 0 ? (
              <AlertTriangle className="w-4 h-4 text-rose-600" />
            ) : (
              <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            )}
            <span>Needs Attention ({needsAttentionCount})</span>
          </h2>
          <span className="text-[11px] text-slate-500">
            Overdue tasks, approaching deadlines (next 3 days), and returned submissions
          </span>
        </div>

        {needsAttentionCount === 0 ? (
          <p className="text-emerald-800">
            All assigned tasks and initiatives are up to date with no overdue or returned items.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {overdueTasks.map((t) => (
              <div
                key={`ov-${t.id}`}
                onClick={() => onSelectTask(t)}
                className="p-3 bg-white border border-rose-300 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
              >
                <div className="truncate pr-2">
                  <span className="text-[10px] font-bold uppercase text-rose-700 block">
                    Overdue Task
                  </span>
                  <div className="font-bold text-slate-900 truncate">{t.title}</div>
                  <div className="text-[11px] text-slate-500">
                    Due {formatPhilippineDate(t.due_date)} • {t.region}
                  </div>
                </div>
                <ArrowRight className="w-4 h-4 text-rose-600 flex-shrink-0" />
              </div>
            ))}

            {returnedTasks.map((t) => (
              <div
                key={`ret-${t.id}`}
                onClick={() => onSelectTask(t)}
                className="p-3 bg-white border border-amber-300 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
              >
                <div className="truncate pr-2">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">
                    Task Returned for Correction
                  </span>
                  <div className="font-bold text-slate-900 truncate">{t.title}</div>
                  <div className="text-[11px] text-slate-500">
                    Manager Remarks: {t.remarks || 'Open task to view revision instructions'}
                  </div>
                </div>
                <RotateCcw className="w-4 h-4 text-amber-700 flex-shrink-0" />
              </div>
            ))}

            {returnedInitiatives.map((init) => (
              <div
                key={`iret-${init.id}`}
                onClick={() => onSelectInitiative(init)}
                className="p-3 bg-white border border-amber-300 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
              >
                <div className="truncate pr-2">
                  <span className="text-[10px] font-bold uppercase text-amber-800 block">
                    Returned Member Initiative
                  </span>
                  <div className="font-bold text-slate-900 truncate">{init.title}</div>
                  <div className="text-[11px] text-slate-500">
                    {init.manager_remarks || 'Needs clarification or additional detail'}
                  </div>
                </div>
                <Lightbulb className="w-4 h-4 text-amber-700 flex-shrink-0" />
              </div>
            ))}

            {approachingTasks
              .filter((t) => !overdueTasks.some((ov) => ov.id === t.id))
              .map((t) => (
                <div
                  key={`app-${t.id}`}
                  onClick={() => onSelectTask(t)}
                  className="p-3 bg-white border border-blue-200 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
                >
                  <div className="truncate pr-2">
                    <span className="text-[10px] font-bold uppercase text-blue-700 block">
                      Approaching Deadline ({getDueStatusLabel(t.due_date, t.status).label})
                    </span>
                    <div className="font-bold text-slate-900 truncate">{t.title}</div>
                    <div className="text-[11px] text-slate-500">
                      Due {formatPhilippineDate(t.due_date)}
                    </div>
                  </div>
                  <Clock className="w-4 h-4 text-blue-600 flex-shrink-0" />
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom 3-Column Section: Recent Accomplishments, Latest Manager Feedback, Upcoming Deadlines */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 text-xs">
        {/* Recent Accomplishments */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>Recent Accomplishments</span>
          </h3>
          {recentCompletedTasks.length === 0 && recognizedInitiatives.length === 0 ? (
            <p className="text-slate-400 italic py-2">No completed accomplishments yet.</p>
          ) : (
            <div className="space-y-2">
              {recognizedInitiatives.slice(0, 3).map((init) => (
                <div
                  key={init.id}
                  onClick={() => onSelectInitiative(init)}
                  className="p-2.5 bg-amber-50/70 border border-amber-200 rounded-lg cursor-pointer hover:border-amber-400"
                >
                  <div className="text-[10px] font-bold text-amber-800 uppercase">
                    Recognized Initiative
                  </div>
                  <div className="font-semibold text-slate-900">{init.title}</div>
                  <div className="text-[10px] text-slate-500">
                    Validated {formatPhilippineDate(init.recognized_at || init.updated_at)}
                  </div>
                </div>
              ))}
              {recentCompletedTasks.map((t) => (
                <div
                  key={t.id}
                  onClick={() => onSelectTask(t)}
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400"
                >
                  <div className="font-semibold text-slate-900">{t.title}</div>
                  <div className="text-[10px] text-emerald-700 font-medium">
                    Completed {formatPhilippineDate(t.completed_at || t.updated_at)} • {t.region}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Latest Manager Feedback */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <MessageSquare className="w-4 h-4 text-blue-600" />
            <span>Latest Manager Feedback</span>
          </h3>
          {latestManagerFeedback.length === 0 ? (
            <p className="text-slate-400 italic py-2">No manager review comments recorded yet.</p>
          ) : (
            <div className="space-y-2">
              {latestManagerFeedback.map((fb) => (
                <div
                  key={fb.id}
                  onClick={() =>
                    fb.kind === 'task' ? onSelectTask(fb.ref) : onSelectInitiative(fb.ref)
                  }
                  className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400"
                >
                  <div className="font-semibold text-slate-900 truncate">{fb.title}</div>
                  <p className="text-slate-700 mt-0.5 line-clamp-2">{fb.note}</p>
                  <div className="text-[10px] text-slate-400 mt-0.5">
                    {formatPhilippineDateTime(fb.date)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Upcoming Deadlines */}
        <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
          <h3 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
            <Calendar className="w-4 h-4 text-amber-600" />
            <span>Upcoming Deadlines</span>
          </h3>
          {upcomingDeadlines.length === 0 ? (
            <p className="text-slate-400 italic py-2">No Current Tasks with upcoming deadlines.</p>
          ) : (
            <div className="space-y-2">
              {upcomingDeadlines.map((t) => {
                const dueInfo = getDueStatusLabel(t.due_date, t.status);
                const cfg = TASK_STATUS_CONFIG[t.status] || TASK_STATUS_CONFIG.assigned;
                return (
                  <div
                    key={t.id}
                    onClick={() => onSelectTask(t)}
                    className="p-2.5 bg-slate-50 border border-slate-200 rounded-lg cursor-pointer hover:border-blue-400 flex items-center justify-between"
                  >
                    <div className="truncate pr-2">
                      <div className="font-semibold text-slate-900 truncate">{t.title}</div>
                      <div className="text-[10px] text-slate-500">
                        Due {formatPhilippineDate(t.due_date)} • {cfg.label}
                      </div>
                    </div>
                    <span
                      className={`text-[10px] font-bold px-2 py-0.5 rounded whitespace-nowrap ${
                        dueInfo.isOverdue
                          ? 'bg-rose-100 text-rose-800'
                          : dueInfo.isToday
                          ? 'bg-amber-100 text-amber-800'
                          : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      {dueInfo.label}
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
