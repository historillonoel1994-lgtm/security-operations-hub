import React, { useState, useMemo } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { PHILIPPINE_REGIONS } from '../lib/philippinesRegions.ts';
import { formatPhilippineDate, formatPhilippineDateTime, getPhilippineToday } from '../lib/dateUtils.ts';
import {
  CalendarCheck,
  Plus,
  Search,
  Filter,
  User,
  MapPin,
  Calendar,
  Clock,
  Link as LinkIcon,
  FileText,
} from 'lucide-react';

interface ActivitiesViewProps {
  onLogActivity: () => void;
}

export const ActivitiesView: React.FC<ActivitiesViewProps> = ({ onLogActivity }) => {
  const { currentUser, isManager } = useAuth();
  const { activities } = useData();

  const [searchTerm, setSearchTerm] = useState('');
  const [dateFilter, setDateFilter] = useState<'all' | 'today' | 'recent'>('all');
  const [regionFilter, setRegionFilter] = useState('all');

  const filteredActivities = useMemo(() => {
    const today = getPhilippineToday();

    return activities.filter((act) => {
      // Search
      if (searchTerm.trim()) {
        const query = searchTerm.toLowerCase();
        const matches =
          act.title.toLowerCase().includes(query) ||
          act.description.toLowerCase().includes(query) ||
          (act.author_name || '').toLowerCase().includes(query) ||
          (act.region || '').toLowerCase().includes(query) ||
          (act.linked_task_title || '').toLowerCase().includes(query);
        if (!matches) return false;
      }

      // Date filter
      if (dateFilter === 'today' && act.activity_date !== today) {
        return false;
      }
      if (dateFilter === 'recent') {
        // Last 7 days
        const actDate = new Date(`${act.activity_date}T00:00:00`);
        const todayDate = new Date(`${today}T00:00:00`);
        const diffDays = (todayDate.getTime() - actDate.getTime()) / (1000 * 3600 * 24);
        if (diffDays > 7 || diffDays < 0) return false;
      }

      // Region
      if (regionFilter !== 'all' && act.region !== regionFilter) {
        return false;
      }

      return true;
    });
  }, [activities, searchTerm, dateFilter, regionFilter]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Daily Security Activities Log
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            {isManager
              ? 'Authorized team accomplishments, guard briefings, and site logs across Philippine facilities'
              : 'Your recorded daily shift accomplishments, patrols, and incident follow-ups'}
          </p>
        </div>

        <button
          type="button"
          onClick={onLogActivity}
          className="inline-flex items-center justify-center px-4 py-2.5 bg-emerald-700 hover:bg-emerald-800 text-white text-sm font-semibold rounded-lg shadow-sm transition space-x-2"
        >
          <Plus className="w-4 h-4" />
          <span>+ Log Daily Activity</span>
        </button>
      </div>

      {/* Filter and Search Bar */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
          {/* Search */}
          <div className="relative">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-2.5" />
            <input
              type="text"
              placeholder="Search activity descriptions, sites, or officers..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 focus:outline-hidden text-slate-900"
            />
          </div>

          {/* Date Filter */}
          <div>
            <select
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value as any)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900 bg-white"
            >
              <option value="all">All Dates</option>
              <option value="today">Today's Logs Only</option>
              <option value="recent">Past 7 Days</option>
            </select>
          </div>

          {/* Region Filter */}
          <div>
            <select
              value={regionFilter}
              onChange={(e) => setRegionFilter(e.target.value)}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-emerald-500 text-slate-900 bg-white"
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

        {/* Status / Active Count */}
        <div className="flex items-center justify-between pt-1 border-t border-slate-100 text-xs text-slate-500">
          <span>
            Displaying <span className="font-bold text-slate-800">{filteredActivities.length}</span> activity record(s)
          </span>
          {(searchTerm || dateFilter !== 'all' || regionFilter !== 'all') && (
            <button
              type="button"
              onClick={() => {
                setSearchTerm('');
                setDateFilter('all');
                setRegionFilter('all');
              }}
              className="text-emerald-700 hover:underline font-medium"
            >
              Reset Filters
            </button>
          )}
        </div>
      </div>

      {/* Activities Feed */}
      {filteredActivities.length === 0 ? (
        <div className="bg-white p-12 text-center rounded-xl border border-slate-200 shadow-xs">
          <CalendarCheck className="w-10 h-10 mx-auto text-slate-300 mb-2" />
          <h3 className="font-semibold text-slate-700 text-sm">No daily security activities found</h3>
          <p className="text-xs text-slate-400 mt-1">
            Click "+ Log Daily Activity" above to record today's security accomplishments.
          </p>
        </div>
      ) : (
        <div className="space-y-4">
          {filteredActivities.map((act) => (
            <div
              key={act.id}
              className="bg-white rounded-xl border border-slate-200 p-5 shadow-xs hover:border-slate-300 transition space-y-3"
            >
              {/* Header: Date, Site, Author */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-2.5 text-xs text-slate-600">
                <div className="flex items-center space-x-3">
                  <span className="font-bold text-slate-900 flex items-center space-x-1">
                    <Calendar className="w-3.5 h-3.5 text-emerald-700" />
                    <span>{formatPhilippineDate(act.activity_date)}</span>
                  </span>

                  {act.region && (
                    <span className="flex items-center space-x-1 text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                      <MapPin className="w-3 h-3 text-slate-500" />
                      <span>{act.region}</span>
                    </span>
                  )}
                </div>

                <div className="flex items-center space-x-2 text-[11px] text-slate-500">
                  <User className="w-3 h-3 text-blue-600" />
                  <span className="font-medium text-slate-700">{act.author_name || 'Security Officer'}</span>
                  <span>•</span>
                  <span>{formatPhilippineDateTime(act.created_at)}</span>
                </div>
              </div>

              {/* Title & Description */}
              <div>
                <h3 className="font-bold text-slate-900 text-sm">{act.title}</h3>
                <p className="text-xs text-slate-700 mt-1 leading-relaxed whitespace-pre-wrap">
                  {act.description}
                </p>
              </div>

              {/* Linked Task Tag if present */}
              {act.linked_task_title && (
                <div className="pt-2 flex items-center space-x-1.5 text-xs text-blue-700 bg-blue-50/70 px-3 py-1.5 rounded-lg border border-blue-100">
                  <LinkIcon className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="font-semibold">Linked Task:</span>
                  <span className="truncate">{act.linked_task_title}</span>
                </div>
              )}

              {/* Remarks */}
              {act.remarks && (
                <div className="text-xs text-slate-500 italic bg-slate-50 px-3 py-1.5 rounded border border-slate-100">
                  <span className="font-medium not-italic text-slate-600">Remarks: </span>
                  {act.remarks}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
