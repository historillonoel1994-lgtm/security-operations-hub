/**
 * Performance Calculation & Hierarchy Utilities for Security Operations Hub (SOH)
 *
 * Documented Calculation & Reconciliation Rules:
 * 1. Timezone: All business dates and due-date comparisons use Asia/Manila (UTC+8).
 *    UTC timestamps (completed_at, updated_at, recognized_at) are converted to
 *    Asia/Manila YYYY-MM-DD before evaluating timeliness.
 * 2. Insufficient Data Standard:
 *    Whenever a denominator <= 0 or no records exist for a metric, `computeKpiFraction`
 *    returns `percentage: null` and `display: "N/A"`. Never fabricates 0% or 100%.
 * 3. Task Completion Rate:
 *    Completed tasks in cohort / total tasks in cohort.
 * 4. On-Time Completion Rate:
 *    Completed tasks with due_date where manilaDate(completed_at || updated_at) <= due_date
 *    divided by completed tasks with due_date. Reopened tasks have completed_at = null
 *    and status != 'completed', so they are automatically excluded.
 * 5. Overdue Reconciliation (Zero-Discrepancy Rule):
 *    - Currently Overdue Tasks: ALL open tasks (status != 'completed') with due_date < today (PHT),
 *      regardless of reporting window. Used consistently across Executive Cards, Staff w/ Overdue,
 *      Personnel Directory, Units, and Regions so totals always reconcile cleanly.
 *    - Became Overdue During Period: Open overdue tasks whose due_date falls in [fromDate, toDate].
 *    - Historical Overdue: Open overdue tasks whose due_date < fromDate.
 *    - Completed Late in Period: Completed in [fromDate, toDate] after due_date.
 * 6. Recognized Initiatives:
 *    Strictly initiatives with status === 'recognized' AND valid recognized_at timestamp.
 * 7. Position-Specific Operational Weights (Non-Appraisal):
 *    Uses configured `performance_targets` (matching position_id first, then unit_id, then defaults)
 *    to compute a transparent, non-punitive Operational Index with full formula disclosure.
 * 8. Historical Region Preservation:
 *    Regional performance aggregates tasks, activities, and initiatives by each record's own
 *    recorded `region` field rather than the user's current `personnel_assignments.region_id`.
 */

import {
  UserProfile,
  Task,
  TaskUpdate,
  SecurityActivity,
  MemberInitiative,
  InitiativeHistory,
  OrganizationalUnit,
  OrganizationalPosition,
  OperatingRegion,
  PersonnelAssignment,
  PerformanceTarget,
  DateRangePreset,
  KpiFraction,
  KpiFormulaBreakdown,
  OperationalIndexSummary,
  FunctionIndicator,
  PersonnelPerformanceRecord,
  UnitPerformanceSummary,
  RegionalPerformanceSummary,
} from '../types/index.ts';
import { getPhilippineToday, isTaskDueToday, isTaskOverdue } from './dateUtils.ts';
import {
  DEFAULT_PERFORMANCE_TARGETS,
  resolveOperatingRegionId,
} from './orgDefaults.ts';

/**
 * Converts a UTC ISO timestamp (or YYYY-MM-DD) into an Asia/Manila YYYY-MM-DD date string.
 */
export function toPhilippineDateString(isoOrDate?: string | null): string | null {
  if (!isoOrDate) return null;
  if (/^\d{4}-\d{2}-\d{2}$/.test(isoOrDate)) return isoOrDate;
  try {
    const dt = new Date(isoOrDate);
    if (Number.isNaN(dt.getTime())) return null;
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(dt);
  } catch {
    return null;
  }
}

/**
 * Computes startDate & endDate (YYYY-MM-DD in Asia/Manila) for reporting presets.
 */
export function getDateRangeForPreset(preset: DateRangePreset): {
  fromDate: string;
  toDate: string;
} {
  const today = getPhilippineToday();
  const baseDate = new Date(`${today}T00:00:00+08:00`);

  if (preset === 'today') {
    return { fromDate: today, toDate: today };
  }

  if (preset === 'week') {
    const d = new Date(baseDate);
    const dayOfWeek = d.getDay(); // 0=Sun, 1=Mon
    const diffToMon = dayOfWeek === 0 ? 6 : dayOfWeek - 1;
    d.setDate(d.getDate() - diffToMon);
    return {
      fromDate: toPhilippineDateString(d.toISOString()) || today,
      toDate: today,
    };
  }

  if (preset === 'month') {
    const [yyyy, mm] = today.split('-');
    return { fromDate: `${yyyy}-${mm}-01`, toDate: today };
  }

  if (preset === 'quarter') {
    const [yyyy, mmStr] = today.split('-');
    const month = parseInt(mmStr, 10);
    const quarterStartMonth = Math.floor((month - 1) / 3) * 3 + 1;
    const qMonthStr = String(quarterStartMonth).padStart(2, '0');
    return { fromDate: `${yyyy}-${qMonthStr}-01`, toDate: today };
  }

  const d = new Date(baseDate);
  d.setDate(d.getDate() - 30);
  return {
    fromDate: toPhilippineDateString(d.toISOString()) || today,
    toDate: today,
  };
}

/**
 * Counts inclusive calendar/operating days between fromDate and toDate (capped sensibly at >= 1).
 */
export function countDaysInRange(fromDate?: string, toDate?: string): number {
  if (!fromDate || !toDate) return 30;
  try {
    const start = new Date(`${fromDate}T00:00:00+08:00`);
    const end = new Date(`${toDate}T00:00:00+08:00`);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end < start) return 1;
    const diffDays = Math.floor((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, diffDays);
  } catch {
    return 1;
  }
}

/**
 * Builds a transparent fraction KPI showing numerator, denominator, and percentage or "N/A".
 */
