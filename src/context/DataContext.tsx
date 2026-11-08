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
  loading: boolean;
  createTask: (payload: CreateTaskPayload) => Promise<Task>;
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
  refreshData: () => Promise<void>;
}

const DataContext = createContext<DataContextType | undefined>(undefined);

export const DataProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { currentUser, isManager, isApproved, allProfiles } = useAuth();

  const [rawTasks, setRawTasks] = useState<Task[]>([]);
  const [rawUpdates, setRawUpdates] = useState<TaskUpdate[]>([]);
  const [rawActivities, setRawActivities] = useState<SecurityActivity[]>([]);
  const [rawAuditLogs, setRawAuditLogs] = useState<AuditLog[]>([]);
  const [loading, setLoading] = useState<boolean>(true);

  // Main fetch function: strictly queries Supabase database tables
  const refreshData = useCallback(async () => {
    // If user is not authenticated or not approved, wipe state and return immediately
    if (!currentUser || !isApproved) {
      setRawTasks([]);
      setRawUpdates([]);
      setRawActivities([]);
      setRawAuditLogs([]);
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

      // 4. Fetch audit logs (only managers have permission in RLS)
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

  return (
    <DataContext.Provider
      value={{
        tasks: authorizedTasks,
        allDepartmentTasks: isManager ? rawTasks : [],
        activities: authorizedActivities,
        taskUpdates: taskUpdatesByTaskId,
        auditLogs: rawAuditLogs,
        summary,
        loading,
        createTask,
        updateTaskProgress,
        reviewTask,
        createActivity,
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
