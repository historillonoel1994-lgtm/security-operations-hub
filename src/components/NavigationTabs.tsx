import React from 'react';
import { LayoutDashboard, CheckSquare, CalendarCheck, BarChart3 } from 'lucide-react';
import { useData } from '../context/DataContext.tsx';

export type ActiveTab = 'dashboard' | 'tasks' | 'activities' | 'reports';

interface NavigationTabsProps {
  activeTab: ActiveTab;
  onTabChange: (tab: ActiveTab) => void;
}

export const NavigationTabs: React.FC<NavigationTabsProps> = ({
  activeTab,
  onTabChange,
}) => {
  const { summary } = useData();

  const tabs: {
    id: ActiveTab;
    label: string;
    icon: React.ComponentType<{ className?: string }>;
    badge?: number;
    badgeColor?: string;
  }[] = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: LayoutDashboard,
    },
    {
      id: 'tasks',
      label: 'Tasks',
      icon: CheckSquare,
      badge: summary.forReview > 0 ? summary.forReview : undefined,
      badgeColor: 'bg-amber-100 text-amber-800 border border-amber-300',
    },
    {
      id: 'activities',
      label: 'Daily Activities',
      icon: CalendarCheck,
    },
    {
      id: 'reports',
      label: 'Reports',
      icon: BarChart3,
    },
  ];

  return (
    <div className="bg-white border-b border-slate-200 shadow-xs">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <nav className="flex space-x-2 sm:space-x-8 overflow-x-auto py-2" aria-label="Tabs">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => onTabChange(tab.id)}
                className={`flex items-center px-3 py-2.5 text-sm font-medium rounded-lg transition whitespace-nowrap ${
                  isActive
                    ? 'bg-blue-50 text-blue-800 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Icon
                  className={`w-4 h-4 mr-2 ${
                    isActive ? 'text-blue-700' : 'text-slate-400'
                  }`}
                />
                <span>{tab.label}</span>
                {tab.badge !== undefined && (
                  <span
                    className={`ml-2 px-1.5 py-0.5 text-[11px] font-bold rounded-full ${
                      tab.badgeColor || 'bg-slate-100 text-slate-700'
                    }`}
                    title={`${tab.badge} task(s) awaiting review`}
                  >
                    {tab.badge}
                  </span>
                )}
              </button>
            );
          })}
        </nav>
      </div>
    </div>
  );
};
