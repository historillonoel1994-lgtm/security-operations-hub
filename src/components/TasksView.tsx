import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { Task, TaskStatus } from '../types/index.ts';
import { TASK_STATUS_CONFIG, PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { formatPhilippineDate, getDueStatusLabel } from '../lib/dateUtils.ts';
import {
  CheckSquare,
  Plus,
  Search,
  Filter,
  User,
  MapPin,
  Calendar,
  AlertTriangle,
  RotateCcw,
  CheckCircle2,
  Clock,
  ArrowRight,
  Edit3,
} from 'lucide-react';

interface TasksViewProps {
  onCreateTask: () => void;
  onSelectTask: (task: Task) => void;
  onOpenEditTask?: (task: Task) => void;
  onOpenReopenTask?: (task: Task) => void;
}

export const TasksView: React.FC<TasksViewProps> = ({
  onCreateTask,
  onSelectTask,
  onOpenEditTask,
  onOpenReopenTask,
}) => {
  const { isManager, isApproved } = useAuth();
  const { tasks } = useData();

  const [activeStatusTab, setActiveStatusTab] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRegion, setSelectedRegion] = useState('all');

  const filteredTasks = useMemo(() => {
    return tasks.filter((task) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matches =
          task.title.toLowerCase().includes(query) ||
          (task.assigned_user_name || '').toLowerCase().includes(query) ||
          task.region.toLowerCase().includes(query) ||
          task.instructions.toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Region
      if (selectedRegion !== 'all' && task.region !== selectedRegion) {
        return false;
      }

      // Tab filter
      if (activeStatusTab === 'all') return true;
      if (activeStatusTab === 'overdue') {
        return getDueStatusLabel(task.due_date, task.status).isOverdue;
      }
      return task.status === activeStatusTab;
    });
  }, [tasks, searchTerm, selectedRegion, activeStatusTab]);

  const tabs = [
    { id: 'all', label: 'All Tasks', count: tasks.length },
    {
      id: 'for_review',
      label: 'For Review',
      count: tasks.filter((t) => t.status === 'for_review').length,
      badgeColor: 'bg-amber-100 text-amber-800',
    },
    {
      id: 'in_progress',
      label: 'In Progress',
      count: tasks.filter((t) => t.status === 'in_progress').length,
    },
    {
      id: 'assigned',
      label: 'Assigned',
      count: tasks.filter((t) => t.status === 'assigned').length,
    },
    {
      id: 'returned',
      label: 'Returned for Revision',
      count: tasks.filter((t) => t.status === 'returned').length,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'overdue',
      label: 'Overdue',
      count: tasks.filter((t) => getDueStatusLabel(t.due_date, t.status).isOverdue).length,
      badgeColor: 'bg-rose-100 text-rose-800',
    },
    {
      id: 'completed',
      label: 'Completed',
      count: tasks.filter((t) => t.status === 'completed').length,
    },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Security Tasks Management
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isManager
              ? 'Assign, monitor, and approve physical inspections, investigations, and CCTV audits'
              : 'Record progress, attach findings, and submit tasks for Security Manager review'}
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

      {/* Filter Tabs */}
      <div className="border-b border-slate-200">
        <div className="flex space-x-2 overflow-x-auto pb-1 text-xs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveStatusTab(tab.id)}
              className={`px-3 py-2 font-medium rounded-t-lg transition whitespace-nowrap flex items-center space-x-1.5 ${
                activeStatusTab === tab.id
                  ? 'border-b-2 border-blue-700 text-blue-800 font-bold bg-blue-50/50'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <span>{tab.label}</span>
              <span
                className={`text-[10px] px-1.5 py-0.2 rounded-full ${
                  tab.badgeColor || (activeStatusTab === tab.id ? 'bg-blue-200 text-blue-900' : 'bg-slate-200 text-slate-700')
                }`}
              >
                {tab.count}
              </span>
            </button>
          ))}
        </div>
      </div>

      {/* Search & Region Filter Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="relative sm:col-span-2">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
          <input
            type="text"
            placeholder="Search tasks by title, instructions, personnel, or site..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 focus:outline-hidden text-slate-900"
          />
        </div>

        <div>
          <select
            value={selectedRegion}
            onChange={(e) => setSelectedRegion(e.target.value)}
            className="w-full px-3 py-2 border border-slate-300 rounded-lg text-xs focus:ring-2 focus:ring-blue-500 text-slate-900 bg-white"
          >
            <option value="all">All Philippine Sites / Facilities</option>
            {PHILIPPINE_REGIONS.map((reg) => (
              <option key={reg} value={reg}>
                {reg}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Tasks List */}
      {filteredTasks.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <CheckSquare className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">No security tasks found</h3>
          <p className="text-xs text-slate-400 mt-1">
            {searchTerm || selectedRegion !== 'all' || activeStatusTab !== 'all'
              ? 'Try adjusting your search query or status filter.'
              : 'No tasks currently assigned.'}
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4">
          {filteredTasks.map((task) => {
            const statusCfg = TASK_STATUS_CONFIG[task.status] || TASK_STATUS_CONFIG.assigned;
            const dueInfo = getDueStatusLabel(task.due_date, task.status);

            return (
              <div
                key={task.id}
                onClick={() => onSelectTask(task)}
                className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-blue-400 hover:shadow-md transition cursor-pointer space-y-3"
              >
                {/* Header Row: Category, Priority, Status, Due Date */}
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-semibold px-2.5 py-0.5 rounded bg-slate-100 text-slate-800 border border-slate-200">
                      {task.category}
                    </span>
                    <span
                      className={`text-xs font-semibold px-2 py-0.5 rounded border capitalize ${
                        task.priority === 'urgent'
                          ? 'bg-rose-50 text-rose-800 border-rose-300 font-bold'
                          : task.priority === 'high'
                          ? 'bg-amber-50 text-amber-800 border-amber-300'
                          : 'bg-slate-100 text-slate-700 border-slate-300'
                      }`}
                    >
                      {task.priority} Priority
                    </span>
                  </div>

                  <div className="flex items-center space-x-2">
                    {dueInfo.isOverdue && (
                      <span className="text-[11px] font-bold text-rose-700 bg-rose-100 px-2 py-0.5 rounded border border-rose-300">
                        {dueInfo.label}
                      </span>
                    )}
                    {dueInfo.isToday && (
                      <span className="text-[11px] font-bold text-amber-800 bg-amber-100 px-2 py-0.5 rounded border border-amber-300">
                        Due Today
                      </span>
                    )}
                    <span
                      className={`text-xs font-semibold px-2.5 py-0.5 rounded-full border ${statusCfg.badgeClass}`}
                    >
                      {statusCfg.label}
                    </span>
                  </div>
                </div>

                {/* Title */}
                <div>
                  <h3 className="font-bold text-slate-900 text-base hover:text-blue-700 transition">
                    {task.title}
                  </h3>
                  <p className="text-xs text-slate-600 line-clamp-2 mt-1 leading-relaxed">
                    {task.instructions}
                  </p>
                </div>

                {/* Metadata & Progress Row */}
                <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 text-xs text-slate-600">
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                    <div className="flex items-center space-x-1.5">
                      <User className="w-3.5 h-3.5 text-blue-600" />
                      <span className="font-medium text-slate-800">
                        {task.assigned_user_name || 'Assigned Officer'}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <MapPin className="w-3.5 h-3.5 text-emerald-600" />
                      <span className="truncate max-w-[200px]" title={task.region}>
                        {task.region}
                      </span>
                    </div>

                    <div className="flex items-center space-x-1.5">
                      <Calendar className="w-3.5 h-3.5 text-amber-600" />
                      <span>Due: {formatPhilippineDate(task.due_date)}</span>
                    </div>
                  </div>

                  <div className="flex items-center space-x-3">
                    <div className="flex items-center space-x-2">
                      <div className="w-24 bg-slate-200 rounded-full h-2 overflow-hidden">
                        <div
                          className={`h-2 rounded-full ${
                            task.status === 'completed'
                              ? 'bg-emerald-600'
                              : (task.progress_percent || 0) >= 75
                              ? 'bg-blue-600'
                              : 'bg-amber-500'
                          }`}
                          style={{ width: `${Math.min(100, task.progress_percent || 0)}%` }}
                        ></div>
                      </div>
                      <span className="font-bold text-slate-800 text-[11px]">
                        {task.progress_percent || 0}%
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      {isManager && isApproved && task.status !== 'completed' && onOpenEditTask && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenEditTask(task);
                          }}
                          className="px-2.5 py-1 bg-slate-100 hover:bg-blue-100 text-slate-700 hover:text-blue-800 font-semibold text-xs rounded-md border border-slate-300 hover:border-blue-300 flex items-center space-x-1 transition cursor-pointer"
                          title="Edit task details or reassign personnel"
                        >
                          <Edit3 className="w-3 h-3 text-blue-600" />
                          <span>Edit</span>
                        </button>
                      )}

                      {isManager && isApproved && task.status === 'completed' && onOpenReopenTask && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onOpenReopenTask(task);
                          }}
                          className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-amber-800 font-semibold text-xs rounded-md border border-amber-300 flex items-center space-x-1 transition cursor-pointer"
                          title="Reopen completed task"
                        >
                          <RotateCcw className="w-3 h-3 text-amber-600" />
                          <span>Reopen</span>
                        </button>
                      )}

                      <button
                        type="button"
                        className="text-blue-700 hover:text-blue-900 font-semibold text-xs flex items-center space-x-1"
                      >
                        <span>View & Update</span>
                        <ArrowRight className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
