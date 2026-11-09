/**
 * Security Operations Hub (SOH) - Type Definitions
 * Designed for Philippine Corporate Security Management
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
  record_type: 'task' | 'task_update' | 'activity' | 'profile' | 'auth' | 'initiative';
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
