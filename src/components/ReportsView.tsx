import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Task, SecurityActivity, MemberInitiative } from '../types/index.ts';
import { formatPhilippineDate, getDueStatusLabel, getPhilippineToday } from '../lib/dateUtils.ts';
import { TASK_STATUS_CONFIG } from '../lib/philippinesRegions.ts';
import { INITIATIVE_CATEGORIES } from '../lib/initiativeConstants.ts';
import {
  BarChart3,
  Download,
  Printer,
  Sparkles,
  Calendar,
  CheckCircle2,
  AlertTriangle,
  Clock,
  FileText,
  AlertCircle,
  Copy,
  Check,
  Award,
  Lightbulb,
  ShieldCheck,
  RotateCcw,
} from 'lucide-react';

interface ReportsViewProps {
  onOpenPrintView: () => void;
}

export const ReportsView: React.FC<ReportsViewProps> = ({ onOpenPrintView }) => {
  const { isManager, currentUser } = useAuth();
  const { tasks, activities, initiatives } = useData();

  // Date range presets
  const today = getPhilippineToday();
  const [fromDate, setFromDate] = useState<string>(() => {
    const d = new Date();
    d.setDate(d.getDate() - 14);
    return d.toISOString().split('T')[0];
  });
  const [toDate, setToDate] = useState<string>(today);

  // AI Narrative state
  const [aiSummary, setAiSummary] = useState<string | null>(null);
  const [isGeneratingAi, setIsGeneratingAi] = useState(false);
  const [copiedAi, setCopiedAi] = useState(false);

  // Set preset ranges
  const handlePreset = (type: 'today' | 'week' | 'month' | 'all') => {
    const now = new Date();
    if (type === 'today') {
      setFromDate(today);
      setToDate(today);
    } else if (type === 'week') {
      const pastWeek = new Date();
      pastWeek.setDate(now.getDate() - 7);
      setFromDate(pastWeek.toISOString().split('T')[0]);
      setToDate(today);
    } else if (type === 'month') {
      const pastMonth = new Date();
      pastMonth.setDate(now.getDate() - 30);
      setFromDate(pastMonth.toISOString().split('T')[0]);
      setToDate(today);
    } else if (type === 'all') {
      setFromDate('2026-01-01');
      setToDate('2026-12-31');
    }
  };

  // Filtered records in range
  const filteredTasks = useMemo(() => {
    return tasks.filter((t) => {
      const taskDate = t.due_date || t.created_at.split('T')[0];
      return taskDate >= fromDate && taskDate <= toDate;
    });
  }, [tasks, fromDate, toDate]);

  const filteredActivities = useMemo(() => {
    return activities.filter((a) => {
      return a.activity_date >= fromDate && a.activity_date <= toDate;
    });
  }, [activities, fromDate, toDate]);

  // Initiative Recognition Metrics in reporting timeframe
  // Note: An initiative is officially counted as recognized when status is 'recognized'
  // and its final manager recognition date falls within the selected period.
  const recognizedInitiatives = useMemo(() => {
    return initiatives.filter((i) => {
      if (i.status !== 'recognized' || !i.recognized_at) return false;
      const recDate = i.recognized_at.split('T')[0];
      return recDate >= fromDate && recDate <= toDate;
    });
  }, [initiatives, fromDate, toDate]);

  const filteredInitiatives = useMemo(() => {
    return initiatives.filter((i) => {
      const initDate = i.activity_date || i.created_at.split('T')[0];
      return initDate >= fromDate && initDate <= toDate;
    });
  }, [initiatives, fromDate, toDate]);

  const pendingInitiatives = useMemo(() => {
    return initiatives.filter((i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted');
  }, [initiatives]);

  const returnedInitiatives = useMemo(() => {
    return initiatives.filter((i) => i.status === 'returned');
  }, [initiatives]);

  const rejectedInitiatives = useMemo(() => {
    return initiatives.filter((i) => i.status === 'rejected');
  }, [initiatives]);

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
    return filteredTasks.filter((t) => t.status === 'assigned' || t.status === 'in_progress' || t.status === 'returned');
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

  // CSV Export Handlers
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOH_Tasks_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOH_Activities_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
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

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map((e) => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `SOH_Initiatives_Recognition_Report_${fromDate}_to_${toDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Generate AI Executive Narrative based ONLY on actual saved records
  const handleGenerateAiSummary = () => {
    setIsGeneratingAi(true);

    // Formulate structured summary from actual records
    setTimeout(() => {
      const generated = `[AI-DRAFTED EXECUTIVE BRIEFING — Requires Security Manager Verification & Formal Review Before Official Distribution]

REPORTING TIMEFRAME: ${formatPhilippineDate(fromDate)} to ${formatPhilippineDate(toDate)}
AUTHORIZED SECURITY MANAGER: ${currentUser?.display_name || 'Department Manager'}
GENERATED ON: ${formatPhilippineDate(today)} (Philippine Standard Time)

1. EXECUTIVE OVERVIEW:
During this reporting cycle, the Security Operations department tracked ${filteredTasks.length} regional task assignments, recorded ${filteredActivities.length} daily security shift activities, and recognized ${recognizedInitiatives.length} proactive member security initiatives across Philippine corporate facilities.

2. TASK DISPOSITION:
• Completed & Verified Tasks: ${completedTasks.length} task(s) signed off by Security Management.
• Pending Manager Review: ${forReviewTasks.length} task(s) awaiting managerial review.
• In-Progress / Active: ${pendingTasks.length} task(s) undergoing physical inspection or audit.
• Overdue Action Items: ${overdueTasks.length} task(s) requiring immediate supervisor follow-up.

3. MEMBER INITIATIVE & RECOGNITION:
• Officially Recognized Initiatives: ${recognizedInitiatives.length} validated proactive accomplishment(s).
• Pending Manager Evaluation: ${pendingInitiatives.length} proposal(s) or accomplishments awaiting review.
• Returned for Revision: ${returnedInitiatives.length} initiative(s) undergoing member clarification.

4. CRITICAL ATTENTION POINTS:
${
  overdueTasks.length > 0
    ? overdueTasks.map((t) => `• [OVERDUE] "${t.title}" at ${t.region} assigned to ${t.assigned_user_name || 'Officer'} (Due: ${t.due_date})`).join('\n')
    : '• No overdue tasks identified within the selected timeframe. Department SLA standards maintained.'
}

5. DAILY ACCOMPLISHMENTS HIGHLIGHT:
${
  filteredActivities.length > 0
    ? filteredActivities.slice(0, 4).map((a) => `• [${a.activity_date} - ${a.region || 'Facility'}]: ${a.title} — Conducted by ${a.author_name}`).join('\n')
    : '• No daily shift logs recorded during this period.'
}

6. COMPLIANCE & NEXT STEPS:
Field personnel contributions must continue to adhere to corporate physical security safeguards. Manager recognition certifies operational verification.

*** NOTE: This narrative was synthesized from recorded database entries. Security Manager review is required prior to external executive dissemination. ***`;

      setAiSummary(generated);
      setIsGeneratingAi(false);
    }, 800);
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
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security Compliance & Operations Reports
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Audit-ready activity summaries, task tracking metrics, CSV exports, and printable briefs
          </p>
        </div>

        {/* Action Buttons: CSV, Print, AI */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={handleExportTasksCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
            title="Download CSV spreadsheet of filtered security tasks"
          >
            <Download className="w-3.5 h-3.5 text-blue-600" />
            <span>Export Tasks (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportActivitiesCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
            title="Download CSV spreadsheet of daily shift activities"
          >
            <Download className="w-3.5 h-3.5 text-emerald-600" />
            <span>Export Activities (CSV)</span>
          </button>

          <button
            type="button"
            onClick={handleExportInitiativesCSV}
            className="inline-flex items-center px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
            title="Download CSV spreadsheet of member initiatives and recognition"
          >
            <Download className="w-3.5 h-3.5 text-indigo-600" />
            <span>Export Initiatives (CSV)</span>
          </button>

          <button
            type="button"
            onClick={onOpenPrintView}
            className="inline-flex items-center px-3 py-2 bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold rounded-lg shadow-xs transition space-x-1.5"
            title="Open official print-friendly report for printing or PDF save"
          >
            <Printer className="w-3.5 h-3.5 text-blue-400" />
            <span>Print Report</span>
          </button>
        </div>
      </div>

      {/* Date Range Controls */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs">
          <div className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-slate-700">Reporting Range:</span>
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

          {/* Presets */}
          <div className="flex items-center space-x-1.5">
            <span className="text-slate-400">Presets:</span>
            <button
              type="button"
              onClick={() => handlePreset('today')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
            >
              Today
            </button>
            <button
              type="button"
              onClick={() => handlePreset('week')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => handlePreset('month')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
            >
              This Month
            </button>
            <button
              type="button"
              onClick={() => handlePreset('all')}
              className="px-2 py-1 bg-slate-100 hover:bg-slate-200 rounded text-slate-700 font-medium"
            >
              All Records
            </button>
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
            className="inline-flex items-center px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold rounded-lg shadow-sm transition space-x-1.5 self-start sm:self-auto disabled:opacity-50"
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
                <span>AI-DRAFTED SUMMARY — FOR MANAGER REVIEW ONLY</span>
              </div>
              <button
                type="button"
                onClick={handleCopyAiSummary}
                className="text-slate-300 hover:text-white flex items-center space-x-1 text-xs"
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

      {/* Structured Sections (Daily Activity Summary, Weekly Accomplishments, Pending, Overdue, Completed) */}
      <div className="space-y-6">
        {/* Section 1: Overdue Tasks Alert (if any) */}
        {overdueTasks.length > 0 && (
          <div className="bg-rose-50/70 border border-rose-200 rounded-xl p-5 shadow-xs space-y-3">
            <h3 className="font-bold text-sm text-rose-900 flex items-center space-x-2">
              <AlertTriangle className="w-4 h-4 text-rose-700" />
              <span>Overdue Tasks ({overdueTasks.length}) — Action Required</span>
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
                  <div className="text-[10px] text-slate-400">
                    Logged by {act.author_name}
                  </div>
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
              <p className="text-xs text-slate-500">
                Officially approved and closed security tasks
              </p>
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
                  Member Initiative & Recognition Summary ({recognizedInitiatives.length} Officially Recognized)
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

          {/* Leaderboard and Regional Breakdown in 2 Columns */}
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
                        <td className="p-2.5 text-slate-600">{i.location ? `${i.location} (${i.region})` : i.region}</td>
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
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg text-[11px] text-slate-500 leading-relaxed">
            <strong>Corporate Governance Disclaimer:</strong> Initiative recognition is an administrative reporting indicator acknowledging proactive physical security vigilance and permitted routine verifications. It is maintained for corporate operations governance and does not constitute an automatic performance appraisal rating, disciplinary finding, or financial incentive.
          </div>
        </div>
      </div>
    </div>
  );
};
