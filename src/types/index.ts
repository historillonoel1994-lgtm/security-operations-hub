/**
 * Security Operations Hub (SOH) - Type Definitions
 * Designed for Security Department Operations Management (Philippines)
 */

export type UserRole = 'manager' | 'member';

export interface UserProfile {
  id: string; // matches auth.users UUID
  email: string;
  display_name: string;
  role: UserRole;
  approved: boolean; // Must be approved by a Manager
  active: boolean; // Can be deactivated if offboarded
  regional_assignment?: string; // e.g., 'NCR - Metro Manila'
  created_at: string;
  updated_at?: string;
}

export type TaskCategory =
  | 'Inspection'
  | 'Investigation Follow-up'
  | 'CCTV / Access Concern'
  | 'Security Report'
  | 'Project Update'
  | 'Administrative Task'
  | 'Other';

export type TaskPriority = 'normal' | 'high' | 'urgent';

export type TaskStatus =
  | 'assigned'
  | 'in_progress'
  | 'for_review'
  | 'returned'
  | 'completed';

export interface Task {
  id: string;
  title: string;
  instructions: string;
  category: TaskCategory;
  assigned_to: string; // UserProfile id
  assigned_user_name?: string;
  assigned_user_email?: string;
  created_by: string; // Manager id
  created_by_name?: string;
  region: string; // Philippine region / facility site
  due_date: string; // YYYY-MM-DD
  priority: TaskPriority;
  status: TaskStatus;
  remarks?: string;
  progress_percent?: number;
  created_at: string;
  updated_at: string;
  completed_at?: string | null;
}

export interface EditTaskPayload {
  title: string;
  instructions: string;
  category: TaskCategory;
  assigned_to: string; // UserProfile id UUID
  region: string;
  due_date: string; // YYYY-MM-DD
  priority: TaskPriority;
  remarks?: string;
  reassignment_reason?: string; // Required if assigned_to is changed
}

export interface TaskUpdate {
  id: string;
  task_id: string;
  author_id: string;
  author_name?: string;
  author_role?: UserRole;
  progress_note: string;
  progress_percent?: number;
  submitted_for_review: boolean;
  manager_feedback?: string;
  status_change?: TaskStatus;
  created_at: string;
}

export interface SecurityActivity {
  id: string;
  author_id: string;
  author_name?: string;
  activity_date: string; // YYYY-MM-DD
  title: string;
  description: string;
  region?: string;
  task_id?: string | null;
  linked_task_title?: string;
  remarks?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  actor_id: string;
  actor_name?: string;
  action: string;
  record_type:
    | 'task'
    | 'task_update'
    | 'activity'
    | 'profile'
    | 'auth'
    | 'initiative'
    | 'personnel'
    | 'organization'
    | 'hierarchy'
    | 'performance';
  record_id?: string;
  details?: string;
  created_at: string;
}

export interface DashboardSummary {
  activeTasks: number;
  dueToday: number;
  overdue: number;
  forReview: number;
  completed: number;
}

// -------------------------------------------------------------
// MEMBER INITIATIVE & ACTIVITY RECOGNITION SYSTEM TYPES
// -------------------------------------------------------------

export type InitiativeType = 'proposed' | 'self_initiated';

export type InitiativeCategory =
  | 'Security Inspection'
  | 'Risk Identification'
  | 'Preventive Security Action'
  | 'CCTV / Door Access Concern'
  | 'Security Process Improvement'
  | 'Incident Prevention'
  | 'Coordination / Collaboration'
  | 'Workplace Safety'
  | 'Other';

export type InitiativeStatus =
  | 'draft'
  | 'pending_review'
  | 'approved_to_proceed'
  | 'in_progress'
  | 'accomplishment_submitted'
  | 'returned'
  | 'recognized'
  | 'rejected';