export function computeKpiFraction(numerator: number, denominator: number): KpiFraction {
  if (denominator <= 0) {
    return {
      numerator: 0,
      denominator: 0,
      percentage: null,
      display: 'N/A',
    };
  }
  const pct = Math.round((numerator / denominator) * 100);
  return {
    numerator,
    denominator,
    percentage: pct,
    display: `${pct}% (${numerator}/${denominator})`,
  };
}

/**
 * Checks whether assigning `proposedSupervisorId` as supervisor for `userId`
 * would create self-supervision or a circular reporting chain.
 */
export function wouldCreateReportingCycle(
  userId: string,
  proposedSupervisorId: string | null | undefined,
  assignmentsMap: Record<string, PersonnelAssignment>
): boolean {
  if (!proposedSupervisorId) return false;
  if (proposedSupervisorId === userId) return true;

  const visited = new Set<string>([userId]);
  let cursor: string | null | undefined = proposedSupervisorId;
  let steps = 0;

  while (cursor && steps < 50) {
    if (visited.has(cursor)) return true;
    visited.add(cursor);
    cursor = assignmentsMap[cursor]?.reports_to_user_id;
    steps += 1;
  }

  return false;
}

/**
 * Filter records consistently by Philippine date window.
 */
export function isWithinDateWindow(
  dateStr: string | null | undefined,
  fromDate?: string,
  toDate?: string
): boolean {
  if (!fromDate || !toDate) return true;
  if (!dateStr) return false;
  const manilaDate = toPhilippineDateString(dateStr);
  if (!manilaDate) return false;
  return manilaDate >= fromDate && manilaDate <= toDate;
}

/**
 * Checks whether a task belongs to the selected reporting cohort window:
 * due_date in [fromDate, toDate], OR completed_at in [fromDate, toDate], OR created_at in [fromDate, toDate].
 */
export function isTaskInReportingCohort(
  task: Task,
  fromDate?: string,
  toDate?: string
): boolean {
  if (!fromDate || !toDate) return true;
  const dueIn = task.due_date >= fromDate && task.due_date <= toDate;
  const completedManila = toPhilippineDateString(task.completed_at);
  const completedIn = completedManila
    ? completedManila >= fromDate && completedManila <= toDate
    : false;
  const createdManila = toPhilippineDateString(task.created_at);
  const createdIn = createdManila
    ? createdManila >= fromDate && createdManila <= toDate
    : false;
  return dueIn || completedIn || createdIn;
}

/**
 * Checks if a completed task was finished on or before its due_date in Asia/Manila.
 */
export function isCompletedOnTime(task: Task): boolean {
  if (task.status !== 'completed' || !task.due_date) return false;
  const completionDate = toPhilippineDateString(task.completed_at || task.updated_at);
  if (!completionDate) return false;
  return completionDate <= task.due_date;
}

/**
 * Checks if a completed task was closed late (completed_at > due_date in Asia/Manila).
 */
export function isCompletedLate(task: Task): boolean {
  if (task.status !== 'completed' || !task.due_date) return false;
  const completionDate = toPhilippineDateString(task.completed_at || task.updated_at);
  if (!completionDate) return false;
  return completionDate > task.due_date;
}

/**
 * Resolves the applicable PerformanceTarget for a position or unit,
 * merging database-configured targets with defaults.
 */
export function resolvePerformanceTarget(
  positionId: string | null | undefined,
  unitId: string | null | undefined,
  configuredTargets: PerformanceTarget[] = []
): PerformanceTarget {
  const pool = [...configuredTargets, ...DEFAULT_PERFORMANCE_TARGETS];
  const byPos = positionId ? pool.find((t) => t.position_id === positionId) : undefined;
  if (byPos) return byPos;
  const byUnit = unitId ? pool.find((t) => t.unit_id === unitId && !t.position_id) : undefined;
  if (byUnit) return byUnit;
  return (
    DEFAULT_PERFORMANCE_TARGETS.find((t) => t.id === 'tgt-rso') || DEFAULT_PERFORMANCE_TARGETS[0]
  );
}

/**
 * Build function-specific operational indicators tailored to the member's actual role/position.
 */
function buildFunctionIndicators(
  position: OrganizationalPosition | null,
  unit: OrganizationalUnit | null,
  tasks: Task[],
  activities: SecurityActivity[],
  initiatives: MemberInitiative[],
  completionRate: KpiFraction,
  onTimeRate: KpiFraction
): FunctionIndicator[] {
  const posId = position?.id || '';
  const unitCode = unit?.code || '';

  if (posId === 'pos-inv') {
    const investigations = tasks.filter((t) => t.category === 'Investigation Follow-up');
    const closedInv = investigations.filter((t) => t.status === 'completed').length;
    return [
      {
        label: 'Investigation Follow-Ups',
        value: investigations.length > 0 ? `${closedInv}/${investigations.length} Closed` : 'N/A',
        detail: 'Assigned investigation follow-up tasks completed',
      },
      {
        label: 'Case Documentation Logs',
        value: `${activities.length}`,
        detail: 'Daily investigative & field coordination logs',
      },
      {
        label: 'Proactive Risk Alerts',
        value: `${initiatives.filter((i) => i.status === 'recognized').length}`,
        detail: 'Manager-recognized preventive findings',
      },
    ];
  }

  if (posId === 'pos-cctv' || posId === 'pos-scc-sup' || unitCode === 'SCC') {
    const cctvTasks = tasks.filter((t) => t.category === 'CCTV / Access Concern');
    const closedCctv = cctvTasks.filter((t) => t.status === 'completed').length;
    const cctvInits = initiatives.filter(
      (i) => i.status === 'recognized' && i.category === 'CCTV / Door Access Concern'
    ).length;
    return [
      {
        label: 'CCTV / Access Audits',
        value: cctvTasks.length > 0 ? `${closedCctv}/${cctvTasks.length} Resolved` : 'N/A',
        detail: 'Camera & door access control assignments',
      },
      {
        label: 'SOC Shift Monitoring Logs',
        value: `${activities.length}`,
        detail: 'Recorded command center watch & escalation logs',
      },
      {
        label: 'Proactive System Alerts',
        value: `${cctvInits}`,
        detail: 'Recognized CCTV/access vigilance submissions',
      },
    ];
  }

  if (posId === 'pos-rmo' || unitCode === 'RPM') {
    const reportTasks = tasks.filter(
      (t) => t.category === 'Security Report' || t.category === 'Administrative Task'
    );
    const closedRep = reportTasks.filter((t) => t.status === 'completed').length;
    return [
      {
        label: 'Management Reports Closed',
        value: reportTasks.length > 0 ? `${closedRep}/${reportTasks.length}` : 'N/A',
        detail: 'Incident & compliance report assignments closed',
      },
      {
        label: 'Timeliness (On-Time SLA)',
        value: onTimeRate.display,
        detail: 'Reports closed on or before due date (PHT)',
      },
      {
        label: 'Process Improvements',
        value: `${initiatives.filter((i) => i.status === 'recognized').length}`,
        detail: 'Validated reporting workflow enhancements',
      },
    ];
  }

  // Default / Regional Security Operations (Supervisors & Security Officers)
  const inspections = tasks.filter((t) => t.category === 'Inspection');
  const closedInsp = inspections.filter((t) => t.status === 'completed').length;
  return [
    {
      label: 'Site Inspections Completed',
      value: inspections.length > 0 ? `${closedInsp}/${inspections.length}` : 'N/A',
      detail: 'Scheduled facility & physical security inspections',
    },
    {
      label: 'Daily Field Shift Logs',
      value: `${activities.length}`,
      detail: 'Recorded guard mount, patrol, & post briefings',
    },
    {
      label: 'Overall Task Completion',
      value: completionRate.display,
      detail: 'Verified completion across assigned operational duties',
    },
  ];
}

