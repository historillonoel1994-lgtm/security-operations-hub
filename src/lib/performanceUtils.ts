/**
 * Performance Calculation & Hierarchy Utilities for Security Operations Hub (SOH)
 *
 * Documented Calculation Rules:
 * 1. Timezone: All business dates and due-date comparisons use Asia/Manila (UTC+8).
 *    UTC timestamps in database records (completed_at, updated_at, recognized_at)
 *    are converted to Asia/Manila YYYY-MM-DD before evaluating timeliness.
 * 2. Task Completion Rate:
 *    Completed tasks / eligible assigned tasks in cohort. Displays "No Data" if denominator = 0.
 * 3. On-Time Completion Rate:
 *    Completed tasks where manilaDate(completed_at || updated_at) <= due_date / eligible completed tasks with due_date.
 *    Reopened tasks have completed_at = null and status != 'completed', so they are automatically excluded.
 * 4. Overdue Count:
 *    Open tasks (status != 'completed') where due_date < current Philippine date.
 * 5. Recognized Initiatives:
 *    Strictly initiatives with status === 'recognized' AND valid recognized_at timestamp.
 *    Approved proposals ('approved_to_proceed' / 'in_progress') are NEVER counted as recognized accomplishments.
 * 6. Returned Submissions:
 *    Counts distinct return events in task_updates (status_change === 'returned') and
 *    initiative_history (action === 'RETURN_FOR_REVISION') within the selected period.
 * 7. Historical Region Preservation:
 *    Regional performance aggregates tasks, activities, and initiatives by each record's own
 *    recorded `region` field rather than the user's current `personnel_assignments.region_id`.
 *    Reassigning a user to a new region never silently moves their historical work.
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
  DateRangePreset,
  KpiFraction,
  FunctionIndicator,
  PersonnelPerformanceRecord,
  UnitPerformanceSummary,
  RegionalPerformanceSummary,
} from '../types/index.ts';
import { getPhilippineToday, isTaskDueToday, isTaskOverdue } from './dateUtils.ts';
import { resolveOperatingRegionId } from './orgDefaults.ts';

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
    // Start of current week (Monday) or last 7 days
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

  // Default fallback: last 30 days
  const d = new Date(baseDate);
  d.setDate(d.getDate() - 30);
  return {
    fromDate: toPhilippineDateString(d.toISOString()) || today,
    toDate: today,
  };
}

/**
 * Builds a transparent fraction KPI showing numerator, denominator, and percentage or "No Data".
 */