export interface MemberInitiative {
  id: string;
  submitted_by: string; // UserProfile id UUID
  submitted_by_name?: string;
  submitted_by_email?: string;
  initiative_type: InitiativeType;
  title: string;
  category: InitiativeCategory;
  region: string;
  location?: string;
  description: string; // Identified concern or operational gap
  action_details: string; // Proposed action or action taken
  expected_outcome: string; // Expected result or actual accomplishment
  activity_date: string; // YYYY-MM-DD
  justification: string; // Operational reason / justification
  supporting_document?: string;
  remarks?: string;
  related_task_id?: string | null;
  related_task_title?: string;
  status: InitiativeStatus;
  reviewed_by?: string | null;
  reviewed_by_name?: string;
  reviewed_at?: string | null;
  recognized_at?: string | null; // Set ONLY when officially recognized by manager
  manager_remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface InitiativeHistory {
  id: string;
  initiative_id: string;
  actor_id: string;
  actor_name?: string;
  actor_role?: UserRole;
  action: string;
  previous_status?: InitiativeStatus;
  new_status?: InitiativeStatus;
  notes?: string;
  created_at: string;
}

export interface CreateInitiativePayload {
  title: string;
  initiative_type: InitiativeType;
  category: InitiativeCategory;
  region: string;
  location?: string;
  description: string;
  action_details: string;
  expected_outcome: string;
  activity_date: string;
  justification: string;
  supporting_document?: string;
  remarks?: string;
  related_task_id?: string | null;
  is_draft?: boolean;
}

export interface EditInitiativePayload extends CreateInitiativePayload {
  resubmit_note?: string;
}

export interface SubmitAccomplishmentPayload {
  actual_accomplishment: string;
  supporting_document?: string;
  remarks?: string;
}

export interface InitiativeSummary {
  totalSubmitted: number;
  pendingReview: number;
  approvedProposals: number;
  recognized: number;
  returned: number;
  rejected: number;
}

// -------------------------------------------------------------
// PERSONNEL DIRECTORY, ORG HIERARCHY & PERFORMANCE TYPES
// -------------------------------------------------------------

export type EmploymentCategory =
  | 'organic_personnel'
  | 'supervisor'
  | 'management'
  | 'support_staff';

export type OperationalStatus =
  | 'active'
  | 'on_leave'
  | 'reassigned'
  | 'inactive';

export interface OrganizationalUnit {
  id: string;
  code: string;
  name: string;
  description?: string;
  parent_unit_id?: string | null;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OrganizationalPosition {
  id: string;
  title: string;
  unit_id?: string | null;
  hierarchy_level: number;
  is_supervisory: boolean;
  description?: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface OperatingRegion {
  id: string;
  code: string;
  name: string;
  island_group: string;
  sort_order: number;
  is_active: boolean;
  created_at?: string;
}

export interface PersonnelAssignment {
  profile_user_id: string;
  organizational_unit_id?: string | null;
  position_id?: string | null;
  reports_to_user_id?: string | null;
  region_id?: string | null;
  assigned_site?: string | null;
  employment_category: EmploymentCategory;
  operational_status: OperationalStatus;
  effective_from: string;
  notes?: string;
  updated_by?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface PersonnelReportingHistory {
  id: string;
  profile_user_id: string;
  previous_unit_id?: string | null;
  new_unit_id?: string | null;
  previous_position_id?: string | null;
  new_position_id?: string | null;
  previous_region_id?: string | null;
  new_region_id?: string | null;
  previous_assigned_site?: string | null;
  new_assigned_site?: string | null;
  previous_reports_to_user_id?: string | null;
  new_reports_to_user_id?: string | null;
  previous_operational_status?: string | null;
  new_operational_status?: string | null;
  change_reason: string;
  changed_by: string;
  changed_by_name?: string;
  effective_date: string;
  created_at: string;
}

export interface PerformanceTarget {
  id: string;
  unit_id?: string | null;
  position_id?: string | null;
  target_completion_rate: number;
  target_on_time_rate: number;
  monthly_initiative_goal: number;
  weight_completion?: number;
  weight_on_time?: number;
  weight_activity?: number;
  weight_initiative?: number;
  daily_activity_target?: number;
  notes?: string;
  updated_at?: string;
}

export interface SupervisorSummary {
  supervisor_id: string;
  supervisor_name: string;
  position_title: string;
  unit_name: string;
  region_name?: string;
}

export interface UpdatePersonnelAssignmentPayload {
  profile_user_id: string;
  organizational_unit_id: string | null;
  position_id: string | null;
  reports_to_user_id: string | null;
  region_id: string | null;
  assigned_site: string;
  employment_category: EmploymentCategory;
  operational_status: OperationalStatus;
  effective_from: string;
  notes?: string;
  change_reason: string;
  app_role?: UserRole; // Explicit manager-only authorization update
  regional_assignment_label?: string;
}

export type DateRangePreset = 'today' | 'week' | 'month' | 'quarter' | 'custom';

export interface KpiFraction {
  numerator: number;
  denominator: number;
  percentage: number | null;
  display: string; // e.g., "85% (17/20)" or "N/A"
}

export interface KpiFormulaBreakdown {
  metric: string;
  formula: string;
  numerator: number;
  denominator: number;
  weightPercent?: number;
  valueDisplay: string;
  sourceRecordSet: string;
}

export interface OperationalIndexSummary {
  score: number | null;
  display: string;
  label: string;
  isNonAppraisal: true;
  formulaDescription: string;
}

export interface FunctionIndicator {
  label: string;
  value: string;
  detail: string;
}

export interface PersonnelPerformanceRecord {
  user: UserProfile;
  assignment: PersonnelAssignment | null;
  unit: OrganizationalUnit | null;
  position: OrganizationalPosition | null;
  region: OperatingRegion | null;
  supervisor: { id: string; name: string; positionTitle: string; email?: string } | null;
  totalAssignedTasks: number;
  activeTasksCount: number; // Open tasks in selected cohort
  allOpenTasksCount: number; // All open tasks regardless of period
  dueTodayCount: number;
  overdueTasksCount: number; // Currently Overdue Tasks (all open tasks due_date < today PHT)
  becameOverdueInPeriodCount: number; // Open overdue tasks due inside [fromDate, toDate]
  historicalOverdueCount: number; // Open overdue tasks due strictly before fromDate
  completedLateInPeriodCount: number; // Closed in [fromDate, toDate] after due_date
  forReviewCount: number;
  returnedTasksCount: number;
  completedTasksCount: number;
  completedWithDueCount: number;
  onTimeCompletedCount: number;
  completionRate: KpiFraction;
  onTimeRate: KpiFraction;
  dailyActivityRate: KpiFraction;
  activitiesCount: number;
  totalInitiativesCount: number;
  pendingInitiativesCount: number;
  returnedInitiativesCount: number;
  recognizedInitiativesCount: number;
  returnedSubmissionsEvents: number;
  lastRecordedActivityDate: string | null;
  lastRecordedActivityTitle: string | null;
  hasAnyHistory: boolean;
  functionIndicators: FunctionIndicator[];
  appliedTarget: PerformanceTarget | null;
  operationalIndex: OperationalIndexSummary;
  kpiBreakdowns: KpiFormulaBreakdown[];
}

export interface UnitPerformanceSummary {
  unit: OrganizationalUnit;
  activeUsersCount: number;
  activeTasksCount: number;
  allOpenTasksCount: number;
  totalAssignedTasks: number;
  completedTasksCount: number;
  completedWithDueCount: number;
  onTimeCompletedCount: number;
  overdueTasksCount: number; // Currently Overdue Tasks
  becameOverdueInPeriodCount: number;
  completedLateInPeriodCount: number;
  pendingReviewsCount: number;
  returnedSubmissionsCount: number;
  recognizedInitiativesCount: number;
  completionRate: KpiFraction;
  onTimeRate: KpiFraction;
  activitiesCount: number;
  memberIds: string[];
}

export interface RegionalPerformanceSummary {
  region: OperatingRegion;
  assignedPersonnelCount: number;
  assignedSupervisors: { id: string; name: string; positionTitle: string }[];
  activeTasksCount: number;
  allOpenTasksCount: number;
  totalCohortTasks: number;
  completedTasksCount: number;
  completedWithDueCount: number;
  onTimeCompletedCount: number;
  overdueTasksCount: number; // Currently Overdue Tasks in this region
  becameOverdueInPeriodCount: number;
  completedLateInPeriodCount: number;
  pendingReviewsCount: number;
  returnedSubmissionsCount: number;
  recognizedInitiativesCount: number;
  completionRate: KpiFraction;
  onTimeRate: KpiFraction;
  activitiesCount: number;
  latestActivityDate: string | null;
  isConsolidatedGroup?: boolean;
  childRegionIds?: string[];
}

