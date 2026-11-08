import React from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import { formatPhilippineDate, formatPhilippineDateTime, getPhilippineToday, getDueStatusLabel } from '../lib/dateUtils.ts';
import { ArrowLeft, Printer, Shield } from 'lucide-react';

interface PrintReportViewProps {
  onBack: () => void;
}

export const PrintReportView: React.FC<PrintReportViewProps> = ({ onBack }) => {
  const { currentUser } = useAuth();
  const { tasks, activities } = useData();

  const today = getPhilippineToday();
  const completedTasks = tasks.filter((t) => t.status === 'completed');
  const overdueTasks = tasks.filter((t) => getDueStatusLabel(t.due_date, t.status).isOverdue);
  const activeTasks = tasks.filter((t) => t.status !== 'completed');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="min-h-screen bg-slate-100 p-4 sm:p-8 print:p-0 print:bg-white text-slate-900">
      {/* Non-print controls bar */}
      <div className="max-w-4xl mx-auto mb-6 flex items-center justify-between print:hidden">
        <button
          type="button"
          onClick={onBack}
          className="inline-flex items-center space-x-1.5 px-3 py-1.5 bg-white border border-slate-300 rounded-lg text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>Back to Operations Hub</span>
        </button>

        <button
          type="button"
          onClick={handlePrint}
          className="inline-flex items-center space-x-1.5 px-4 py-2 bg-blue-700 text-white rounded-lg text-xs font-semibold hover:bg-blue-800 transition shadow-xs"
        >
          <Printer className="w-4 h-4" />
          <span>Print / Save as PDF</span>
        </button>
      </div>

      {/* Official Report Container */}
      <div className="max-w-4xl mx-auto bg-white p-8 sm:p-12 rounded-xl shadow-xs border border-slate-200 print:border-none print:shadow-none print:p-0 space-y-6">
        {/* Document Header */}
        <div className="border-b-2 border-slate-900 pb-6 flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center space-x-2 text-slate-900">
              <Shield className="w-6 h-6 text-blue-900" />
              <span className="text-xl font-bold uppercase tracking-wider">
                Corporate Security Operations Hub
              </span>
            </div>
            <p className="text-xs text-slate-600 font-medium">
              Regional Security Operations & Compliance Summary Report (Philippines)
            </p>
          </div>

          <div className="text-right text-xs text-slate-600">
            <div>
              <span className="font-semibold text-slate-800">Date Generated:</span>{' '}
              {formatPhilippineDateTime(new Date().toISOString())}
            </div>
            <div>
              <span className="font-semibold text-slate-800">Reviewing Manager:</span>{' '}
              {currentUser?.display_name || 'Security Department'}
            </div>
          </div>
        </div>

        {/* Executive Summary Metrics */}
        <div className="grid grid-cols-4 gap-4 p-4 bg-slate-50 border border-slate-200 rounded-lg text-center text-xs">
          <div>
            <span className="text-slate-500 font-medium">Total Active Tasks</span>
            <div className="text-xl font-bold text-slate-900 mt-0.5">{activeTasks.length}</div>
          </div>
          <div>
            <span className="text-rose-700 font-medium">Overdue Tasks</span>
            <div className="text-xl font-bold text-rose-800 mt-0.5">{overdueTasks.length}</div>
          </div>
          <div>
            <span className="text-emerald-700 font-medium">Completed Tasks</span>
            <div className="text-xl font-bold text-emerald-800 mt-0.5">{completedTasks.length}</div>
          </div>
          <div>
            <span className="text-blue-700 font-medium">Shift Activities</span>
            <div className="text-xl font-bold text-blue-800 mt-0.5">{activities.length}</div>
          </div>
        </div>

        {/* Section 1: Active Tasks Roster */}
        <div className="space-y-3">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            1. Current Active Security Tasks & Assignments
          </h2>
          <table className="w-full text-left text-xs border border-slate-200">
            <thead className="bg-slate-100 font-semibold border-b border-slate-200 text-slate-700">
              <tr>
                <th className="p-2">Task</th>
                <th className="p-2">Assigned Personnel</th>
                <th className="p-2">Facility / Site</th>
                <th className="p-2">Due Date</th>
                <th className="p-2">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {activeTasks.length === 0 ? (
                <tr>
                  <td colSpan={5} className="p-3 text-center text-slate-400 italic">
                    No active tasks currently pending.
                  </td>
                </tr>
              ) : (
                activeTasks.map((t) => (
                  <tr key={t.id}>
                    <td className="p-2 font-medium text-slate-900">{t.title}</td>
                    <td className="p-2 text-slate-700">{t.assigned_user_name}</td>
                    <td className="p-2 text-slate-600">{t.region}</td>
                    <td className="p-2 text-slate-800 font-medium">{formatPhilippineDate(t.due_date)}</td>
                    <td className="p-2 capitalize font-semibold">{t.status.replace('_', ' ')}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Section 2: Recent Shift Activities */}
        <div className="space-y-3 pt-2">
          <h2 className="text-xs font-bold uppercase tracking-wider text-slate-900 border-b border-slate-300 pb-1">
            2. Shift Accomplishments & Daily Log Summary
          </h2>
          <div className="space-y-2 text-xs">
            {activities.length === 0 ? (
              <p className="text-slate-400 italic py-2">No shift activities recorded.</p>
            ) : (
              activities.slice(0, 10).map((act) => (
                <div key={act.id} className="p-2.5 border border-slate-200 rounded text-xs space-y-1">
                  <div className="flex justify-between font-semibold text-slate-900">
                    <span>{act.title}</span>
                    <span className="text-[11px] font-normal text-slate-500">
                      {formatPhilippineDate(act.activity_date)} • {act.region || 'Site'}
                    </span>
                  </div>
                  <p className="text-slate-700">{act.description}</p>
                  <div className="text-[10px] text-slate-500">
                    Logged by {act.author_name}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Section 3: Manager Sign-Off Block */}
        <div className="pt-8 border-t border-slate-300 grid grid-cols-2 gap-8 text-xs">
          <div className="space-y-12">
            <div>
              <span className="font-semibold block text-slate-700">Prepared & Filed By:</span>
              <p className="text-slate-500 text-[11px]">Authorized Security Supervisor / Lead</p>
            </div>
            <div className="border-t border-slate-400 pt-1 text-slate-600">
              Signature over Printed Name / Date
            </div>
          </div>

          <div className="space-y-12">
            <div>
              <span className="font-semibold block text-slate-700">Reviewed & Approved By:</span>
              <p className="text-slate-500 text-[11px]">Corporate Security Manager</p>
            </div>
            <div className="border-t border-slate-400 pt-1 text-slate-600">
              Signature over Printed Name / Date
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