/**
 * Computes individual performance record for a registered user using live Supabase arrays.
 */
export function computePersonnelPerformance(params: {
  user: UserProfile;
  assignment: PersonnelAssignment | null;
  units: OrganizationalUnit[];
  positions: OrganizationalPosition[];
  regions: OperatingRegion[];
  profilesById: Record<string, UserProfile>;
  assignmentsById: Record<string, PersonnelAssignment>;
  tasks: Task[];
  taskUpdates: Record<string, TaskUpdate[]>;
  activities: SecurityActivity[];
  initiatives: MemberInitiative[];
  initiativeHistory: Record<string, InitiativeHistory[]>;
  performanceTargets?: PerformanceTarget[];
  fromDate?: string;
  toDate?: string;
}): PersonnelPerformanceRecord {
  const {
    user,
    assignment,
    units,
    positions,
    regions,
    profilesById,
    assignmentsById,
    tasks,
    taskUpdates,
    activities,
    initiatives,
    initiativeHistory,
    performanceTargets = [],
    fromDate,
    toDate,
  } = params;

  // Resolve unit, position, region
  const unit = assignment?.organizational_unit_id
    ? units.find((u) => u.id === assignment.organizational_unit_id) || null
    : user.role === 'manager'
    ? units.find((u) => u.id === 'unit-exec') || null
    : null;

  const position = assignment?.position_id
    ? positions.find((p) => p.id === assignment.position_id) || null
    : user.role === 'manager'
    ? positions.find((p) => p.id === 'pos-mgr') || null
    : null;

  const resolvedRegId =
    assignment?.region_id ||
    (user.regional_assignment ? resolveOperatingRegionId(user.regional_assignment, regions) : null);
  const region = resolvedRegId ? regions.find((r) => r.id === resolvedRegId) || null : null;

  // Supervisor lookup
  let supervisor: PersonnelPerformanceRecord['supervisor'] = null;
  if (assignment?.reports_to_user_id) {
    const supUser = profilesById[assignment.reports_to_user_id];
    const supAssign = assignmentsById[assignment.reports_to_user_id];
    const supPos = supAssign?.position_id
      ? positions.find((p) => p.id === supAssign.position_id)
      : null;
    if (supUser) {
      supervisor = {
        id: supUser.id,
        name: supUser.display_name,
        positionTitle:
          supPos?.title || (supUser.role === 'manager' ? 'Security Manager' : 'Supervisor'),
        email: supUser.email,
      };
    }
  }

  // Personal tasks (ALL vs selected cohort)
  const userTasksAll = tasks.filter((t) => t.assigned_to === user.id);
  const cohortTasks = userTasksAll.filter((t) => isTaskInReportingCohort(t, fromDate, toDate));

  // Activities in period
  const userActivitiesAll = activities.filter((a) => a.author_id === user.id);
  const cohortActivities = userActivitiesAll.filter((a) =>
    isWithinDateWindow(a.activity_date, fromDate, toDate)
  );

  // Initiatives in period (submitted_by === user.id)
  const userInitiativesAll = initiatives.filter((i) => i.submitted_by === user.id && i.status !== 'draft');
  const cohortInitiatives = userInitiativesAll.filter((i) =>
    isWithinDateWindow(i.activity_date || i.created_at, fromDate, toDate)
  );
  const recognizedInitiatives = userInitiativesAll.filter(
    (i) =>
      i.status === 'recognized' &&
      Boolean(i.recognized_at) &&
      isWithinDateWindow(i.recognized_at, fromDate, toDate)
  );

  // Task KPI counts (Cohort)
  const completedTasks = cohortTasks.filter((t) => t.status === 'completed');
  const completedWithDue = completedTasks.filter((t) => Boolean(t.due_date));
  const onTimeCompleted = completedWithDue.filter((t) => isCompletedOnTime(t));
  const completedLateInPeriodCount = completedWithDue.filter((t) => isCompletedLate(t)).length;

  // Open status counts:
  // - Cohort active workload
  const cohortActiveTasks = cohortTasks.filter((t) => t.status !== 'completed');
  // - ALL open tasks & ALL Currently Overdue Tasks (reconciles 100% with Executive Overdue KPI)
  const allOpenTasks = userTasksAll.filter((t) => t.status !== 'completed');
  const currentOverdueTasks = allOpenTasks.filter((t) => isTaskOverdue(t.due_date, t.status));

  const becameOverdueInPeriodCount =
    fromDate && toDate
      ? currentOverdueTasks.filter((t) => t.due_date >= fromDate && t.due_date <= toDate).length
      : currentOverdueTasks.length;

  const historicalOverdueCount =
    fromDate
      ? currentOverdueTasks.filter((t) => t.due_date < fromDate).length
      : 0;

  const dueTodayCount = allOpenTasks.filter((t) => isTaskDueToday(t.due_date, t.status)).length;
  const forReviewCount = allOpenTasks.filter((t) => t.status === 'for_review').length;
  const returnedTasksCount = allOpenTasks.filter((t) => t.status === 'returned').length;

  // Return events during period (from task_updates + initiative_history)
  let returnedEvents = 0;
  for (const t of userTasksAll) {
    const upds = taskUpdates[t.id] || [];
    for (const u of upds) {
      if (u.status_change === 'returned' && isWithinDateWindow(u.created_at, fromDate, toDate)) {
        returnedEvents += 1;
      }
    }
  }
  for (const init of userInitiativesAll) {
    const hist = initiativeHistory[init.id] || [];
    for (const h of hist) {
      if (
        (h.action === 'RETURN_FOR_REVISION' || h.action === 'REVOKE_RECOGNITION') &&
        isWithinDateWindow(h.created_at, fromDate, toDate)
      ) {
        returnedEvents += 1;
      }
    }
  }

  // Last recorded activity
  const sortedActs = [...userActivitiesAll].sort((a, b) =>
    (b.activity_date || b.created_at).localeCompare(a.activity_date || a.created_at)
  );
  const latestAct = sortedActs[0] || null;

  const completionRate = computeKpiFraction(completedTasks.length, cohortTasks.length);
  const onTimeRate = computeKpiFraction(onTimeCompleted.length, completedWithDue.length);

  // Position-Specific Targets & Daily Activity Compliance
  const appliedTarget = resolvePerformanceTarget(position?.id, unit?.id, performanceTargets);
  const daysInWindow = countDaysInRange(fromDate, toDate);
  const dailyTarget = appliedTarget.daily_activity_target ?? 1;
  // Use expected daily activity benchmark only if user is approved & active (otherwise N/A)
  const expectedActivities =
    user.approved && user.active && dailyTarget > 0 ? daysInWindow * dailyTarget : 0;
  const cappedActivityHits =
    expectedActivities > 0 ? Math.min(cohortActivities.length, expectedActivities) : 0;
  const dailyActivityRate =
    userActivitiesAll.length === 0 && cohortTasks.length === 0 && userInitiativesAll.length === 0
      ? computeKpiFraction(0, 0) // New user with zero history shows N/A rather than 0%
      : computeKpiFraction(cappedActivityHits, expectedActivities);

  const initiativeGoal = Math.max(1, appliedTarget.monthly_initiative_goal || 1);
  const initiativeRate =
    userInitiativesAll.length === 0 && cohortTasks.length === 0 && userActivitiesAll.length === 0
      ? computeKpiFraction(0, 0)
      : computeKpiFraction(
          Math.min(recognizedInitiatives.length, initiativeGoal),
          initiativeGoal
        );

  // Position-Weighted Operational Index (Strictly Non-Appraisal; N/A when no eligible indicators exist)
  const wComp = appliedTarget.weight_completion ?? 35;
  const wOnTime = appliedTarget.weight_on_time ?? 35;
  const wAct = appliedTarget.weight_activity ?? 15;
  const wInit = appliedTarget.weight_initiative ?? 15;

  const weightedComponents: { pct: number; weight: number }[] = [];
  if (completionRate.percentage !== null) {
    weightedComponents.push({ pct: completionRate.percentage, weight: wComp });
  }
  if (onTimeRate.percentage !== null) {
    weightedComponents.push({ pct: onTimeRate.percentage, weight: wOnTime });
  }
  if (dailyActivityRate.percentage !== null && cohortActivities.length > 0) {
    weightedComponents.push({ pct: dailyActivityRate.percentage, weight: wAct });
  }
  if (initiativeRate.percentage !== null && recognizedInitiatives.length > 0) {
    weightedComponents.push({ pct: initiativeRate.percentage, weight: wInit });
  }

  const totalEligibleWeight = weightedComponents.reduce((s, c) => s + c.weight, 0);
  const weightedScore =
    totalEligibleWeight > 0
      ? Math.round(
          weightedComponents.reduce((s, c) => s + c.pct * c.weight, 0) / totalEligibleWeight
        )
      : null;

  const operationalIndex: OperationalIndexSummary = {
    score: weightedScore,
    display: weightedScore !== null ? `${weightedScore}%` : 'N/A',
    label: 'Operational Index (Non-Appraisal)',
    isNonAppraisal: true,
    formulaDescription: `Position weights (${position?.title || 'Standard'}): Completion ${wComp}% + On-Time ${wOnTime}% + Shift Logs ${wAct}% + Initiatives ${wInit}% (normalized across active denominators)`,
  };

  const kpiBreakdowns: KpiFormulaBreakdown[] = [
    {
      metric: 'Task Completion Rate',
      formula: 'Completed tasks in cohort ÷ Total assigned tasks in cohort',
      numerator: completionRate.numerator,
      denominator: completionRate.denominator,
      weightPercent: wComp,
      valueDisplay: completionRate.display,
      sourceRecordSet: 'public.tasks (cohort by due/created/completed date)',
    },
    {
      metric: 'On-Time Completion SLA',
      formula: 'Completed on or before due_date (PHT) ÷ Completed tasks with due_date',
      numerator: onTimeRate.numerator,
      denominator: onTimeRate.denominator,
      weightPercent: wOnTime,
      valueDisplay: onTimeRate.display,
      sourceRecordSet: 'public.tasks (status = completed, PHT comparison)',
    },
    {
      metric: 'Daily Activity Log Coverage',
      formula: `Logged activities (${cohortActivities.length}) ÷ (${daysInWindow}d × ${dailyTarget}/day target)`,
      numerator: dailyActivityRate.numerator,
      denominator: dailyActivityRate.denominator,
      weightPercent: wAct,
      valueDisplay: dailyActivityRate.display,
      sourceRecordSet: 'public.activities (activity_date in window)',
    },
    {
      metric: 'Recognized Proactive Initiatives',
      formula: 'Manager-recognized initiatives (status = recognized) ÷ Monthly benchmark',
      numerator: recognizedInitiatives.length,
      denominator: initiativeGoal,
      weightPercent: wInit,
      valueDisplay:
        recognizedInitiatives.length > 0 || userInitiativesAll.length > 0
          ? `${recognizedInitiatives.length}/${initiativeGoal} (${Math.min(
              100,
              Math.round((recognizedInitiatives.length / initiativeGoal) * 100)
            )}%)`
          : 'N/A',
      sourceRecordSet: 'public.member_initiatives (recognized_at in window)',
    },
  ];

  const hasAnyHistory =
    userTasksAll.length > 0 || userActivitiesAll.length > 0 || userInitiativesAll.length > 0;

  const functionIndicators = buildFunctionIndicators(
    position,
    unit,
    cohortTasks,
    cohortActivities,
    recognizedInitiatives,
    completionRate,
    onTimeRate
  );

  return {
    user,
    assignment,
    unit,
    position,
    region,
    supervisor,
    totalAssignedTasks: cohortTasks.length,
    activeTasksCount: cohortActiveTasks.length,
    allOpenTasksCount: allOpenTasks.length,
    dueTodayCount,
    overdueTasksCount: currentOverdueTasks.length,
    becameOverdueInPeriodCount,
    historicalOverdueCount,
    completedLateInPeriodCount,
    forReviewCount,
    returnedTasksCount,
    completedTasksCount: completedTasks.length,
    completedWithDueCount: completedWithDue.length,
    onTimeCompletedCount: onTimeCompleted.length,
    completionRate,
    onTimeRate,
    dailyActivityRate,
    activitiesCount: cohortActivities.length,
    totalInitiativesCount: cohortInitiatives.length,
    pendingInitiativesCount: userInitiativesAll.filter(
      (i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted'
    ).length,
    returnedInitiativesCount: userInitiativesAll.filter((i) => i.status === 'returned').length,
    recognizedInitiativesCount: recognizedInitiatives.length,
    returnedSubmissionsEvents: returnedEvents,
    lastRecordedActivityDate: latestAct ? latestAct.activity_date : null,
    lastRecordedActivityTitle: latestAct ? latestAct.title : null,
    hasAnyHistory,
    functionIndicators,
    appliedTarget,
    operationalIndex,
    kpiBreakdowns,
  };
}

/**
 * Computes unit-level performance summary across organizational units using actual Supabase assignments.
 * Guarantees exact reconciliation by grouping unassigned-unit users separately if any exist,
 * and using `completedWithDueCount` as the exact denominator for `onTimeRate`.
 */
export function computeUnitPerformanceSummaries(params: {
  units: OrganizationalUnit[];
  personnelRecords: PersonnelPerformanceRecord[];
}): UnitPerformanceSummary[] {
  const { units, personnelRecords } = params;

  const activeUnits = units.filter((u) => u.is_active).sort((a, b) => a.sort_order - b.sort_order);
  const assignedIds = new Set<string>();

  const buildUnitSummary = (
    unit: OrganizationalUnit,
    members: PersonnelPerformanceRecord[]
  ): UnitPerformanceSummary => {
    const activeUsersCount = members.filter((m) => m.user.approved && m.user.active).length;
    const activeTasksCount = members.reduce((s, m) => s + m.activeTasksCount, 0);
    const allOpenTasksCount = members.reduce((s, m) => s + m.allOpenTasksCount, 0);
    const completedTasksCount = members.reduce((s, m) => s + m.completedTasksCount, 0);
    const completedWithDueCount = members.reduce((s, m) => s + m.completedWithDueCount, 0);
    const totalAssignedTasks = members.reduce((s, m) => s + m.totalAssignedTasks, 0);
    const onTimeCompletedCount = members.reduce((s, m) => s + m.onTimeCompletedCount, 0);
    const overdueTasksCount = members.reduce((s, m) => s + m.overdueTasksCount, 0);
    const becameOverdueInPeriodCount = members.reduce(
      (s, m) => s + m.becameOverdueInPeriodCount,
      0
    );
    const completedLateInPeriodCount = members.reduce(
      (s, m) => s + m.completedLateInPeriodCount,
      0
    );
    const pendingReviewsCount = members.reduce(
      (s, m) => s + m.forReviewCount + m.pendingInitiativesCount,
      0
    );
    const returnedSubmissionsCount = members.reduce(
      (s, m) => s + m.returnedSubmissionsEvents,
      0
    );
    const recognizedInitiativesCount = members.reduce(
      (s, m) => s + m.recognizedInitiativesCount,
      0
    );
    const activitiesCount = members.reduce((s, m) => s + m.activitiesCount, 0);

    return {
      unit,
      activeUsersCount,
      activeTasksCount,
      allOpenTasksCount,
      totalAssignedTasks,
      completedTasksCount,
      completedWithDueCount,
      onTimeCompletedCount,
      overdueTasksCount,
      becameOverdueInPeriodCount,
      completedLateInPeriodCount,
      pendingReviewsCount,
      returnedSubmissionsCount,
      recognizedInitiativesCount,
      completionRate: computeKpiFraction(completedTasksCount, totalAssignedTasks),
      onTimeRate: computeKpiFraction(onTimeCompletedCount, completedWithDueCount),
      activitiesCount,
      memberIds: members.map((m) => m.user.id),
    };
  };

  const results = activeUnits.map((unit) => {
    const members = personnelRecords.filter((rec) => {
      if (rec.unit?.id === unit.id) return true;
      if (!rec.assignment && rec.user.role === 'manager' && unit.id === 'unit-exec') {
        return true;
      }
      return false;
    });
    for (const m of members) assignedIds.add(m.user.id);
    return buildUnitSummary(unit, members);
  });

  // Ensure any member without an assigned org unit yet is still accounted for so unit sums === department totals
  const unassignedMembers = personnelRecords.filter((rec) => !assignedIds.has(rec.user.id));
  if (unassignedMembers.length > 0) {
    results.push(
      buildUnitSummary(
        {
          id: 'unit-unassigned',
          code: 'UNASSIGNED',
          name: 'Unassigned / Pending Unit Placement',
          description: 'Registered personnel whose Organizational Unit has not yet been set by Manager',
          parent_unit_id: null,
          sort_order: 99,
          is_active: true,
        },
        unassignedMembers
      )
    );
  }

  return results;
}

/**
 * Computes Regional Performance Summaries while PRESERVING HISTORICAL REGION ATTRIBUTION
 * and guaranteeing exact reconciliation for Currently Overdue Tasks across all regions.
 */
export function computeRegionalPerformanceSummaries(params: {
  regions: OperatingRegion[];
  personnelRecords: PersonnelPerformanceRecord[];
  tasks: Task[];
  taskUpdates: Record<string, TaskUpdate[]>;
  activities: SecurityActivity[];
  initiatives: MemberInitiative[];
  fromDate?: string;
  toDate?: string;
}): RegionalPerformanceSummary[] {
  const {
    regions,
    personnelRecords,
    tasks,
    taskUpdates,
    activities,
    initiatives,
    fromDate,
    toDate,
  } = params;

  const cohortTasks = tasks.filter((t) => isTaskInReportingCohort(t, fromDate, toDate));
  const cohortActivities = activities.filter((a) =>
    isWithinDateWindow(a.activity_date, fromDate, toDate)
  );
  const recognizedInits = initiatives.filter(
    (i) =>
      i.status === 'recognized' &&
      Boolean(i.recognized_at) &&
      isWithinDateWindow(i.recognized_at, fromDate, toDate)
  );

  // Evaluate every region (including legacy reg-vis / reg-min only if they hold actual records)
  const orderedRegions = [...regions].sort((a, b) => a.sort_order - b.sort_order);

  const computed = orderedRegions.map((region) => {
    const assignedMembers = personnelRecords.filter(
      (p) => p.user.approved && p.user.active && p.region?.id === region.id
    );
    const assignedPersonnelCount = assignedMembers.length;

    const assignedSupervisors = assignedMembers
      .filter(
        (m) =>
          m.position?.is_supervisory === true ||
          m.assignment?.employment_category === 'supervisor' ||
          m.position?.id === 'pos-rso-sup'
      )
      .map((m) => ({
        id: m.user.id,
        name: m.user.display_name,
        positionTitle: m.position?.title || 'Regional Supervisor',
      }));

    // ALL tasks whose recorded task.region resolves to this operating region
    const allRegionTasks = tasks.filter(
      (t) => resolveOperatingRegionId(t.region, regions) === region.id
    );
    const allOpenRegionTasks = allRegionTasks.filter((t) => t.status !== 'completed');
    const currentOverdueTasks = allOpenRegionTasks.filter((t) =>
      isTaskOverdue(t.due_date, t.status)
    );
    const becameOverdueInPeriodCount =
      fromDate && toDate
        ? currentOverdueTasks.filter((t) => t.due_date >= fromDate && t.due_date <= toDate).length
        : currentOverdueTasks.length;

    // Cohort tasks in region
    const regionCohortTasks = cohortTasks.filter(
      (t) => resolveOperatingRegionId(t.region, regions) === region.id
    );
    const activeTasks = regionCohortTasks.filter((t) => t.status !== 'completed');
    const completedTasks = regionCohortTasks.filter((t) => t.status === 'completed');
    const completedWithDue = completedTasks.filter((t) => Boolean(t.due_date));
    const onTimeCompleted = completedWithDue.filter((t) => isCompletedOnTime(t));
    const completedLateInPeriodCount = completedWithDue.filter((t) => isCompletedLate(t)).length;

    const pendingReviewsCount = allOpenRegionTasks.filter((t) => t.status === 'for_review').length;

    // Return events on tasks belonging to this region
    let returnedSubmissionsCount = 0;
    for (const t of allRegionTasks) {
      const upds = taskUpdates[t.id] || [];
      for (const u of upds) {
        if (
          u.status_change === 'returned' &&
          isWithinDateWindow(u.created_at, fromDate, toDate)
        ) {
          returnedSubmissionsCount += 1;
        }
      }
    }

    const regionAllActivities = activities.filter(
      (a) => resolveOperatingRegionId(a.region, regions) === region.id
    );
    const regionCohortActivities = cohortActivities.filter(
      (a) => resolveOperatingRegionId(a.region, regions) === region.id
    );
    const sortedRegionActs = [...regionAllActivities].sort((a, b) =>
      (b.activity_date || b.created_at).localeCompare(a.activity_date || a.created_at)
    );
    const latestActivityDate = sortedRegionActs[0]?.activity_date || null;

    const regionInitiatives = recognizedInits.filter(
      (i) => resolveOperatingRegionId(i.region, regions) === region.id
    );

    return {
      region,
      assignedPersonnelCount,
      assignedSupervisors,
      activeTasksCount: activeTasks.length,
      allOpenTasksCount: allOpenRegionTasks.length,
      totalCohortTasks: regionCohortTasks.length,
      completedTasksCount: completedTasks.length,
      completedWithDueCount: completedWithDue.length,
      onTimeCompletedCount: onTimeCompleted.length,
      overdueTasksCount: currentOverdueTasks.length,
      becameOverdueInPeriodCount,
      completedLateInPeriodCount,
      pendingReviewsCount,
      returnedSubmissionsCount,
      recognizedInitiativesCount: regionInitiatives.length,
      completionRate: computeKpiFraction(completedTasks.length, regionCohortTasks.length),
      onTimeRate: computeKpiFraction(onTimeCompleted.length, completedWithDue.length),
      activitiesCount: regionCohortActivities.length,
      latestActivityDate,
    } satisfies RegionalPerformanceSummary;
  });

  // Include active regions OR any legacy inactive region that holds historical/open records
  return computed.filter(
    (item) =>
      item.region.is_active ||
      item.assignedPersonnelCount > 0 ||
      item.allOpenTasksCount > 0 ||
      item.totalCohortTasks > 0 ||
      item.activitiesCount > 0 ||
      item.recognizedInitiativesCount > 0
  );
}

/**
 * Computes Consolidated Visayas (Region 6 + Region 7 + legacy reg-vis) and
 * Consolidated Mindanao (Region 10 + Region 11 + legacy reg-min) rollups
 * using summed numerators & denominators (never averaging percentages).
 */
export function computeConsolidatedRegionRollups(
  regionalSummaries: RegionalPerformanceSummary[]
): {
  consolidatedVisayas: RegionalPerformanceSummary;
  consolidatedMindanao: RegionalPerformanceSummary;
} {
  const aggregateGroup = (
    id: string,
    code: string,
    name: string,
    islandGroup: string,
    childIds: string[]
  ): RegionalPerformanceSummary => {
    const children = regionalSummaries.filter((r) => childIds.includes(r.region.id));
    const assignedPersonnelCount = children.reduce((s, r) => s + r.assignedPersonnelCount, 0);
    const activeTasksCount = children.reduce((s, r) => s + r.activeTasksCount, 0);
    const allOpenTasksCount = children.reduce((s, r) => s + r.allOpenTasksCount, 0);
    const totalCohortTasks = children.reduce((s, r) => s + r.totalCohortTasks, 0);
    const completedTasksCount = children.reduce((s, r) => s + r.completedTasksCount, 0);
    const completedWithDueCount = children.reduce((s, r) => s + r.completedWithDueCount, 0);
    const onTimeCompletedCount = children.reduce((s, r) => s + r.onTimeCompletedCount, 0);
    const overdueTasksCount = children.reduce((s, r) => s + r.overdueTasksCount, 0);
    const becameOverdueInPeriodCount = children.reduce(
      (s, r) => s + r.becameOverdueInPeriodCount,
      0
    );
    const completedLateInPeriodCount = children.reduce(
      (s, r) => s + r.completedLateInPeriodCount,
      0
    );
    const pendingReviewsCount = children.reduce((s, r) => s + r.pendingReviewsCount, 0);
    const returnedSubmissionsCount = children.reduce((s, r) => s + r.returnedSubmissionsCount, 0);
    const recognizedInitiativesCount = children.reduce(
      (s, r) => s + r.recognizedInitiativesCount,
      0
    );
    const activitiesCount = children.reduce((s, r) => s + r.activitiesCount, 0);

    const supervisorsMap: Record<string, { id: string; name: string; positionTitle: string }> = {};
    for (const c of children) {
      for (const sup of c.assignedSupervisors) {
        supervisorsMap[sup.id] = sup;
      }
    }

    const latestDates = children
      .map((c) => c.latestActivityDate)
      .filter((d): d is string => Boolean(d))
      .sort((a, b) => b.localeCompare(a));

    return {
      region: {
        id,
        code,
        name,
        island_group: islandGroup,
        sort_order: 99,
        is_active: true,
      },
      assignedPersonnelCount,
      assignedSupervisors: Object.values(supervisorsMap),
      activeTasksCount,
      allOpenTasksCount,
      totalCohortTasks,
      completedTasksCount,
      completedWithDueCount,
      onTimeCompletedCount,
      overdueTasksCount,
      becameOverdueInPeriodCount,
      completedLateInPeriodCount,
      pendingReviewsCount,
      returnedSubmissionsCount,
      recognizedInitiativesCount,
      completionRate: computeKpiFraction(completedTasksCount, totalCohortTasks),
      onTimeRate: computeKpiFraction(onTimeCompletedCount, completedWithDueCount),
      activitiesCount,
      latestActivityDate: latestDates[0] || null,
      isConsolidatedGroup: true,
      childRegionIds: childIds,
    };
  };

  return {
    consolidatedVisayas: aggregateGroup(
      'consolidated-visayas',
      'VIS-ALL',
      'Consolidated Visayas (R6 + R7)',
      'Visayas',
      ['reg-vis-6', 'reg-vis-7', 'reg-vis']
    ),
    consolidatedMindanao: aggregateGroup(
      'consolidated-mindanao',
      'MIN-ALL',
      'Consolidated Mindanao (R10 + R11)',
      'Mindanao',
      ['reg-min-10', 'reg-min-11', 'reg-min']
    ),
  };
}

/**
 * Canonical Department Reconciled Metrics for Executive Overview Cards & Management Action Center.
 * Guarantees 100% numeric consistency across Overview Cards, Overdue breakdown, Personnel, Units, & Regions.
 */
export function computeDepartmentReconciledMetrics(params: {
  allProfiles: UserProfile[];
  allDepartmentTasks: Task[];
  allDepartmentInitiatives: MemberInitiative[];
  fromDate: string;
  toDate: string;
}) {
  const {
    allProfiles,
    allDepartmentTasks,
    allDepartmentInitiatives,
    fromDate,
    toDate,
  } = params;

  const approvedActiveUsers = allProfiles.filter((p) => p.approved && p.active);
  const pendingApprovalProfiles = allProfiles.filter((p) => !p.approved);

  // ALL open tasks across department regardless of period
  const allOpenTasks = allDepartmentTasks.filter((t) => t.status !== 'completed');
  const allCurrentlyOverdueTasks = allOpenTasks.filter((t) =>
    isTaskOverdue(t.due_date, t.status)
  );
  const becameOverdueInPeriodTasks = allCurrentlyOverdueTasks.filter(
    (t) => t.due_date >= fromDate && t.due_date <= toDate
  );
  const historicalOverdueTasks = allCurrentlyOverdueTasks.filter((t) => t.due_date < fromDate);
  const allDueTodayTasks = allOpenTasks.filter((t) => isTaskDueToday(t.due_date, t.status));
  const allForReviewTasks = allOpenTasks.filter((t) => t.status === 'for_review');
  const allReturnedTasks = allOpenTasks.filter((t) => t.status === 'returned');

  // Cohort-bounded task metrics
  const cohortTasks = allDepartmentTasks.filter((t) =>
    isTaskInReportingCohort(t, fromDate, toDate)
  );
  const cohortActiveTasks = cohortTasks.filter((t) => t.status !== 'completed');
  const cohortCompletedTasks = cohortTasks.filter((t) => t.status === 'completed');
  const completedWithDue = cohortCompletedTasks.filter((t) => Boolean(t.due_date));
  const onTimeCompleted = completedWithDue.filter((t) => isCompletedOnTime(t));
  const completedLateInPeriod = completedWithDue.filter((t) => isCompletedLate(t));

  // Initiatives
  const pendingInitiatives = allDepartmentInitiatives.filter(
    (i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted'
  );
  const returnedInitiatives = allDepartmentInitiatives.filter((i) => i.status === 'returned');
  const recognizedInitiatives = allDepartmentInitiatives.filter(
    (i) =>
      i.status === 'recognized' &&
      Boolean(i.recognized_at) &&
      isWithinDateWindow(i.recognized_at, fromDate, toDate)
  );

  // Personnel workload states (evaluated across ALL open tasks so Staff w/ Overdue reconciles 100%)
  const personnelWithoutAssignmentsList = approvedActiveUsers.filter(
    (u) => !allOpenTasks.some((t) => t.assigned_to === u.id)
  );
  const personnelWithOverdueList = approvedActiveUsers.filter((u) =>
    allCurrentlyOverdueTasks.some((t) => t.assigned_to === u.id)
  );

  return {
    totalRegisteredPersonnel: allProfiles.length,
    activeApprovedPersonnel: approvedActiveUsers.length,
    pendingApprovals: pendingApprovalProfiles.length,
    pendingApprovalProfiles,
    // Reconciled open/overdue workload
    allOpenTasksCount: allOpenTasks.length,
    overdue: allCurrentlyOverdueTasks.length, // Currently Overdue Tasks (canonical)
    allCurrentlyOverdueTasks,
    becameOverdueInPeriodCount: becameOverdueInPeriodTasks.length,
    historicalOverdueCount: historicalOverdueTasks.length,
    completedLateInPeriodCount: completedLateInPeriod.length,
    dueToday: allDueTodayTasks.length,
    forReview: allForReviewTasks.length,
    allForReviewTasks,
    allReturnedTasks,
    // Cohort KPIs
    totalActiveTasks: cohortActiveTasks.length,
    completed: cohortCompletedTasks.length,
    completionRate: computeKpiFraction(cohortCompletedTasks.length, cohortTasks.length),
    onTimeRate: computeKpiFraction(onTimeCompleted.length, completedWithDue.length),
    // Initiatives & Approvals
    recognizedInitiatives: recognizedInitiatives.length,
    pendingInitiativesCount: pendingInitiatives.length,
    pendingInitiatives,
    returnedInitiatives,
    returnedForRevision: allReturnedTasks.length + returnedInitiatives.length,
    totalPendingManagementApprovals:
      pendingApprovalProfiles.length + allForReviewTasks.length + pendingInitiatives.length,
    // Personnel status lists
    personnelWithoutAssignmentsList,
    personnelWithOverdueList,
  };
}

/**
 * Generates last N months trend buckets from real tasks and recognized initiatives using Asia/Manila dates.
 */
export function computeMonthlyTrendBuckets(params: {
  tasks: Task[];
  initiatives: MemberInitiative[];
  monthsCount?: number;
}) {
  const { tasks, initiatives, monthsCount = 4 } = params;
  const today = getPhilippineToday();
  const [curYearStr, curMonthStr] = today.split('-');
  const curYear = parseInt(curYearStr, 10);
  const curMonth = parseInt(curMonthStr, 10);

  const buckets: {
    monthKey: string;
    label: string;
    completedTasks: number;
    overdueTasks: number;
    pendingReviews: number;
    recognizedInitiatives: number;
  }[] = [];

  for (let offset = monthsCount - 1; offset >= 0; offset--) {
    let m = curMonth - offset;
    let y = curYear;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const mm = String(m).padStart(2, '0');
    const monthKey = `${y}-${mm}`;
    const labelDate = new Date(`${y}-${mm}-01T00:00:00+08:00`);
    const label = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      month: 'short',
      year: 'numeric',
    }).format(labelDate);

    const completedTasks = tasks.filter((t) => {
      if (t.status !== 'completed') return false;
      const d = toPhilippineDateString(t.completed_at || t.updated_at);
      return d?.startsWith(monthKey);
    }).length;

    const overdueTasks = tasks.filter((t) => {
      if (t.status === 'completed') return false;
      return t.due_date.startsWith(monthKey) && isTaskOverdue(t.due_date, t.status);
    }).length;

    const pendingReviews = tasks.filter((t) => {
      if (t.status !== 'for_review') return false;
      const d = toPhilippineDateString(t.updated_at);
      return d?.startsWith(monthKey);
    }).length;

    const recognizedInitiatives = initiatives.filter((i) => {
      if (i.status !== 'recognized' || !i.recognized_at) return false;
      const d = toPhilippineDateString(i.recognized_at);
      return d?.startsWith(monthKey);
    }).length;

    buckets.push({
      monthKey,
      label,
      completedTasks,
      overdueTasks,
      pendingReviews,
      recognizedInitiatives,
    });
  }

  return buckets;
}
