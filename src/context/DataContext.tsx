/**
 * Data Management Context (Production Mode)
 * Security Operations Hub (SOH)
 *
 * Exclusively queries and updates the real Supabase database:
 * 1. tasks: Regional assignments, due dates, priorities, lifecycle status.
 * 2. task_updates: Chronological notes, percentages, and manager review notes.
 * 3. activities: Daily shift accomplishments.
 * 4. audit_logs: System compliance events.
 *
 * Strict Access & RLS Alignment:
 * - Unauthenticated or unapproved users receive zero records.
 * - Team Members see only their own assigned tasks & personal daily activities.
 * - Managers view full department records and can assign/review tasks.
 */

import React, { createContext, useContext, useState, useEffect, useCallback, useMemo } from 'react';
import {
  Task,
  TaskUpdate,
  SecurityActivity,
  AuditLog,
  DashboardSummary,
  TaskStatus,
  TaskPriority,
  TaskCategory,
  EditTaskPayload,
  MemberInitiative,
  InitiativeHistory,
  CreateInitiativePayload,
  EditInitiativePayload,
  SubmitAccomplishmentPayload,
  InitiativeSummary,
  InitiativeStatus,
} from '../types/index.ts';
import { isTaskOverdue, isTaskDueToday, getPhilippineToday } from '../lib/dateUtils.ts';
import { useAuth } from './AuthContext.tsx';
import { getSupabaseClient } from '../lib/supabaseClient.ts';

interface CreateTaskPayload {
  title: string;
  instructions: string;
  category: TaskCategory;
  assigned_to: string;
  region: string;
  due_date: string;
  priority: TaskPriority;
  remarks?: string;
}

interface CreateActivityPayload {
  activity_date: string;
  title: string;
  description: string;
  region?: string;
  task_id?: string | null;
  remarks?: string;
}

