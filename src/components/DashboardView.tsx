import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Task, TaskStatus } from '../types/index.ts';
import { TASK_STATUS_CONFIG, TASK_PRIORITIES, PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { formatPhilippineDate, getDueStatusLabel, getPhilippineToday } from '../lib/dateUtils.ts';
import {
  CheckSquare,
  Clock,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Plus,
  Search,
  Filter,
  Eye,
  Building2,
  Calendar,
  AlertCircle,
  FileSpreadsheet,
} from 'lucide-react';

interface DashboardViewProps {
  onCreateTask: () => void;
  onSelectTask: (task: Task) => void;
  onNavigateToTasks: () => void;
}

export const DashboardView: React.FC<DashboardViewProps> = ({
  onCreateTask,
  onSelectTask,
  onNavigateToTasks,
}) => {
  const { currentUser, isManager, isLiveSupabase } = useAuth();
  const { tasks, summary } = useData();

  // Search and Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [regionFilter, setRegionFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<string>('all');

  // Filter tasks
  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matchesTitle = task.title.toLowerCase().includes(query);
        const matchesAssignee = (task.assigned_user_name || '').toLowerCase().includes(query);
        const matchesRegion = task.region.toLowerCase().includes(query);
        const matchesInstructions = task.instructions.toLowerCase().includes(query);
        if (!matchesTitle && !matchesAssignee && !matchesRegion && !matchesInstructions) {
          return false;
        }
      }

      // Status Filter
      if (statusFilter === 'overdue') {
        const dueInfo = getDueStatusLabel(task.due_date, task.status);
        if (!dueInfo.isOverdue) return false;
      } else if (statusFilter === 'due_today') {
        const dueInfo = getDueStatusLabel(task.due_date, task.status);
        if (!dueInfo.isToday) return false;
      } else if (statusFilter !== 'all') {
        if (task.status !== statusFilter) return false;
      }

      // Region Filter
      if (regionFilter !== 'all' && task.region !== regionFilter) {
        return false;
      }

      // Priority Filter
      if (priorityFilter !== 'all' && task.priority !== priorityFilter) {
        return false;
      }

      return true;
    });
  }, [tasks, searchTerm, statusFilter, regionFilter, priorityFilter]);

  return (
    <div className="space-y-6">
      {/* Demo Mode Notice Banner (Visibly labeled fictional records) */}
      {!isLiveSupabase && (
        <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-3 text-xs text-amber-900 shadow-xs">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <span className="font-bold block">DEMO SANDBOX MODE (Fictional Sample Records)</span>
            <span>
              All sample names, facilities, and activities shown are fictional test data for demonstration.
              No proprietary incident reports or real employee credentials are stored. Connect Supabase keys in{' '}
              <code className="bg-amber-100 px-1 py-0.5 rounded text-[11px] font-mono">.env.example</code> to activate live database storage.
            </span>
          </div>
        </div>
      )}

      {/* Header & Quick Action */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security Command Dashboard
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isManager
              ? 'Department overview of regional security inspections, assignments, and reviews'
              : 'Your assigned security inspections, investigations, and follow-ups'}
            {' • '}
            <span className="font-medium text-slate-700">
              Philippine Time: {formatPhilippineDate(getPhilippineToday())}
            </span>
          </p>
        </div>

        {isManager && (
          <button
            type="button"
            onClick={onCreateTask}
            className="inline-flex items-center justify-center px-4 py-2.5 bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold rounded-lg shadow-sm transition space-x-2"
          >
            <Plus className="w-4 h-4" />
            <span>+ Create Task</span>
          </button>
        )}
      </div>

      {/* 5 Small Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        {/* Card 1: Active Tasks */}
        <div
          onClick={() => setStatusFilter('all')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Active Tasks
            </span>
            <CheckSquare className="w-4 h-4 text-blue-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {summary.activeTasks}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Incomplete assignments</div>
        </div>

        {/* Card 2: Due Today */}
        <div
          onClick={() => setStatusFilter('due_today')}
          className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
            summary.dueToday > 0
              ? 'bg-amber-50/80 border-amber-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-amber-800 uppercase tracking-wider">
              Due Today
            </span>
            <Calendar className="w-4 h-4 text-amber-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-amber-900">
            {summary.dueToday}
          </div>
          <div className="text-[11px] text-amber-700/80 mt-0.5">Deadline is today</div>
        </div>

        {/* Card 3: Overdue */}
        <div
          onClick={() => setStatusFilter('overdue')}
          className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
            summary.overdue > 0
              ? 'bg-rose-50/80 border-rose-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-rose-800 uppercase tracking-wider">
              Overdue
            </span>
            <AlertTriangle className="w-4 h-4 text-rose-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-rose-900">
            {summary.overdue}
          </div>
          <div className="text-[11px] text-rose-700/80 mt-0.5">Past due date</div>
        </div>

        {/* Card 4: For Review */}
        <div
          onClick={() => setStatusFilter('for_review')}
          className={`p-4 rounded-xl border shadow-xs transition cursor-pointer ${
            summary.forReview > 0
              ? 'bg-indigo-50/80 border-indigo-300'
              : 'bg-white border-slate-200'
          }`}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-indigo-800 uppercase tracking-wider">
              For Review
            </span>
            <RotateCcw className="w-4 h-4 text-indigo-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-indigo-900">
            {summary.forReview}
          </div>
          <div className="text-[11px] text-indigo-700/80 mt-0.5">Awaiting Manager sign-off</div>
        </div>

        {/* Card 5: Completed */}
        <div
          onClick={() => setStatusFilter('completed')}
          className="p-4 bg-white rounded-xl border border-slate-200 shadow-xs hover:border-slate-300 transition cursor-pointer col-span-2 sm:col-span-1"
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-slate-500 uppercase tracking-wider">
              Completed
            </span>
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
          </div>
          <div className="mt-2 text-2xl font-bold text-slate-900">
            {summary.completed}
          </div>
          <div className="text-[11px] text-slate-400 mt-0.5">Officially closed</div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 text-xs">
          {/* Search Input */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search tasks, officers, or facilities..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900"
            />
          </div>

          {/* Status Quick Filter */}
          <div>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="all">All Statuses</option>
              <option value="due_today">Due Today</option>
              <option value="overdue">Overdue Only</option>
              <option value="for_review">For Review</option>
              <option value="in_progress">In Progress</option>
              <option value="assigned">Assigned</option>
              <option value="returned">Returned for Revision</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          {/* Region Quick Filter */}
          <div>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="all">All Philippine Regions / Sites</option>
              {PHILIPPINE_REGIONS.map((reg) => (
                <option key={reg} value={reg}>
                  {reg}
                </option>
              ))}
            </select>
          </div>

          {/* Priority Quick Filter */}
          <div>
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
            >
              <option value="all">All Priorities</option>
              <option value="urgent">Urgent Priority</option>
              <option value="high">High Priority</option>
              <option value="normal">Normal Priority</option>
            </select>
          </div>
        </div>

        {/* Active Filter Tags */}
        {(statusFilter !== 'all' || regionFilter !== 'all' || priorityFilter !== 'all' || searchTerm) && (
          <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs">
            <span className="text-slate-500">
              Showing <span className="font-bold text-slate-800">{filteredTasks.length}</span> matching record(s)
            </span>
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setStatusFilter('all');
                setRegionFilter('all');
                setPriorityFilter('all');
              }}
              className="text-blue-700 hover:underline font-medium"
            >
              Reset Filters
            </button>
          </div>
        )}
      </div>

      {/* Compact Table View: Task, Assigned To, Region, Due Date, Priority, Status, View */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
        <div className="px-5 py-3.5 border-b border-slate-200 flex items-center justify-between">
          <h2 className="font-semibold text-sm text-slate-900">
            {isManager ? 'Department Security Tasks' : 'My Assigned Work'}
          </h2>
          <span className="text-xs text-slate-500 font-medium">
            {filteredTasks.length} total
          </span>
        </div>

        {filteredTasks.length === 0 ? (
          <div className="p-8 text-center text-slate-400 text-sm">
            <CheckSquare className="w-8 h-8 mx-auto mb-2 text-slate-300" />
            <p>No security tasks match your current filter criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200">
                <tr>
                  <th className="px-4 py-3">Task Details</th>
                  <th className="px-4 py-3">Assigned To</th>
                  <th className="px-4 py-3">Region / Facility</th>
                  <th className="px-4 py-3">Due Date (PHT)</th>
                  <th className="px-4 py-3">Priority</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                {filteredTasks.map((task) => {
                  const statusCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.assigned;
                  const dueInfo = getDueStatusLabel(task.due_date, task.status);

                  return (
                    <tr
                      key={task.id}
                      className="hover:bg-slate-50/80 transition cursor-pointer"
                      onClick={() => onSelectTask(task)}
                    >
                      {/* Task Title & Category */}
                      <td className="px-4 py-3">
                        <div className="font-semibold text-slate-900 max-w-xs truncate">
                          {task.title}
                        </div>
                        <div className="text-[11px] text-slate-500 flex items-center space-x-2 mt-0.5">
                          <span>{task.category}</span>
                          {task.progress_percent !== undefined && (
                            <span>• {task.progress_percent}% complete</span>
                          )}
                        </div>
                      </td>

                      {/* Assigned To */}
                      <td className="px-4 py-3">
                        <div className="font-medium text-slate-800">
                          {task.assigned_user_name || 'Assigned Officer'}
                        </div>
                        <div className="text-[10px] text-slate-400 truncate max-w-[140px]">
                          {task.assigned_user_email}
                        </div>
                      </td>

                      {/* Region */}
                      <td className="px-4 py-3">
                        <div className="text-slate-700 max-w-[180px] truncate" title={task.region}>
                          {task.region}
                        </div>
                      </td>

                      {/* Due Date & Overdue Indicator */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="font-medium text-slate-900">
                          {formatPhilippineDate(task.due_date)}
                        </div>
                        {dueInfo.isOverdue && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-rose-700 bg-rose-100 px-1.5 py-0.2 rounded">
                            {dueInfo.label}
                          </span>
                        )}
                        {dueInfo.isToday && (
                          <span className="inline-block mt-0.5 text-[10px] font-bold text-amber-800 bg-amber-100 px-1.5 py-0.2 rounded">
                            Due Today
                          </span>
                        )}
                      </td>

                      {/* Priority */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2 py-0.5 rounded border capitalize ${
                            task.priority === 'urgent'
                              ? 'bg-rose-50 text-rose-700 border-rose-300'
                              : task.priority === 'high'
                              ? 'bg-amber-50 text-amber-800 border-amber-300'
                              : 'bg-slate-100 text-slate-700 border-slate-300'
                          }`}
                        >
                          {task.priority}
                        </span>
                      </td>

                      {/* Status */}
                      <td className="px-4 py-3 whitespace-nowrap">
                        <span
                          className={`inline-block text-[11px] font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}
                        >
                          {statusCfg.label}
                        </span>
                      </td>

                      {/* View Action */}
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectTask(task);
                          }}
                          className="inline-flex items-center px-2.5 py-1 text-xs font-medium text-blue-700 bg-blue-50 hover:bg-blue-100 rounded-md border border-blue-200 transition"
                        >
                          <Eye className="w-3.5 h-3.5 mr-1" />
                          <span>View</span>
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