export function computeKpiFraction(numerator: number, denominator: number): KpiFraction {
  if (denominator <= 0) {
    return {
      numerator: 0,
      denominator: 0,
      percentage: null,
      display: 'No Data',
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
 * Includes tasks whose due_date, created_at, or completed_at falls in [fromDate, toDate],
 * OR open overdue/active tasks if no strict window exclusion applies.
 * Using business-date cohort: due_date in [fromDate, toDate] OR completed_at in [fromDate, toDate].
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
        value: investigations.length > 0 ? `${closedInv}/${investigations.length} Closed` : 'No Data',
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
        value: cctvTasks.length > 0 ? `${closedCctv}/${cctvTasks.length} Resolved` : 'No Data',
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
        value: reportTasks.length > 0 ? `${closedRep}/${reportTasks.length}` : 'No Data',
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
      value: inspections.length > 0 ? `${closedInsp}/${inspections.length}` : 'No Data',
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

  // Deduplicated personal tasks within reporting cohort
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

  // Task KPI counts
  const completedTasks = cohortTasks.filter((t) => t.status === 'completed');
  const completedWithDue = completedTasks.filter((t) => Boolean(t.due_date));
  const onTimeCompleted = completedWithDue.filter((t) => isCompletedOnTime(t));

  // Open status counts (active & overdue always reflect real open workload, filtered if cohort applies)
  const activeTasks = cohortTasks.filter((t) => t.status !== 'completed');
  const dueTodayCount = activeTasks.filter((t) => isTaskDueToday(t.due_date, t.status)).length;
  const overdueTasksCount = activeTasks.filter((t) => isTaskOverdue(t.due_date, t.status)).length;
  const forReviewCount = activeTasks.filter((t) => t.status === 'for_review').length;
  const returnedTasksCount = activeTasks.filter((t) => t.status === 'returned').length;

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
    activeTasksCount: activeTasks.length,
    dueTodayCount,
    overdueTasksCount,
    forReviewCount,
    returnedTasksCount,
    completedTasksCount: completedTasks.length,
    onTimeCompletedCount: onTimeCompleted.length,
    completionRate,
    onTimeRate,
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
  };
}

/**
 * Computes unit-level performance summary across organizational units using actual Supabase assignments.
 */
export function computeUnitPerformanceSummaries(params: {
  units: OrganizationalUnit[];
  personnelRecords: PersonnelPerformanceRecord[];
}): UnitPerformanceSummary[] {
  const { units, personnelRecords } = params;

  return units
    .filter((u) => u.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((unit) => {
      const members = personnelRecords.filter((rec) => {
        if (rec.unit?.id === unit.id) return true;
        // Fallback if user has no explicit personnel_assignment yet:
        // managers belong to unit-exec, unassigned members are counted separately or under RSO?
        // To avoid misleading assumptions, only match explicit unit assignment or manager->EXEC!
        if (!rec.assignment && rec.user.role === 'manager' && unit.id === 'unit-exec') {
          return true;
        }
        return false;
      });

      const activeUsersCount = members.filter((m) => m.user.approved && m.user.active).length;
      const activeTasksCount = members.reduce((s, m) => s + m.activeTasksCount, 0);
      const completedTasksCount = members.reduce((s, m) => s + m.completedTasksCount, 0);
      const totalAssigned = members.reduce((s, m) => s + m.totalAssignedTasks, 0);
      const onTimeCompleted = members.reduce((s, m) => s + m.onTimeCompletedCount, 0);
      const overdueTasksCount = members.reduce((s, m) => s + m.overdueTasksCount, 0);
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
        completedTasksCount,
        overdueTasksCount,
        pendingReviewsCount,
        returnedSubmissionsCount,
        recognizedInitiativesCount,
        completionRate: computeKpiFraction(completedTasksCount, totalAssigned),
        onTimeRate: computeKpiFraction(onTimeCompleted, completedTasksCount),
        activitiesCount,
        memberIds: members.map((m) => m.user.id),
      };
    });
}

/**
 * Computes Regional Performance Summaries while PRESERVING HISTORICAL REGION ATTRIBUTION.
 * Tasks, activities, and initiatives are grouped by the region saved ON THOSE RECORDS,
 * NOT by the user's current `personnel_assignments.region_id`.
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

  return regions
    .filter((r) => r.is_active)
    .sort((a, b) => a.sort_order - b.sort_order)
    .map((region) => {
      // Currently assigned active personnel in this region
      const assignedPersonnelCount = personnelRecords.filter(
        (p) => p.user.approved && p.user.active && p.region?.id === region.id
      ).length;

      // Historical & current tasks whose recorded task.region belongs to this operating region
      const regionTasks = cohortTasks.filter(
        (t) => resolveOperatingRegionId(t.region, regions) === region.id
      );
      const activeTasks = regionTasks.filter((t) => t.status !== 'completed');
      const completedTasks = regionTasks.filter((t) => t.status === 'completed');
      const completedWithDue = completedTasks.filter((t) => Boolean(t.due_date));
      const onTimeCompleted = completedWithDue.filter((t) => isCompletedOnTime(t));
      const overdueTasksCount = activeTasks.filter((t) =>
        isTaskOverdue(t.due_date, t.status)
      ).length;
      const pendingReviewsCount = activeTasks.filter((t) => t.status === 'for_review').length;

      // Return events on tasks belonging to this region
      let returnedSubmissionsCount = 0;
      for (const t of tasks) {
        if (resolveOperatingRegionId(t.region, regions) === region.id) {
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
      }

      const regionActivities = cohortActivities.filter(
        (a) => resolveOperatingRegionId(a.region, regions) === region.id
      );

      const regionInitiatives = recognizedInits.filter(
        (i) => resolveOperatingRegionId(i.region, regions) === region.id
      );

      return {
        region,
        assignedPersonnelCount,
        activeTasksCount: activeTasks.length,
        completedTasksCount: completedTasks.length,
        overdueTasksCount,
        pendingReviewsCount,
        returnedSubmissionsCount,
        recognizedInitiativesCount: regionInitiatives.length,
        completionRate: computeKpiFraction(completedTasks.length, regionTasks.length),
        onTimeRate: computeKpiFraction(onTimeCompleted.length, completedWithDue.length),
        activitiesCount: regionActivities.length,
      };
    });
}

/**
 * Generates last 4 weeks / months trend buckets from real tasks, activities, and recognized initiatives
 * using Asia/Manila dates.
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
  const curMonth = parseInt(curMonthStr, 10); // 1..12

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
