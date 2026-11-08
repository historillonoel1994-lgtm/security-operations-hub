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
  record_type: 'task' | 'task_update' | 'activity' | 'profile' | 'auth';
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