interface DataContextType {
  tasks: Task[];
  allDepartmentTasks: Task[]; // For managers
  activities: SecurityActivity[];
  taskUpdates: Record<string, TaskUpdate[]>;
  auditLogs: AuditLog[];
  summary: DashboardSummary;
  initiatives: MemberInitiative[];
  allDepartmentInitiatives: MemberInitiative[];
  initiativeHistory: Record<string, InitiativeHistory[]>;
  initiativeSummary: InitiativeSummary;
  initiativesTableReady: boolean;
  loading: boolean;
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
  editTask: (taskId: string, payload: EditTaskPayload) => Promise<void>;
  reopenTask: (taskId: string, reason: string) => Promise<void>;
  updateTaskProgress: (
    taskId: string,
    progressNote: string,
    progressPercent?: number,
    submitForReview?: boolean
  ) => Promise<void>;
  reviewTask: (
    taskId: string,
    decision: 'approve' | 'return',
    feedbackNote: string
  ) => Promise<void>;
  createActivity: (payload: CreateActivityPayload) => Promise<SecurityActivity>;
  createInitiative: (payload: CreateInitiativePayload) => Promise<MemberInitiative>;
  editInitiative: (id: string, payload: EditInitiativePayload) => Promise<void>;
  startInitiativeProgress: (id: string) => Promise<void>;
  submitInitiativeAccomplishment: (id: string, payload: SubmitAccomplishmentPayload) => Promise<void>;
  reviewInitiative: (
    id: string,
    decision: 'approve' | 'return' | 'reject' | 'recognize' | 'revoke',
    remarks: string
  ) => Promise<void>;
  deleteDraftInitiative: (id: string) => Promise<void>;
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isManager, isApproved, allProfiles } = useAuth();

  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [rawUpdates, setRawUpdates] = useState<TaskUpdate[]>([]);
  const [rawActivities, setRawActivities] = useState<SecurityActivity[]>([]);
  const [rawAuditLogs, setRawAuditLogs] = useState<AuditLog[]>([]);
  const [rawInitiatives, setRawInitiatives] = useState<MemberInitiative[]>([]);
  const [rawInitiativeHistory, setRawInitiativeHistory] = useState<InitiativeHistory[]>([]);
  const [initiativesTableReady, setInitiativesTableReady] = useState<boolean>(true);
  const [loading, setLoading] = useState<boolean>(true);

  // Main fetch function: strictly queries Supabase database tables
  const refreshData = useCallback(async () => {
    // If user is not authenticated or not approved, wipe state and return immediately
    if (!currentUser || !isApproved) {
      setRawTasks([]);
      setRawUpdates([]);
      setRawActivities([]);
      setRawAuditLogs([]);
      setRawInitiatives([]);
      setRawInitiativeHistory([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    const supabase = getSupabaseClient();

    try {
      // 1. Fetch tasks
      const { data: tasksData, error: tasksErr } = await supabase
        .from('tasks')
        .select('*')
        .order('due_date', { ascending: true });

      if (tasksErr) {
        console.error('Error fetching tasks from Supabase:', tasksErr.message);
      } else if (tasksData) {
        setRawTasks(tasksData as Task[]);
      }

      // 2. Fetch task updates
      const { data: updatesData, error: updatesErr } = await supabase
        .from('task_updates')
        .select('*')
        .order('created_at', { ascending: true });

      if (updatesErr) {
        console.error('Error fetching task updates from Supabase:', updatesErr.message);
      } else if (updatesData) {
        setRawUpdates(updatesData as TaskUpdate[]);
      }

      // 3. Fetch activities
      const { data: activitiesData, error: actErr } = await supabase
        .from('activities')
        .select('*')
        .order('activity_date', { ascending: false });

      if (actErr) {
        console.error('Error fetching activities from Supabase:', actErr.message);
      } else if (activitiesData) {
        setRawActivities(activitiesData as SecurityActivity[]);
      }

      // 4. Fetch member initiatives
      try {
        const { data: initData, error: initErr } = await supabase
          .from('member_initiatives')
          .select('*')
          .order('created_at', { ascending: false });

        if (initErr) {
          if (initErr.message?.includes('member_initiatives') || initErr.code === '42P01') {
            setInitiativesTableReady(false);
          } else {
            console.warn('Initiatives query note:', initErr.message);
          }
        } else if (initData) {
          setInitiativesTableReady(true);
          setRawInitiatives(initData as MemberInitiative[]);
        }
      } catch (err: any) {
        console.warn('Initiatives fetch caught:', err.message);
      }

      // 5. Fetch initiative history
      try {
        const { data: histData, error: histErr } = await supabase
          .from('initiative_history')
          .select('*')
          .order('created_at', { ascending: true });

        if (!histErr && histData) {
          setRawInitiativeHistory(histData as InitiativeHistory[]);
        }
      } catch (err: any) {
        console.warn('Initiative history fetch caught:', err.message);
      }

      // 6. Fetch audit logs (only managers have permission in RLS)
      if (isManager) {
        const { data: auditData, error: auditErr } = await supabase
          .from('audit_logs')
          .select('*')
          .order('created_at', { ascending: false })
          .limit(100);

        if (!auditErr && auditData) {
          setRawAuditLogs(auditData as AuditLog[]);
        }
      } else {
        setRawAuditLogs([]);
      }
    } catch (err: any) {
      console.error('Network exception fetching database records:', err.message);
    } finally {
      setLoading(false);
    }
  }, [currentUser, isApproved, isManager]);

  useEffect(() => {
    refreshData();
  }, [refreshData]);

  // Strict role segregation filtering:
  // - If user is unapproved or inactive: ZERO tasks or activities.
  // - If user is a member: ONLY tasks assigned to their user ID & their own activities.
  // - If user is a manager: Full authorized departmental records.
  const authorizedTasks = useMemo(() => {
    if (!currentUser || !isApproved) return [];
    if (isManager) return rawTasks;
    return rawTasks.filter((t) => t.assigned_to === currentUser.id);
  }, [currentUser, isApproved, isManager, rawTasks]);

  const authorizedActivities = useMemo(() => {
    if (!currentUser || !isApproved) return [];
    if (isManager) return rawActivities;
    return rawActivities.filter((a) => a.author_id === currentUser.id);
  }, [currentUser, isApproved, isManager, rawActivities]);

  // Group task updates by task_id
  const taskUpdatesByTaskId = useMemo(() => {
    const map: Record<string, TaskUpdate[]> = {};
    for (const update of rawUpdates) {
      if (!map[update.task_id]) {
        map[update.task_id] = [];
      }
      map[update.task_id].push(update);
    }
    return map;
  }, [rawUpdates]);

  // Compute 5 Dashboard Summary Cards
  const summary: DashboardSummary = useMemo(() => {
    const list = authorizedTasks;
    return {
      activeTasks: list.filter((t) => t.status !== 'completed').length,
      dueToday: list.filter((t) => isTaskDueToday(t.due_date, t.status)).length,
      overdue: list.filter((t) => isTaskOverdue(t.due_date, t.status)).length,
      forReview: list.filter((t) => t.status === 'for_review').length,
      completed: list.filter((t) => t.status === 'completed').length,
    };
  }, [authorizedTasks]);

  // Strict role segregation filtering for member initiatives
  const authorizedInitiatives = useMemo(() => {
    if (!currentUser || !isApproved) return [];
    if (isManager) return rawInitiatives;
    return rawInitiatives.filter((i) => i.submitted_by === currentUser.id);
  }, [currentUser, isApproved, isManager, rawInitiatives]);

  // Group initiative history by initiative_id
  const initiativeHistoryById = useMemo(() => {
    const map: Record<string, InitiativeHistory[]> = {};
    for (const item of rawInitiativeHistory) {
      if (!map[item.initiative_id]) {
        map[item.initiative_id] = [];
      }
      map[item.initiative_id].push(item);
    }
    return map;
  }, [rawInitiativeHistory]);

  // Compute Initiative Summary Cards
  const initiativeSummary: InitiativeSummary = useMemo(() => {
    const list = authorizedInitiatives;
    return {
      totalSubmitted: list.filter((i) => i.status !== 'draft').length,
      pendingReview: list.filter((i) => i.status === 'pending_review' || i.status === 'accomplishment_submitted').length,
      approvedProposals: list.filter((i) => i.status === 'approved_to_proceed' || i.status === 'in_progress').length,
      recognized: list.filter((i) => i.status === 'recognized').length,
      returned: list.filter((i) => i.status === 'returned').length,
      rejected: list.filter((i) => i.status === 'rejected').length,
    };
  }, [authorizedInitiatives]);

  // CREATE TASK (Manager Only)
  const createTask = async (payload: CreateTaskPayload): Promise<Task> => {
    if (!isManager || !currentUser) {
      throw new Error('Unauthorized: Only an approved Security Manager can create and assign tasks.');
    }
    if (!payload.title.trim() || !payload.instructions.trim() || !payload.assigned_to || !payload.due_date) {
      throw new Error('Please fill in all required fields (Title, Instructions, Assigned User, Due Date).');
    }

    const assignedUser = allProfiles.find((p) => p.id === payload.assigned_to);
    const nowIso = new Date().toISOString();

    const newTask: Task = {
      id: `tsk-${Date.now().toString().slice(-6)}`,
      title: payload.title.trim(),
      instructions: payload.instructions.trim(),
      category: payload.category,
      assigned_to: payload.assigned_to,
      assigned_user_name: assignedUser?.display_name || 'Assigned Officer',
      assigned_user_email: assignedUser?.email || '',
      created_by: currentUser.id,
      created_by_name: currentUser.display_name,
      region: payload.region,
      due_date: payload.due_date,
      priority: payload.priority,
      status: 'assigned',
      remarks: payload.remarks?.trim() || '',
      progress_percent: 0,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: 'CREATE_TASK',
      record_type: 'task',
      record_id: newTask.id,
      details: `Created task "${newTask.title}" assigned to ${newTask.assigned_user_name} (Due: ${newTask.due_date})`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('tasks').insert(newTask).select().single();
    if (error) throw error;

    await supabase.from('audit_logs').insert(newAudit);
    await refreshData();
    return (data as Task) || newTask;
  };

  // EDIT & REASSIGN TASK (Manager Only)
  const editTask = async (taskId: string, payload: EditTaskPayload): Promise<void> => {
    if (!isManager || !currentUser || !isApproved) {
      throw new Error('Unauthorized: Only an authorized Security Manager can edit or reassign tasks.');
    }
    if (!payload.title.trim() || !payload.instructions.trim() || !payload.assigned_to || !payload.due_date) {
      throw new Error('Please fill in all required fields (Title, Instructions, Assigned Personnel, Due Date).');
    }

    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');

    const newAssignee = allProfiles.find((p) => p.id === payload.assigned_to);
    if (!newAssignee || !newAssignee.approved || !newAssignee.active) {
      throw new Error('Selected personnel is invalid, unapproved, or inactive.');
    }

    const isReassigned = task.assigned_to !== payload.assigned_to;
    if (isReassigned && (!payload.reassignment_reason || !payload.reassignment_reason.trim())) {
      throw new Error('A mandatory reason is required when reassigning designated personnel.');
    }

    const nowIso = new Date().toISOString();
    const changes: string[] = [];

    if (task.title !== payload.title.trim()) {
      changes.push(`Title changed from "${task.title}" to "${payload.title.trim()}"`);
    }
    if (task.category !== payload.category) {
      changes.push(`Category changed from "${task.category}" to "${payload.category}"`);
    }
    if (task.region !== payload.region) {
      changes.push(`Region changed from "${task.region}" to "${payload.region}"`);
    }
    if (task.due_date !== payload.due_date) {
      changes.push(`Due Date changed from ${task.due_date} to ${payload.due_date}`);
    }
    if (task.priority !== payload.priority) {
      changes.push(`Priority changed from "${task.priority}" to "${payload.priority}"`);
    }
    if (task.instructions !== payload.instructions.trim()) {
      changes.push('Instructions updated');
    }
    if ((task.remarks || '') !== (payload.remarks?.trim() || '')) {
      changes.push('Remarks updated');
    }
    if (isReassigned) {
      changes.push(
        `Personnel reassigned from ${task.assigned_user_name || task.assigned_to} (${task.assigned_user_email || 'N/A'}) to ${newAssignee.display_name} (${newAssignee.email}). Reason: ${payload.reassignment_reason?.trim()}`
      );
    }

    const changesSummary = changes.length > 0 ? changes.join('; ') : 'Task details verified by Manager';

    // 1. Task update history entry (visible in chronological timeline)
    const newUpdate: TaskUpdate = {
      id: `upd-${Date.now().toString().slice(-6)}`,
      task_id: taskId,
      author_id: currentUser.id,
      author_name: currentUser.display_name,
      author_role: 'manager',
      progress_note: isReassigned
        ? `[PERSONNEL REASSIGNED by Manager]\nTransferred from: ${task.assigned_user_name || task.assigned_to} (${task.assigned_user_email || 'N/A'})\nTransferred to: ${newAssignee.display_name} (${newAssignee.email})\nReason: ${payload.reassignment_reason?.trim()}${changes.length > 1 ? '\nAdditional updates: ' + changes.filter(c => !c.startsWith('Personnel reassigned')).join('; ') : ''}`
        : `[TASK EDITED by Manager]\n${changesSummary}`,
      submitted_for_review: false,
      progress_percent: task.progress_percent,
      created_at: nowIso,
    };

    // 2. Audit log entry for corporate accountability
    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: isReassigned ? 'REASSIGN_TASK_PERSONNEL' : 'EDIT_TASK',
      record_type: 'task',
      record_id: taskId,
      details: isReassigned
        ? `Reassigned task "${task.title}" (ID: ${task.id}) from ${task.assigned_user_name} (${task.assigned_to}) to ${newAssignee.display_name} (${newAssignee.id}). Reason: ${payload.reassignment_reason?.trim()}. Summary: ${changesSummary}`
        : `Edited task "${task.title}" (ID: ${task.id}). Changes: ${changesSummary}`,
      created_at: nowIso,
    };

    // 3. Update database record in Supabase
    const supabase = getSupabaseClient();
    const { error: updTaskErr } = await supabase
      .from('tasks')
      .update({
        title: payload.title.trim(),
        instructions: payload.instructions.trim(),
        category: payload.category,
        assigned_to: newAssignee.id,
        assigned_user_name: newAssignee.display_name,
        assigned_user_email: newAssignee.email,
        region: payload.region,
        due_date: payload.due_date,
        priority: payload.priority,
        remarks: payload.remarks?.trim() || null,
        updated_at: nowIso,
      })
      .eq('id', taskId);

    if (updTaskErr) throw updTaskErr;

    await supabase.from('task_updates').insert(newUpdate);
    await supabase.from('audit_logs').insert(newAudit);

    await refreshData();
  };

  // REOPEN COMPLETED TASK (Manager Only)
  const reopenTask = async (taskId: string, reopenReason: string): Promise<void> => {
    if (!isManager || !currentUser || !isApproved) {
      throw new Error('Unauthorized: Only an authorized Security Manager can reopen completed tasks.');
    }
    if (!reopenReason.trim()) {
      throw new Error('Please provide a mandatory reason for reopening this completed task.');
    }

    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');

    const nowIso = new Date().toISOString();

    const newUpdate: TaskUpdate = {
      id: `upd-${Date.now().toString().slice(-6)}`,
      task_id: taskId,
      author_id: currentUser.id,
      author_name: currentUser.display_name,
      author_role: 'manager',
      progress_note: `[TASK REOPENED by Manager]\nTask status reopened from Completed to In Progress for additional field action.\nReason: ${reopenReason.trim()}`,
      status_change: 'in_progress',
      submitted_for_review: false,
      progress_percent: task.progress_percent,
      created_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: 'REOPEN_TASK',
      record_type: 'task',
      record_id: taskId,
      details: `Reopened completed task "${task.title}" (ID: ${task.id}). Reason: ${reopenReason.trim()}`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { error: updTaskErr } = await supabase
      .from('tasks')
      .update({
        status: 'in_progress',
        completed_at: null,
        updated_at: nowIso,
      })
      .eq('id', taskId);

    if (updTaskErr) throw updTaskErr;

    await supabase.from('task_updates').insert(newUpdate);
    await supabase.from('audit_logs').insert(newAudit);

    await refreshData();
  };

  // UPDATE TASK PROGRESS (Personnel or Manager)
  const updateTaskProgress = async (
    taskId: string,
    progressNote: string,
    progressPercent?: number,
    submitForReview?: boolean
  ) => {
    if (!currentUser || !isApproved) {
      throw new Error('Unauthorized to post task updates.');
    }
    if (!progressNote.trim()) {
      throw new Error('Please write a progress update note.');
    }

    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');

    // Team members cannot modify other members' tasks
    if (!isManager && task.assigned_to !== currentUser.id) {
      throw new Error('Access denied: You can only update tasks assigned to you.');
    }

    const nowIso = new Date().toISOString();
    let newStatus: TaskStatus = task.status;

    if (submitForReview) {
      newStatus = 'for_review';
    } else if (task.status === 'assigned' || task.status === 'returned') {
      newStatus = 'in_progress';
    }

    const newUpdate: TaskUpdate = {
      id: `upd-${Date.now().toString().slice(-6)}`,
      task_id: taskId,
      author_id: currentUser.id,
      author_name: currentUser.display_name,
      author_role: currentUser.role,
      progress_note: progressNote.trim(),
      progress_percent: progressPercent !== undefined ? progressPercent : task.progress_percent,
      submitted_for_review: Boolean(submitForReview),
      status_change: newStatus !== task.status ? newStatus : undefined,
      created_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: submitForReview ? 'SUBMIT_FOR_REVIEW' : 'ADD_PROGRESS_UPDATE',
      record_type: 'task_update',
      record_id: taskId,
      details: submitForReview
        ? `Submitted task "${task.title}" for Manager review (${progressPercent ?? task.progress_percent}%)`
        : `Added progress note (${progressPercent ?? task.progress_percent}%): ${progressNote.slice(0, 60)}...`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { error: updErr } = await supabase.from('task_updates').insert(newUpdate);
    if (updErr) throw updErr;

    const { error: tskErr } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        progress_percent: progressPercent !== undefined ? progressPercent : task.progress_percent,
        updated_at: nowIso,
      })
      .eq('id', taskId);
    if (tskErr) throw tskErr;

    await supabase.from('audit_logs').insert(newAudit);
    await refreshData();
  };

  // REVIEW TASK (Manager Only: Approve or Return)
  const reviewTask = async (
    taskId: string,
    decision: 'approve' | 'return',
    feedbackNote: string
  ) => {
    if (!isManager || !currentUser) {
      throw new Error('Unauthorized: Only an authorized Security Manager can approve or return tasks.');
    }
    if (decision === 'return' && !feedbackNote.trim()) {
      throw new Error('Please provide revision instructions when returning a task.');
    }

    const task = rawTasks.find((t) => t.id === taskId);
    if (!task) throw new Error('Task not found.');

    const nowIso = new Date().toISOString();
    const isApprove = decision === 'approve';
    const newStatus: TaskStatus = isApprove ? 'completed' : 'returned';

    const newUpdate: TaskUpdate = {
      id: `upd-${Date.now().toString().slice(-6)}`,
      task_id: taskId,
      author_id: currentUser.id,
      author_name: currentUser.display_name,
      author_role: 'manager',
      progress_note: isApprove
        ? `Task approved and closed by Manager. ${feedbackNote.trim() || 'Work meets corporate standards.'}`
        : `Task returned for revision: ${feedbackNote.trim()}`,
      manager_feedback: feedbackNote.trim(),
      status_change: newStatus,
      submitted_for_review: false,
      progress_percent: isApprove ? 100 : task.progress_percent,
      created_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: isApprove ? 'APPROVE_TASK' : 'RETURN_TASK_FOR_REVISION',
      record_type: 'task',
      record_id: taskId,
      details: isApprove
        ? `Approved and completed task "${task.title}"`
        : `Returned task "${task.title}" for revision: ${feedbackNote.slice(0, 60)}`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { error: updErr } = await supabase.from('task_updates').insert(newUpdate);
    if (updErr) throw updErr;

    const { error: tskErr } = await supabase
      .from('tasks')
      .update({
        status: newStatus,
        progress_percent: isApprove ? 100 : task.progress_percent,
        remarks: feedbackNote.trim() ? feedbackNote.trim() : task.remarks,
        completed_at: isApprove ? nowIso : null,
        updated_at: nowIso,
      })
      .eq('id', taskId);
    if (tskErr) throw tskErr;

    await supabase.from('audit_logs').insert(newAudit);
    await refreshData();
  };

  // CREATE DAILY ACTIVITY
  const createActivity = async (payload: CreateActivityPayload): Promise<SecurityActivity> => {
    if (!currentUser || !isApproved) {
      throw new Error('Unauthorized to record daily security activities.');
    }
    if (!payload.title.trim() || !payload.description.trim()) {
      throw new Error('Activity Title and Accomplishment Description are required.');
    }

    const nowIso = new Date().toISOString();
    let linkedTaskTitle: string | undefined = undefined;
    if (payload.task_id) {
      const matched = rawTasks.find((t) => t.id === payload.task_id);
      if (matched) linkedTaskTitle = matched.title;
    }

    const newActivity: SecurityActivity = {
      id: `act-${Date.now().toString().slice(-6)}`,
      author_id: currentUser.id,
      author_name: currentUser.display_name,
      activity_date: payload.activity_date || getPhilippineToday(),
      title: payload.title.trim(),
      description: payload.description.trim(),
      region: payload.region || currentUser.regional_assignment || 'NCR - Metro Manila',
      task_id: payload.task_id || null,
      linked_task_title: linkedTaskTitle,
      remarks: payload.remarks?.trim() || '',
      created_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: 'LOG_ACTIVITY',
      record_type: 'activity',
      record_id: newActivity.id,
      details: `Logged activity "${newActivity.title}" for ${newActivity.activity_date}`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('activities').insert(newActivity).select().single();
    if (error) throw error;

    await supabase.from('audit_logs').insert(newAudit);
    await refreshData();
    return (data as SecurityActivity) || newActivity;
  };

  // -------------------------------------------------------------------------------------
  // MEMBER INITIATIVE & RECOGNITION ACTIONS
  // -------------------------------------------------------------------------------------

  // CREATE MEMBER INITIATIVE (Proposed Activity or Self-Initiated Accomplishment)
  const createInitiative = async (payload: CreateInitiativePayload): Promise<MemberInitiative> => {
    if (!currentUser || !isApproved) {
      throw new Error('Unauthorized: Only approved personnel can submit initiatives.');
    }
    if (
      !payload.title.trim() ||
      !payload.description.trim() ||
      !payload.action_details.trim() ||
      !payload.expected_outcome.trim() ||
      !payload.justification.trim() ||
      !payload.activity_date
    ) {
      throw new Error('Please fill in all required initiative fields (Title, Concern, Action, Expected Outcome, Date, Justification).');
    }

    const nowIso = new Date().toISOString();
    const initId = `init-${Date.now().toString().slice(-6)}`;
    let initialStatus: InitiativeStatus = 'draft';
    if (!payload.is_draft) {
      initialStatus = payload.initiative_type === 'self_initiated'
        ? 'accomplishment_submitted'
        : 'pending_review';
    }

    let relatedTaskTitle: string | undefined = undefined;
    if (payload.related_task_id) {
      const matched = rawTasks.find((t) => t.id === payload.related_task_id);
      if (matched) relatedTaskTitle = matched.title;
    }

    const newInit: MemberInitiative = {
      id: initId,
      submitted_by: currentUser.id,
      submitted_by_name: currentUser.display_name,
      submitted_by_email: currentUser.email,
      initiative_type: payload.initiative_type,
      title: payload.title.trim(),
      category: payload.category,
      region: payload.region,
      location: payload.location?.trim() || '',
      description: payload.description.trim(),
      action_details: payload.action_details.trim(),
      expected_outcome: payload.expected_outcome.trim(),
      activity_date: payload.activity_date,
      justification: payload.justification.trim(),
      supporting_document: payload.supporting_document?.trim() || '',
      remarks: payload.remarks?.trim() || '',
      related_task_id: payload.related_task_id || null,
      related_task_title: relatedTaskTitle,
      status: initialStatus,
      created_at: nowIso,
      updated_at: nowIso,
    };

    const historyNote = payload.is_draft
      ? 'Draft initiative saved by member'
      : payload.initiative_type === 'self_initiated'
      ? 'Self-initiated routine accomplishment submitted for Manager validation'
      : 'Proposed activity initiative submitted for Manager review';

    const newHistory: InitiativeHistory = {
      id: `inh-${Date.now().toString().slice(-6)}`,
      initiative_id: initId,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      actor_role: currentUser.role,
      action: payload.is_draft ? 'CREATE_DRAFT' : 'SUBMIT_FOR_REVIEW',
      previous_status: undefined,
      new_status: initialStatus,
      notes: historyNote,
      created_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: payload.is_draft ? 'CREATE_INITIATIVE_DRAFT' : 'SUBMIT_MEMBER_INITIATIVE',
      record_type: 'initiative',
      record_id: initId,
      details: `Created initiative "${newInit.title}" (${newInit.initiative_type}) at ${newInit.region}. Status: ${initialStatus}`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { data, error } = await supabase.from('member_initiatives').insert(newInit).select().single();
    if (error) {
      if (error.message?.includes('member_initiatives') || error.code === '42P01') {
        throw new Error(
          'Supabase database migration required: Please run "supabase/migration_initiatives.sql" in your Supabase SQL Editor to create the member_initiatives table.'
        );
      }
      throw error;
    }

    try {
      await supabase.from('initiative_history').insert(newHistory);
      await supabase.from('audit_logs').insert(newAudit);
    } catch (auditErr: any) {
      console.warn('Initiative audit append note:', auditErr.message);
    }

    await refreshData();
    return (data as MemberInitiative) || newInit;
  };

  // EDIT MEMBER INITIATIVE (Draft or Returned for Revision)
  const editInitiative = async (id: string, payload: EditInitiativePayload): Promise<void> => {
    if (!currentUser || !isApproved) {
      throw new Error('Unauthorized to edit initiatives.');
    }
    const item = rawInitiatives.find((i) => i.id === id);
    if (!item) throw new Error('Initiative not found.');

    if (!isManager && item.submitted_by !== currentUser.id) {
      throw new Error('Access denied: You can only edit your own initiatives.');
    }
    if (!isManager && item.status !== 'draft' && item.status !== 'returned') {
      throw new Error('Submitted or recognized initiatives cannot be silently edited. Please contact your Security Manager.');
    }

    const nowIso = new Date().toISOString();
    let newStatus = item.status;
    let actionName = 'EDIT_INITIATIVE';
    let historyNote = payload.resubmit_note?.trim() || 'Initiative details updated by member';

    if (item.status === 'returned' && !payload.is_draft) {
      newStatus = item.initiative_type === 'self_initiated' ? 'accomplishment_submitted' : 'pending_review';
      actionName = 'RESUBMIT_FOR_REVIEW';
      historyNote = `[RESUBMITTED AFTER REVISION] ${payload.resubmit_note?.trim() || 'Corrected per manager feedback.'}`;
    } else if (item.status === 'draft' && !payload.is_draft) {
      newStatus = item.initiative_type === 'self_initiated' ? 'accomplishment_submitted' : 'pending_review';
      actionName = 'SUBMIT_FOR_REVIEW';
      historyNote = 'Draft initiative officially submitted for Manager review';
    }

    let relatedTaskTitle = item.related_task_title;
    if (payload.related_task_id && payload.related_task_id !== item.related_task_id) {
      const matched = rawTasks.find((t) => t.id === payload.related_task_id);
      if (matched) relatedTaskTitle = matched.title;
    }

    const updatedFields = {
      title: payload.title.trim(),
      initiative_type: payload.initiative_type,
      category: payload.category,
      region: payload.region,
      location: payload.location?.trim() || '',
      description: payload.description.trim(),
      action_details: payload.action_details.trim(),
      expected_outcome: payload.expected_outcome.trim(),
      activity_date: payload.activity_date,
      justification: payload.justification.trim(),
      supporting_document: payload.supporting_document?.trim() || '',
      remarks: payload.remarks?.trim() || '',
      related_task_id: payload.related_task_id || null,
      related_task_title: relatedTaskTitle,
      status: newStatus,
      updated_at: nowIso,
    };

    const newHistory: InitiativeHistory = {
      id: `inh-${Date.now().toString().slice(-6)}`,
      initiative_id: id,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      actor_role: currentUser.role,
      action: actionName,
      previous_status: item.status,
      new_status: newStatus,
      notes: historyNote,
      created_at: nowIso,
    };

    const newAudit: AuditLog = {
      id: `aud-${Date.now()}`,
      actor_id: currentUser.id,
      actor_name: currentUser.display_name,
      action: actionName,
      record_type: 'initiative',
      record_id: id,
      details: `Updated initiative "${updatedFields.title}". Status: ${newStatus}`,
      created_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('member_initiatives').update(updatedFields).eq('id', id);
    if (error) throw error;

    try {
      await supabase.from('initiative_history').insert(newHistory);
      await supabase.from('audit_logs').insert(newAudit);
    } catch (auditErr: any) {
      console.warn('Initiative audit append note:', auditErr.message);
    }

    await refreshData();
  };

  // START PROPOSED INITIATIVE (Approved to Proceed -> In Progress)
  const startInitiativeProgress = async (id: string): Promise<void> => {
    if (!currentUser || !isApproved) throw new Error('Unauthorized');
    const item = rawInitiatives.find((i) => i.id === id);
    if (!item) throw new Error('Initiative not found.');
    if (item.status !== 'approved_to_proceed') {
      throw new Error('Only approved proposals can be moved to in-progress.');
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('member_initiatives')
      .update({ status: 'in_progress', updated_at: nowIso })
      .eq('id', id);
    if (error) throw error;

    try {
      await supabase.from('initiative_history').insert({
        id: `inh-${Date.now().toString().slice(-6)}`,
        initiative_id: id,
        actor_id: currentUser.id,
        actor_name: currentUser.display_name,
        actor_role: currentUser.role,
        action: 'START_PROGRESS',
        previous_status: 'approved_to_proceed',
        new_status: 'in_progress',
        notes: 'Member started field execution of authorized proposed initiative.',
        created_at: nowIso,
      });
    } catch (err: any) {
      console.warn('History append note:', err.message);
    }

    await refreshData();
  };

  // SUBMIT ACCOMPLISHMENT (In Progress -> Accomplishment Submitted)
  const submitInitiativeAccomplishment = async (
    id: string,
    payload: SubmitAccomplishmentPayload
  ): Promise<void> => {
    if (!currentUser || !isApproved) throw new Error('Unauthorized');
    const item = rawInitiatives.find((i) => i.id === id);
    if (!item) throw new Error('Initiative not found.');
    if (!payload.actual_accomplishment.trim()) {
      throw new Error('Please describe the actual accomplishment or findings.');
    }

    const nowIso = new Date().toISOString();
    const supabase = getSupabaseClient();
    const { error } = await supabase
      .from('member_initiatives')
      .update({
        expected_outcome: payload.actual_accomplishment.trim(),
        supporting_document: payload.supporting_document?.trim() || item.supporting_document,
        remarks: payload.remarks?.trim() || item.remarks,
        status: 'accomplishment_submitted',
        updated_at: nowIso,
      })
      .eq('id', id);
    if (error) throw error;

    try {
      await supabase.from('initiative_history').insert({
        id: `inh-${Date.now().toString().slice(-6)}`,
        initiative_id: id,
        actor_id: currentUser.id,
        actor_name: currentUser.display_name,
        actor_role: currentUser.role,
        action: 'SUBMIT_ACCOMPLISHMENT',
        previous_status: item.status,
        new_status: 'accomplishment_submitted',
        notes: `Accomplishment submitted: ${payload.actual_accomplishment.slice(0, 100)}...`,
        created_at: nowIso,
      });
    } catch (err: any) {
      console.warn('History append note:', err.message);
    }

    await refreshData();
  };

  // REVIEW & RECOGNIZE INITIATIVE (Manager Only)
  const reviewInitiative = async (
    id: string,
    decision: 'approve' | 'return' | 'reject' | 'recognize' | 'revoke',
    remarks: string
  ): Promise<void> => {
    if (!isManager || !currentUser || !isApproved) {
      throw new Error('Unauthorized: Only an approved Security Manager can evaluate and recognize member initiatives.');
    }
    const item = rawInitiatives.find((i) => i.id === id);
    if (!item) throw new Error('Initiative not found.');

    if (['return', 'reject', 'revoke'].includes(decision) && !remarks.trim()) {
      throw new Error(`A mandatory written explanation is required to ${decision} an initiative.`);
    }

    const nowIso = new Date().toISOString();
    let newStatus: InitiativeStatus = item.status;
    let recognizedAt: string | null = item.recognized_at || null;
    let actionName = 'REVIEW_INITIATIVE';
    let noteSummary = remarks.trim();

    switch (decision) {
      case 'approve':
        newStatus = 'approved_to_proceed';
        actionName = 'APPROVE_PROPOSAL';
        noteSummary = `[PROPOSAL AUTHORIZED] Work authorized by Manager. ${remarks.trim() || 'Proceed with field execution according to standard security protocols.'}`;
        break;
      case 'return':
        newStatus = 'returned';
        actionName = 'RETURN_FOR_REVISION';
        noteSummary = `[RETURNED FOR REVISION] ${remarks.trim()}`;
        break;
      case 'reject':
        newStatus = 'rejected';
        actionName = 'REJECT_INITIATIVE';
        noteSummary = `[INITIATIVE DECLINED] Reason: ${remarks.trim()}`;
        break;
      case 'recognize':
        newStatus = 'recognized';
        recognizedAt = nowIso;
        actionName = 'RECOGNIZE_INITIATIVE';
        noteSummary = `[OFFICIALLY RECOGNIZED] Accomplishment validated and recognized by Security Management. ${remarks.trim() || 'Commendable initiative meeting physical security compliance standards.'}`;
        break;
      case 'revoke':
        newStatus = 'returned';
        recognizedAt = null;
        actionName = 'REVOKE_RECOGNITION';
        noteSummary = `[RECOGNITION REVOKED] Recognition revoked due to material finding/correction: ${remarks.trim()}`;
        break;
    }

    const updatePayload: any = {
      status: newStatus,
      reviewed_by: currentUser.id,
      reviewed_by_name: currentUser.display_name,
      reviewed_at: nowIso,
      recognized_at: recognizedAt,
      manager_remarks: remarks.trim() || item.manager_remarks,
      updated_at: nowIso,
    };

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('member_initiatives').update(updatePayload).eq('id', id);
    if (error) throw error;

    try {
      await supabase.from('initiative_history').insert({
        id: `inh-${Date.now().toString().slice(-6)}`,
        initiative_id: id,
        actor_id: currentUser.id,
        actor_name: currentUser.display_name,
        actor_role: 'manager',
        action: actionName,
        previous_status: item.status,
        new_status: newStatus,
        notes: noteSummary,
        created_at: nowIso,
      });

      await supabase.from('audit_logs').insert({
        id: `aud-${Date.now()}`,
        actor_id: currentUser.id,
        actor_name: currentUser.display_name,
        action: actionName,
        record_type: 'initiative',
        record_id: id,
        details: `${actionName}: "${item.title}" submitted by ${item.submitted_by_name}. Status changed from ${item.status} to ${newStatus}. Note: ${remarks.slice(0, 80)}`,
        created_at: nowIso,
      });
    } catch (auditErr: any) {
      console.warn('Initiative audit append note:', auditErr.message);
    }

    await refreshData();
  };

  // DELETE DRAFT INITIATIVE
  const deleteDraftInitiative = async (id: string): Promise<void> => {
    if (!currentUser || !isApproved) throw new Error('Unauthorized');
    const item = rawInitiatives.find((i) => i.id === id);
    if (!item) throw new Error('Initiative not found.');
    if (!isManager && item.submitted_by !== currentUser.id) {
      throw new Error('Access denied.');
    }
    if (item.status !== 'draft') {
      throw new Error('Only draft initiatives can be deleted.');
    }

    const supabase = getSupabaseClient();
    const { error } = await supabase.from('member_initiatives').delete().eq('id', id);
    if (error) throw error;
    await refreshData();
  };

  return (
    <DataContext.Provider
      value={{
        tasks: authorizedTasks,
        allDepartmentTasks: isManager ? rawTasks : [],
        activities: authorizedActivities,
        taskUpdates: taskUpdatesByTaskId,
        auditLogs: rawAuditLogs,
        summary,
        initiatives: authorizedInitiatives,
        allDepartmentInitiatives: isManager ? rawInitiatives : [],
        initiativeHistory: initiativeHistoryById,
        initiativeSummary,
        initiativesTableReady,
        loading,
        createTask,
        editTask,
        reopenTask,
        updateTaskProgress,
        reviewTask,
        createActivity,
        createInitiative,
        editInitiative,
        startInitiativeProgress,
        submitInitiativeAccomplishment,
        reviewInitiative,
        deleteDraftInitiative,
        refreshData,
      }}
    >
      {children}
    </DataContext.Provider>
  );
};

export const useData = (): DataContextType => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
