import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  formatPhilippineDate,
  getDueStatusLabel,
  getPhilippineToday,
} from '../lib/dateUtils.ts';
import { INITIATIVE_CATEGORIES } from '../lib/initiativeConstants.ts';
import {
  computePersonnelPerformance,
  computeUnitPerformanceSummaries,
  computeRegionalPerformanceSummaries,
  computeMonthlyTrendBuckets,
  getDateRangeForPreset,
  isTaskInReportingCohort,
  isWithinDateWindow,
} from '../lib/performanceUtils.ts';
import {
  Download,
  Printer,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  Copy,
  Check,
  Award,
  Building2,
  MapPin,
  Users,
  TrendingUp,
  UserCheck,
  Info,
} from 'lucide-react';

interface ReportsViewProps {
  onOpenPrintView: () => void;
  onOpenPrintIndividualReport?: (userId: string, fromDate: string, toDate: string) => void;
  onViewPersonnelPerformance?: (userId: string) => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({
  onOpenPrintView,
  onOpenPrintIndividualReport,
  onViewPersonnelPerformance,
}) => {
  const { isManager, currentUser, allProfiles } = useAuth();
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
  } = useData();

  // Date range presets (default: This Month in Asia/Manila)
  const today = getPhilippineToday();
  const [fromDate, setFromDate] = useState<string>(() => getDateRangeForPreset('month').fromDate);
  const [toDate, setToDate] = useState<string>(() => getDateRangeForPreset('month').toDate);

  // Individual Personnel Selector (for Managers)
  const [selectedPersonId, setSelectedPersonId] = useState<string>('');

  // AI Narrative state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);

  // Set preset ranges
  const handlePreset = (type: 'today' | 'week' | 'month' | 'quarter' | 'all') => {
    if (type === 'all') {
      setFromDate('2025-01-01');
      setToDate('2027-12-31');
      return;
    }
    const range = getDateRangeForPreset(type);
    setFromDate(range.fromDate);
    setToDate(range.toDate);
  };

  const sourceTasks = isManager ? allDepartmentTasks : tasks;
  const sourceInitiatives = isManager ? allDepartmentInitiatives : initiatives;

  // Filtered records in range
  const filteredTasks = useMemo(() => {
    return sourceTasks.filter((t) => isTaskInReportingCohort(t, fromDate, toDate));
  }, [sourceTasks, fromDate, toDate]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => isWithinDateWindow(a.activity_date, fromDate, toDate));
  }, [activities, fromDate, toDate]);

  const recognizedInitiatives = useMemo(() => {
    return sourceInitiatives.filter(
      (i) =>
        i.status === 'recognized' &&
        Boolean(i.recognized_at) &&
        isWithinDateWindow(i.recognized_at, fromDate, toDate)
    );
  }, [sourceInitiatives, fromDate, toDate]);

  const filteredInitiatives = useMemo(() => {
    return sourceInitiatives.filter(
      (i) =>
        i.status !== 'draft' &&
        isWithinDateWindow(i.activity_date || i.created_at, fromDate, toDate)
    );
  }, [sourceInitiatives, fromDate, toDate]);

  const pendingInitiatives = useMemo(() => {
    return sourceInitiatives.filter(
      (i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted'
    );
  }, [sourceInitiatives]);

  const returnedInitiatives = useMemo(() => {
    return sourceInitiatives.filter((i) => i.status === 'returned');
  }, [sourceInitiatives]);

  // Recognized Initiatives by Member Leaderboard
  const recognizedByMember = useMemo(() => {
    const map: Record<string, { name: string; email: string; count: number; latest: string }> = {};
    for (const item of recognizedInitiatives) {
      const key = item.submitted_by;
      if (!map[key]) {
        map[key] = {
          name: item.submitted_by_name || 'Member',
          email: item.submitted_by_email || '',
          count: 0,
          latest: item.title,
        };
      }
      map[key].count += 1;
    }
    return Object.values(map).sort((a, b) => b.count - a.count);
  }, [recognizedInitiatives]);

  // Recognized Initiatives by Region
  const recognizedByRegion = useMemo(() => {
    const map: Record<string, number> = {};
    for (const item of recognizedInitiatives) {
      map[item.region] = (map[item.region] || 0) + 1;
    }
    return Object.entries(map)
      .map(([region, count]) => ({ region, count }))
      .sort((a, b) => b.count - a.count);
  }, [recognizedInitiatives]);

  // Initiative Categories & Trends
  const categoriesBreakdown = useMemo(() => {
    const map: Record<string, { total: number; recognized: number }> = {};
    for (const cat of INITIATIVE_CATEGORIES) {
      map[cat] = { total: 0, recognized: 0 };
    }
    for (const item of filteredInitiatives) {
      if (!map[item.category]) map[item.category] = { total: 0, recognized: 0 };
      map[item.category].total += 1;
      if (item.status === 'recognized') {
        map[item.category].recognized += 1;
      }
    }
    return Object.entries(map)
      .map(([category, stats]) => ({ category, ...stats }))
      .filter((x) => x.total > 0 || x.recognized > 0);
  }, [filteredInitiatives]);

  // Task groupings
  const pendingTasks = useMemo(() => {
    return filteredTasks.filter(
      (t) => t.status === 'assigned' || t.status === 'in_progress' || t.status === 'returned'
    );
  }, [filteredTasks]);

  const overdueTasks = useMemo(() => {
    return filteredTasks.filter((t) => getDueStatusLabel(t.due_date, t.status).isOverdue);
  }, [filteredTasks]);

  const completedTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === 'completed');
  }, [filteredTasks]);

  const forReviewTasks = useMemo(() => {
    return filteredTasks.filter((t) => t.status === 'for_review');
  }, [filteredTasks]);

  // Profiles lookup
  const profilesById = useMemo(() => {
    const map: Record<string, (typeof allProfiles)[number]> = {};
    for (const p of allProfiles) map[p.id] = p;
    if (currentUser && !map[currentUser.id]) map[currentUser.id] = currentUser;
    return map;
  }, [allProfiles, currentUser]);

  // Personnel Performance Records
  const personnelRecords = useMemo(() => {
    const targetProfiles = isManager
      ? allProfiles.filter((p) => p.approved)
      : currentUser
      ? [currentUser]
      : [];

    return targetProfiles
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
      )
      .sort((a, b) => a.user.display_name.localeCompare(b.user.display_name));
  }, [
    isManager,
    allProfiles,
    currentUser,
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

  // Team / Unit Performance Summaries (Managers only)
  const unitSummaries = useMemo(() => {
    if (!isManager) return [];
    return computeUnitPerformanceSummaries({
      units: organizationalUnits,
      personnelRecords,
    });
  }, [isManager, organizationalUnits, personnelRecords]);

  // Regional Performance Summaries (Managers only — preserves historical task/activity/initiative regions)
  const regionalSummaries = useMemo(() => {
    if (!isManager) return [];
    return computeRegionalPerformanceSummaries({
      regions: operatingRegions,
      personnelRecords,
      tasks: sourceTasks,
      taskUpdates,
      activities,
      initiatives: sourceInitiatives,
      fromDate,
      toDate,
    });
  }, [
    isManager,
    operatingRegions,
    personnelRecords,
    sourceTasks,
    taskUpdates,
    activities,
    sourceInitiatives,
    fromDate,
    toDate,
  ]);

  // 4-Month Trend Buckets
  const monthlyTrends = useMemo(() => {
    return computeMonthlyTrendBuckets({
      tasks: sourceTasks,
      initiatives: sourceInitiatives,
      monthsCount: 4,
    });
  }, [sourceTasks, sourceInitiatives]);

  // Selected individual for preview card
  const selectedIndividualRecord = useMemo(() => {
    if (!isManager) return personnelRecords[0] || null;
    if (!selectedPersonId) return personnelRecords[0] || null;
    return personnelRecords.find((r) => r.user.id === selectedPersonId) || personnelRecords[0] || null;
  }, [isManager, selectedPersonId, personnelRecords]);

  // CSV Export Handlers
  const downloadCSV = (filename: string, headers: string[], rows: string[][]) => {
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportTasksCSV = () => {
    const headers = [
      'Task ID',
      'Title',
      'Category',
      'Assigned To',
      'Region',
      'Due Date (PHT)',
      'Priority',
      'Status',
      'Progress %',
      'Created At',
      'Completed At',
      'Remarks',
    ];
    const rows = filteredTasks.map((t) => [
      `"${t.id}"`,
      `"${t.title.replace(/"/g, '""')}"`,
      `"${t.category}"`,
      `"${(t.assigned_user_name || '').replace(/"/g, '""')}"`,
      `"${t.region.replace(/"/g, '""')}"`,
      `"${t.due_date}"`,
      `"${t.priority}"`,
      `"${t.status}"`,
      `"${t.progress_percent || 0}"`,
      `"${t.created_at}"`,
      `"${t.completed_at || ''}"`,
      `"${(t.remarks || '').replace(/"/g, '""')}"`,
    ]);
    downloadCSV(`SOH_Tasks_Report_${fromDate}_to_${toDate}.csv`, headers, rows);
  };

  const handleExportActivitiesCSV = () => {
    const headers = [
      'Activity ID',
      'Activity Date',
      'Title',
      'Description',
      'Region',
      'Author',
      'Linked Task',
      'Remarks',
      'Created At',
    ];
    const rows = filteredActivities.map((a) => [
      `"${a.id}"`,
      `"${a.activity_date}"`,
      `"${a.title.replace(/"/g, '""')}"`,
      `"${a.description.replace(/"/g, '""')}"`,
      `"${(a.region || '').replace(/"/g, '""')}"`,
      `"${(a.author_name || '').replace(/"/g, '""')}"`,
      `"${(a.linked_task_title || '').replace(/"/g, '""')}"`,
      `"${(a.remarks || '').replace(/"/g, '""')}"`,
      `"${a.created_at}"`,
    ]);
    downloadCSV(`SOH_Activities_Report_${fromDate}_to_${toDate}.csv`, headers, rows);
  };

  const handleExportInitiativesCSV = () => {
    const headers = [
      'Initiative ID',
      'Title',
      'Type',
      'Category',
      'Submitted By',
      'Member Email',
      'Region',
      'Facility / Location',
      'Activity Date',
      'Status',
      'Recognized At',
      'Reviewed By',
      'Concern / Description',
      'Action Taken / Proposed',
      'Expected Outcome / Accomplishment',
      'Manager Remarks',
    ];
    const rows = filteredInitiatives.map((i) => [
      `"${i.id}"`,
      `"${i.title.replace(/"/g, '""')}"`,
      `"${i.initiative_type}"`,
      `"${i.category}"`,
      `"${(i.submitted_by_name || '').replace(/"/g, '""')}"`,
      `"${(i.submitted_by_email || '').replace(/"/g, '""')}"`,
      `"${i.region.replace(/"/g, '""')}"`,
      `"${(i.location || '').replace(/"/g, '""')}"`,
      `"${i.activity_date}"`,
      `"${i.status}"`,
      `"${i.recognized_at || ''}"`,
      `"${(i.reviewed_by_name || '').replace(/"/g, '""')}"`,
      `"${i.description.replace(/"/g, '""')}"`,
      `"${i.action_details.replace(/"/g, '""')}"`,
      `"${i.expected_outcome.replace(/"/g, '""')}"`,
      `"${(i.manager_remarks || '').replace(/"/g, '""')}"`,
    ]);
    downloadCSV(`SOH_Initiatives_Recognition_Report_${fromDate}_to_${toDate}.csv`, headers, rows);
  };

  const handleExportPerformanceCSV = () => {
    const headers = [
      'User UUID',
      'Display Name',
      'Email',
      'Unit',
      'Position',
      'Region',
      'Assigned Site',
      'Reports To',
      'Operational Status',
      'Tasks Assigned',
      'Active Tasks',
      'Overdue Tasks',
      'Completed Tasks',
      'Completion Rate',
      'On-Time Rate',
      'Daily Activities',
      'Recognized Initiatives',
      'Returned Events',
    ];
    const rows = personnelRecords.map((r) => [
      `"${r.user.id}"`,
      `"${r.user.display_name.replace(/"/g, '""')}"`,
      `"${r.user.email}"`,
      `"${(r.unit?.name || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(r.position?.title || (r.user.role === 'manager' ? 'Security Manager' : 'Unassigned')).replace(/"/g, '""')}"`,
      `"${(r.region?.name || r.user.regional_assignment || 'Unassigned').replace(/"/g, '""')}"`,
      `"${(r.assignment?.assigned_site || '').replace(/"/g, '""')}"`,
      `"${(r.supervisor?.name || 'None').replace(/"/g, '""')}"`,
      `"${r.assignment?.operational_status || (r.user.active ? 'active' : 'inactive')}"`,
      `"${r.totalAssignedTasks}"`,
      `"${r.activeTasksCount}"`,
      `"${r.overdueTasksCount}"`,
      `"${r.completedTasksCount}"`,
      `"${r.completionRate.display}"`,
      `"${r.onTimeRate.display}"`,
      `"${r.activitiesCount}"`,
      `"${r.recognizedInitiativesCount}"`,
      `"${r.returnedSubmissionsEvents}"`,
    ]);
    downloadCSV(`SOH_Personnel_Performance_${fromDate}_to_${toDate}.csv`, headers, rows);
  };

  // Generate AI Executive Narrative based ONLY on actual saved records
  const handleGenerateAiSummary = () => {
    setIsGeneratingAi(true);

    setTimeout(() => {
      const generated = `[OPERATIONAL SUMMARY BRIEF — Requires Security Manager Verification Before Official Distribution]

REPORTING TIMEFRAME: ${formatPhilippineDate(fromDate)} to ${formatPhilippineDate(toDate)}
AUTHORIZED USER: ${currentUser?.display_name || 'Department Manager'}
GENERATED ON: ${formatPhilippineDate(today)} (Philippine Standard Time)

1. EXECUTIVE OVERVIEW:
During this reporting cycle, Security Operations Hub tracked ${filteredTasks.length} task assignment(s), recorded ${filteredActivities.length} daily security shift log(s), and validated ${recognizedInitiatives.length} recognized proactive security initiative(s).

2. TASK DISPOSITION:
• Completed & Verified Tasks: ${completedTasks.length} task(s) signed off.
• Pending Manager Review: ${forReviewTasks.length} task(s) awaiting review.
• In-Progress / Active: ${pendingTasks.length} task(s) undergoing execution.
• Overdue Action Items: ${overdueTasks.length} task(s) requiring immediate follow-up.

3. MEMBER INITIATIVE & RECOGNITION:
• Officially Recognized Initiatives: ${recognizedInitiatives.length} validated proactive accomplishment(s).
• Pending Manager Evaluation: ${pendingInitiatives.length} submission(s) awaiting review.
• Returned for Revision: ${returnedInitiatives.length} initiative(s) undergoing clarification.

4. CRITICAL ATTENTION POINTS:
${
  overdueTasks.length > 0
    ? overdueTasks
        .map(
          (t) =>
            `• [OVERDUE] "${t.title}" at ${t.region} assigned to ${t.assigned_user_name || 'Officer'} (Due: ${t.due_date})`
        )
        .join('\n')
    : '• No overdue tasks identified within the selected timeframe.'
}

5. DAILY ACCOMPLISHMENTS HIGHLIGHT:
${
  filteredActivities.length > 0
    ? filteredActivities
        .slice(0, 4)
        .map(
          (a) =>
            `• [${a.activity_date} - ${a.region || 'Facility'}]: ${a.title} — Logged by ${a.author_name}`
        )
        .join('\n')
    : '• No daily shift logs recorded during this period.'
}

*** NOTE: Synthesized strictly from saved database entries. Operational metrics assist supervisory tracking and do not substitute formal HR performance reviews. ***`;

      setAiSummary(generated);
      setIsGeneratingAi(false);
    }, 450);
  };

  const handleCopyAiSummary = () => {
    if (aiSummary) {
      navigator.clipboard.writeText(aiSummary);
      setCopiedAi(true);
      setTimeout(() => setCopiedAi(false), 2000);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security Compliance & Performance Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Department, regional, unit, and individual accomplishment reports with CSV & printable PDF briefs
          </p>
        </div>

        {/* Action Buttons: CSV, Print */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportTasksCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Tasks (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportActivitiesCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Activities (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportInitiativesCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Initiatives (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportPerformanceCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
          >
            <Download className="w-3.5 h-3.5 text-amber-600" />
            <span>Export Performance (CSV)</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrintView}
            className="inline-flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Department Report</span>
          </button>
        </div>
      </div>

      {/* Date Range Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">Reporting Range (PHT):</span>
            <div className="flex items-center space-x-2">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white"
              />
              <span className="text-slate-400">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="px-2.5 py-1.5 border border-slate-300 rounded-lg text-slate-800 bg-white"
              />
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="text-slate-400">Presets:</span>
            {(
              [
                { id: 'today', label: 'Today' },
                { id: 'week', label: 'This Week' },
                { id: 'month', label: 'This Month' },
                { id: 'quarter', label: 'This Quarter' },
                { id: 'all', label: 'All Records' },
              ] as const
            ).map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => handlePreset(p.id)}
                className="px-2.5 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium cursor-pointer"
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Metrics Row in Date Range */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-slate-500 uppercase">Shift Activities</span>
          <div className="text-2xl font-bold text-slate-900 mt-1">{filteredActivities.length}</div>
          <span className="text-[11px] text-slate-400">In selected timeframe</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-amber-700 uppercase">Pending Tasks</span>
          <div className="text-2xl font-bold text-amber-900 mt-1">{pendingTasks.length}</div>
          <span className="text-[11px] text-amber-700/80">Assigned / In Progress</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-rose-700 uppercase">Overdue Tasks</span>
          <div className="text-2xl font-bold text-rose-900 mt-1">{overdueTasks.length}</div>
          <span className="text-[11px] text-rose-700/80">Requiring escalation</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs">
          <span className="text-xs font-semibold text-emerald-700 uppercase">Completed Tasks</span>
          <div className="text-2xl font-bold text-emerald-900 mt-1">{completedTasks.length}</div>
          <span className="text-[11px] text-emerald-700/80">Closed assignments</span>
        </div>

        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs col-span-2 sm:col-span-1">
          <span className="text-xs font-semibold text-indigo-800 uppercase flex items-center space-x-1">
            <Award className="w-3.5 h-3.5 text-indigo-600" />
            <span>Recognized Initiatives</span>
          </span>
          <div className="text-2xl font-bold text-indigo-900 mt-1">{recognizedInitiatives.length}</div>
          <span className="text-[11px] text-indigo-700/80">Proactive validated checks</span>
        </div>
      </div>

      {/* MANAGER-ONLY: DEPARTMENT, UNIT, REGIONAL & MONTHLY TREND REPORTS */}
      {isManager && (
        <div className="space-y-6">
          {/* Team / Unit Performance + Regional Performance */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {/* Team / Unit Performance Report */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <Building2 className="w-4 h-4 text-blue-700" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Team / Organizational Unit Performance
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Operational completion & on-time SLA across Security Department units
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2">Unit</th>
                      <th className="p-2 text-center">Staff</th>
                      <th className="p-2 text-center">Active</th>
                      <th className="p-2 text-center">Done</th>
                      <th className="p-2 text-center">Overdue</th>
                      <th className="p-2">Completion</th>
                      <th className="p-2">On-Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {unitSummaries.map((u) => (
                      <tr key={u.unit.id} className="hover:bg-slate-50">
                        <td className="p-2 font-semibold text-slate-900">
                          {u.unit.name}
                          <span className="ml-1 text-[10px] font-mono text-slate-400">({u.unit.code})</span>
                        </td>
                        <td className="p-2 text-center text-slate-700">{u.activeUsersCount}</td>
                        <td className="p-2 text-center text-slate-700">{u.activeTasksCount}</td>
                        <td className="p-2 text-center font-semibold text-emerald-700">{u.completedTasksCount}</td>
                        <td className="p-2 text-center font-semibold text-rose-700">{u.overdueTasksCount}</td>
                        <td className="p-2 font-mono text-slate-800">{u.completionRate.display}</td>
                        <td className="p-2 font-mono text-slate-800">{u.onTimeRate.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Philippine Regional Performance Report (Historical Attribution Preserved) */}
            <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div className="flex items-center space-x-2">
                  <MapPin className="w-4 h-4 text-emerald-700" />
                  <div>
                    <h3 className="font-bold text-sm text-slate-900">
                      Philippine Regional Performance Summary
                    </h3>
                    <p className="text-[11px] text-slate-500">
                      Grouped by each task, activity, & initiative&apos;s recorded operating region (historical integrity preserved)
                    </p>
                  </div>
                </div>
              </div>

              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2">Region</th>
                      <th className="p-2 text-center">Assigned</th>
                      <th className="p-2 text-center">Done</th>
                      <th className="p-2 text-center">Overdue</th>
                      <th className="p-2 text-center">Logs</th>
                      <th className="p-2">Completion</th>
                      <th className="p-2">On-Time</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {regionalSummaries.map((r) => (
                      <tr key={r.region.id} className="hover:bg-slate-50">
                        <td className="p-2 font-semibold text-slate-900">{r.region.name}</td>
                        <td className="p-2 text-center text-slate-700">{r.assignedPersonnelCount}</td>
                        <td className="p-2 text-center font-semibold text-emerald-700">{r.completedTasksCount}</td>
                        <td className="p-2 text-center font-semibold text-rose-700">{r.overdueTasksCount}</td>
                        <td className="p-2 text-center text-blue-700 font-medium">{r.activitiesCount}</td>
                        <td className="p-2 font-mono text-slate-800">{r.completionRate.display}</td>
                        <td className="p-2 font-mono text-slate-800">{r.onTimeRate.display}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Monthly Performance Trend Report */}
          <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
            <div className="flex items-center space-x-2 border-b border-slate-100 pb-3">
              <TrendingUp className="w-4 h-4 text-indigo-700" />
              <div>
                <h3 className="font-bold text-sm text-slate-900">
                  Monthly Performance Trend (Last 4 Months, PHT)
                </h3>
                <p className="text-xs text-slate-500">
                  Month-over-month verified task closures, overdue backlog, pending reviews, and recognized initiatives
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="p-2.5">Month</th>
                    <th className="p-2.5 text-center">Completed Tasks</th>
                    <th className="p-2.5 text-center">Overdue Tasks</th>
                    <th className="p-2.5 text-center">Pending Manager Review</th>
                    <th className="p-2.5 text-center">Recognized Initiatives</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {monthlyTrends.map((m) => (
                    <tr key={m.monthKey} className="hover:bg-slate-50">
                      <td className="p-2.5 font-semibold text-slate-900">{m.label}</td>
                      <td className="p-2.5 text-center font-bold text-emerald-700">{m.completedTasks}</td>
                      <td className="p-2.5 text-center font-bold text-rose-700">{m.overdueTasks}</td>
                      <td className="p-2.5 text-center font-semibold text-amber-700">{m.pendingReviews}</td>
                      <td className="p-2.5 text-center font-bold text-indigo-700">{m.recognizedInitiatives}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* INDIVIDUAL PERSONNEL ACCOMPLISHMENT REPORT */}
      <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center space-x-2">
            {isManager ? (
              <Users className="w-5 h-5 text-blue-700" />
            ) : (
              <UserCheck className="w-5 h-5 text-blue-700" />
            )}
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                {isManager
                  ? 'Individual Personnel Accomplishment & Performance Report'
                  : 'My Personal Accomplishment Report'}
              </h3>
              <p className="text-xs text-slate-500">
                {isManager
                  ? 'Inspect real task delivery, daily logs, and recognized initiatives per authorized officer'
                  : 'Your verified operational accomplishments within the selected reporting window'}
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {isManager && personnelRecords.length > 0 && (
              <select
                value={selectedIndividualRecord?.user.id || ''}
                onChange={(e) => setSelectedPersonId(e.target.value)}
                className="px-3 py-1.5 border border-slate-300 rounded-lg text-xs text-slate-800 bg-white"
              >
                {personnelRecords.map((rec) => (
                  <option key={rec.user.id} value={rec.user.id}>
                    {rec.user.display_name} ({rec.position?.title || rec.user.role})
                  </option>
                ))}
              </select>
            )}

            {selectedIndividualRecord && onOpenPrintIndividualReport && (
              <button
                type="button"
                onClick={() =>
                  onOpenPrintIndividualReport(selectedIndividualRecord.user.id, fromDate, toDate)
                }
                className="inline-flex items-center px-3 py-1.5 bg-blue-700 hover:bg-blue-800 text-white text-xs font-semibold rounded-lg transition space-x-1.5 cursor-pointer"
              >
                <Printer className="w-3.5 h-3.5" />
                <span>
                  {isManager ? 'Print Individual Report' : 'Print My Performance Report'}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Selected Personnel Highlight Card */}
        {selectedIndividualRecord && (
          <div className="p-4 bg-slate-50 border border-slate-200 rounded-xl grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 text-xs">
            <div className="col-span-2 sm:col-span-3 lg:col-span-2">
              <div className="font-bold text-slate-900 text-sm">
                {selectedIndividualRecord.user.display_name}
              </div>
              <div className="text-[11px] text-slate-500">
                {selectedIndividualRecord.position?.title ||
                  (selectedIndividualRecord.user.role === 'manager'
                    ? 'Security Manager'
                    : 'Security Team Member')}{' '}
                • {selectedIndividualRecord.unit?.name || 'Unassigned Unit'}
              </div>
              <div className="text-[11px] text-slate-500 mt-0.5">
                Region:{' '}
                {selectedIndividualRecord.region?.name ||
                  selectedIndividualRecord.user.regional_assignment ||
                  'Unassigned'}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Completion</span>
              <div className="font-bold text-slate-900 mt-0.5 font-mono">
                {selectedIndividualRecord.completionRate.display}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">On-Time SLA</span>
              <div className="font-bold text-emerald-800 mt-0.5 font-mono">
                {selectedIndividualRecord.onTimeRate.display}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Daily Logs</span>
              <div className="font-bold text-blue-800 mt-0.5">
                {selectedIndividualRecord.activitiesCount}
              </div>
            </div>
            <div>
              <span className="text-[10px] font-semibold text-slate-500 uppercase">Recognized</span>
              <div className="font-bold text-indigo-800 mt-0.5">
                {selectedIndividualRecord.recognizedInitiativesCount}
              </div>
            </div>
          </div>
        )}

        {/* Full Manager Personnel Performance Summary Table */}
        {isManager && personnelRecords.length > 0 && (
          <div className="overflow-x-auto border border-slate-200 rounded-lg">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                <tr>
                  <th className="p-2.5">Personnel</th>
                  <th className="p-2.5">Unit / Position</th>
                  <th className="p-2.5">Region</th>
                  <th className="p-2.5 text-center">Assigned</th>
                  <th className="p-2.5 text-center">Completed</th>
                  <th className="p-2.5 text-center">Overdue</th>
                  <th className="p-2.5">Completion Rate</th>
                  <th className="p-2.5">On-Time Rate</th>
                  <th className="p-2.5 text-center">Logs</th>
                  <th className="p-2.5 text-center">Recognized</th>
                  <th className="p-2.5 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-[11px]">
                {personnelRecords.map((rec) => (
                  <tr key={rec.user.id} className="hover:bg-slate-50">
                    <td className="p-2.5 font-semibold text-slate-900">
                      {rec.user.display_name}
                      <span className="block text-[10px] font-normal text-slate-400">
                        {rec.user.email}
                      </span>
                    </td>
                    <td className="p-2.5 text-slate-700">
                      <div>{rec.position?.title || (rec.user.role === 'manager' ? 'Security Manager' : 'Unassigned')}</div>
                      <div className="text-[10px] text-slate-400">{rec.unit?.name || 'Unassigned Unit'}</div>
                    </td>
                    <td className="p-2.5 text-slate-600">
                      {rec.region?.name || rec.user.regional_assignment || 'Unassigned'}
                    </td>
                    <td className="p-2.5 text-center text-slate-800">{rec.totalAssignedTasks}</td>
                    <td className="p-2.5 text-center font-semibold text-emerald-700">
                      {rec.completedTasksCount}
                    </td>
                    <td className="p-2.5 text-center font-semibold text-rose-700">
                      {rec.overdueTasksCount}
                    </td>
                    <td className="p-2.5 font-mono text-slate-800">{rec.completionRate.display}</td>
                    <td className="p-2.5 font-mono text-slate-800">{rec.onTimeRate.display}</td>
                    <td className="p-2.5 text-center text-blue-700 font-semibold">
                      {rec.activitiesCount}
                    </td>
                    <td className="p-2.5 text-center text-indigo-700 font-semibold">
                      {rec.recognizedInitiativesCount}
                    </td>
                    <td className="p-2.5 text-right whitespace-nowrap space-x-1">
                      {onViewPersonnelPerformance && (
                        <button
                          type="button"
                          onClick={() => onViewPersonnelPerformance(rec.user.id)}
                          className="px-2 py-1 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded font-medium cursor-pointer"
                        >
                          Profile
                        </button>
                      )}
                      {onOpenPrintIndividualReport && (
                        <button
                          type="button"
                          onClick={() =>
                            onOpenPrintIndividualReport(rec.user.id, fromDate, toDate)
                          }
                          className="px-2 py-1 bg-blue-50 hover:bg-blue-100 text-blue-800 rounded font-medium cursor-pointer"
                        >
                          Print
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* AI Narrative Assistant Card */}
      <div className="bg-gradient-to-r from-slate-900 via-slate-800 to-blue-950 p-5 rounded-xl border border-slate-700 text-white shadow-md space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center space-x-2">
            <Sparkles className="w-5 h-5 text-amber-400 flex-shrink-0" />
            <div>
              <h3 className="font-bold text-sm tracking-tight text-white">
                Draft Executive Narrative Summary
              </h3>
              <p className="text-xs text-slate-300">
                Synthesize audit summaries from actual saved records. Manager verification required.
              </p>
            </div>
          </div>

          <button
            type="button"
            onClick={handleGenerateAiSummary}
            disabled={isGeneratingAi}
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition space-x-1.5 self-start sm:self-auto disabled:opacity-50 cursor-pointer"
          >
            <Sparkles className="w-3.5 h-3.5 text-amber-300" />
            <span>{isGeneratingAi ? 'Synthesizing...' : 'Draft Narrative Brief'}</span>
          </button>
        </div>

        {aiSummary && (
          <div className="mt-3 p-4 bg-slate-950/80 border border-slate-700 rounded-lg text-xs space-y-2">
            <div className="flex items-center justify-between text-amber-400 font-semibold border-b border-slate-800 pb-2">
              <div className="flex items-center space-x-1.5">
                <AlertCircle className="w-4 h-4 text-amber-400" />
                <span>OPERATIONAL SUMMARY DRAFT — FOR MANAGER REVIEW</span>
              </div>
              <button
                type="button"
                onClick={handleCopyAiSummary}
                className="text-slate-300 hover:text-white flex items-center space-x-1 text-xs cursor-pointer"
              >
                {copiedAi ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                <span>{copiedAi ? 'Copied' : 'Copy Text'}</span>
              </button>
            </div>
            <pre className="font-sans whitespace-pre-wrap text-slate-200 text-xs leading-relaxed max-h-72 overflow-y-auto">
              {aiSummary}
            </pre>
          </div>
        )}
      </div>

      {/* Structured Sections */}
      <div className="space-y-6">
        {/* Section 1: Overdue Tasks Alert */}
        {overdueTasks.length > 0 && (
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-rose-900 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>Overdue Assignments Report ({overdueTasks.length}) — Action Required</span>
            </h3>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-rose-100/60 text-rose-900 font-semibold border-b border-rose-200">
                  <tr>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Assigned Personnel</th>
                    <th className="px-3 py-2">Facility / Site</th>
                    <th className="px-3 py-2">Due Date</th>
                    <th className="px-3 py-2">Status</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-rose-100">
                  {overdueTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-rose-100/30">
                      <td className="px-3 py-2 font-medium text-slate-900">{t.title}</td>
                      <td className="px-3 py-2 text-slate-700">{t.assigned_user_name}</td>
                      <td className="px-3 py-2 text-slate-600">{t.region}</td>
                      <td className="px-3 py-2 font-bold text-rose-800">{formatPhilippineDate(t.due_date)}</td>
                      <td className="px-3 py-2 capitalize font-semibold">{t.status.replace('_', ' ')}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Section 2: Daily Activity Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Daily Activity Summary ({filteredActivities.length})
              </h3>
              <p className="text-xs text-slate-500">
                Shift logs, guard mounts, and patrols conducted during the selected timeframe
              </p>
            </div>
          </div>

          {filteredActivities.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No shift activities recorded in this date range.</p>
          ) : (
            <div className="space-y-2.5">
              {filteredActivities.slice(0, 10).map((act) => (
                <div key={act.id} className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs space-y-1">
                  <div className="flex items-center justify-between font-semibold text-slate-800">
                    <span>{act.title}</span>
                    <span className="text-[11px] text-slate-500 font-normal">
                      {formatPhilippineDate(act.activity_date)} • {act.region}
                    </span>
                  </div>
                  <p className="text-slate-600 leading-relaxed">{act.description}</p>
                  <div className="text-[10px] text-slate-400">Logged by {act.author_name}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Section 3: Completed Tasks Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-3">
          <div className="flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-sm text-slate-900">
                Completed & Verified Tasks ({completedTasks.length})
              </h3>
              <p className="text-xs text-slate-500">Officially approved and closed security tasks</p>
            </div>
          </div>

          {completedTasks.length === 0 ? (
            <p className="text-xs text-slate-400 italic py-2">No tasks closed in this date range.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 font-semibold border-b border-slate-200">
                  <tr>
                    <th className="px-3 py-2">Task</th>
                    <th className="px-3 py-2">Category</th>
                    <th className="px-3 py-2">Assigned Personnel</th>
                    <th className="px-3 py-2">Facility Site</th>
                    <th className="px-3 py-2">Closed Date</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {completedTasks.map((t) => (
                    <tr key={t.id} className="hover:bg-slate-50/50">
                      <td className="px-3 py-2 font-medium text-slate-900">{t.title}</td>
                      <td className="px-3 py-2 text-slate-600">{t.category}</td>
                      <td className="px-3 py-2 text-slate-700">{t.assigned_user_name}</td>
                      <td className="px-3 py-2 text-slate-600">{t.region}</td>
                      <td className="px-3 py-2 text-emerald-700 font-semibold">
                        {formatPhilippineDate(t.completed_at || t.updated_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Section 4: Member Initiative & Activity Recognition Summary */}
        <div className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs space-y-5">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 border-b border-slate-100 pb-3">
            <div>
              <div className="flex items-center space-x-2">
                <Award className="w-5 h-5 text-indigo-700" />
                <h3 className="font-bold text-sm text-slate-900">
                  Initiative Recognition Report ({recognizedInitiatives.length} Officially Recognized)
                </h3>
              </div>
              <p className="text-xs text-slate-500 mt-0.5">
                Proactive security checks and self-initiated accomplishments validated by Security Management within this period
              </p>
            </div>
            <span className="text-[11px] font-semibold text-indigo-900 bg-indigo-50 border border-indigo-200 px-2.5 py-1 rounded-full self-start sm:self-auto">
              Period Recognition
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
            {/* Table A: Recognized Initiatives by Member */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                <span>Recognized Initiatives by Member</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {recognizedByMember.length} contributor(s)
                </span>
              </div>

              {recognizedByMember.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">
                  No recognized initiatives recorded in this timeframe.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2.5">Personnel</th>
                      <th className="p-2.5 text-center">Recognized Total</th>
                      <th className="p-2.5">Latest Validated Title</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {recognizedByMember.map((m, idx) => (
                      <tr key={m.email || idx} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">
                          {m.name}
                          <span className="block text-[10px] text-slate-400 font-normal">{m.email}</span>
                        </td>
                        <td className="p-2.5 text-center font-bold text-indigo-700">
                          <span className="bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-full">
                            {m.count}
                          </span>
                        </td>
                        <td className="p-2.5 text-slate-700 truncate max-w-[160px]" title={m.latest}>
                          {m.latest}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>

            {/* Table B: Recognized Initiatives by Region */}
            <div className="border border-slate-200 rounded-xl overflow-hidden">
              <div className="px-4 py-2.5 bg-slate-50 font-bold text-slate-800 border-b border-slate-200 flex items-center justify-between">
                <span>Recognized Initiatives by Region / Site</span>
                <span className="text-[11px] text-slate-500 font-normal">
                  {recognizedByRegion.length} region(s)
                </span>
              </div>

              {recognizedByRegion.length === 0 ? (
                <div className="p-4 text-center text-slate-400 italic">
                  No regional initiative distributions recorded.
                </div>
              ) : (
                <table className="w-full text-left">
                  <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2.5">Regional Site</th>
                      <th className="p-2.5 text-right">Recognized Total</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {recognizedByRegion.map((r) => (
                      <tr key={r.region} className="hover:bg-slate-50">
                        <td className="p-2.5 font-medium text-slate-800">{r.region}</td>
                        <td className="p-2.5 text-right font-bold text-emerald-700">
                          <span className="bg-emerald-50 border border-emerald-200 px-2 py-0.5 rounded-full">
                            {r.count}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Table C: Initiative Categories & Trends */}
          <div className="border border-slate-200 rounded-xl overflow-hidden text-xs">
            <div className="px-4 py-2.5 bg-slate-50 font-bold text-slate-800 border-b border-slate-200">
              Initiative Categories & Validation Trends
            </div>
            {categoriesBreakdown.length === 0 ? (
              <div className="p-4 text-center text-slate-400 italic">
                No initiative submissions in this timeframe.
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5 text-center">Total Submitted</th>
                      <th className="p-2.5 text-center">Officially Recognized</th>
                      <th className="p-2.5 text-right">Validation Rate</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {categoriesBreakdown.map((c) => {
                      const rate = c.total > 0 ? Math.round((c.recognized / c.total) * 100) : 0;
                      return (
                        <tr key={c.category} className="hover:bg-slate-50">
                          <td className="p-2.5 font-medium text-slate-900">{c.category}</td>
                          <td className="p-2.5 text-center text-slate-700">{c.total}</td>
                          <td className="p-2.5 text-center font-bold text-emerald-700">{c.recognized}</td>
                          <td className="p-2.5 text-right font-mono font-medium text-slate-800">{rate}%</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Detailed Roster of Recognized Accomplishments */}
          <div className="space-y-2">
            <h4 className="text-xs font-bold text-slate-800 uppercase tracking-wider">
              Validated Initiative Accomplishments ({recognizedInitiatives.length})
            </h4>
            {recognizedInitiatives.length === 0 ? (
              <p className="text-xs text-slate-400 italic">No recognized initiatives in this date range.</p>
            ) : (
              <div className="overflow-x-auto border border-slate-200 rounded-lg">
                <table className="w-full text-left text-xs">
                  <thead className="bg-slate-50 text-slate-700 font-semibold border-b border-slate-200 text-[11px]">
                    <tr>
                      <th className="p-2.5">Initiative Title</th>
                      <th className="p-2.5">Category</th>
                      <th className="p-2.5">Contributor</th>
                      <th className="p-2.5">Facility / Site</th>
                      <th className="p-2.5">Validation Date</th>
                      <th className="p-2.5">Manager Commendation</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-[11px]">
                    {recognizedInitiatives.map((i) => (
                      <tr key={i.id} className="hover:bg-slate-50">
                        <td className="p-2.5 font-semibold text-slate-900">{i.title}</td>
                        <td className="p-2.5 text-slate-600">{i.category}</td>
                        <td className="p-2.5 text-slate-800 font-medium">{i.submitted_by_name}</td>
                        <td className="p-2.5 text-slate-600">
                          {i.location ? `${i.location} (${i.region})` : i.region}
                        </td>
                        <td className="p-2.5 font-semibold text-emerald-800">
                          {formatPhilippineDate(i.recognized_at || i.updated_at)}
                        </td>
                        <td className="p-2.5 text-slate-700 max-w-xs truncate" title={i.manager_remarks}>
                          {i.manager_remarks || 'Validated and signed off.'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Governance Notice */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-relaxed flex items-start space-x-2">
            <Info className="w-4 h-4 text-slate-400 flex-shrink-0 mt-0.5" />
            <div>
              <strong>Corporate Governance Disclaimer:</strong> Operational performance statistics, completion rates, and initiative recognition counts are maintained strictly to assist supervisory tracking, workload balancing, and compliance governance. They do not constitute automated HR performance appraisals, disciplinary findings, or financial incentives.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
