/**
 * Security Operations Hub (SOH) - Main Application Entry
 *
 * Implements:
 * 1. Role-based routing: Manager vs Team Member vs Pending User
 * 2. Complete isolation: Logging out unloads all authenticated state immediately
 * 3. Main Pages: Dashboard, Tasks, Daily Activities, Initiatives, Personnel / My Performance, and Reports
 * 4. Account controls: User Approvals (Manager), Org Assignment Editor, and Profile
 */

import React, { useState } from 'react';
import { AuthProvider, useAuth } from './context/AuthContext.tsx';
import { DataProvider } from './context/DataContext.tsx';
import { Navbar } from './components/Navbar.tsx';
import { NavigationTabs, ActiveTab } from './components/NavigationTabs.tsx';
import { DashboardView } from './components/DashboardView.tsx';
import { TasksView } from './components/TasksView.tsx';
import { ActivitiesView } from './components/ActivitiesView.tsx';
import { ReportsView } from './components/ReportsView.tsx';
import { InitiativesView } from './components/InitiativesView.tsx';
import { PersonnelDirectoryView } from './components/PersonnelDirectoryView.tsx';
import { MyPerformanceView } from './components/MyPerformanceView.tsx';
import { PrintReportView } from './components/PrintReportView.tsx';
import { LoginView } from './components/LoginView.tsx';
import { PendingApprovalScreen } from './components/PendingApprovalScreen.tsx';
import { CreateTaskModal } from './components/CreateTaskModal.tsx';
import { TaskDetailModal } from './components/TaskDetailModal.tsx';
import { EditTaskModal } from './components/EditTaskModal.tsx';
import { ReopenTaskModal } from './components/ReopenTaskModal.tsx';
import { CreateActivityModal } from './components/CreateActivityModal.tsx';
import { CreateInitiativeModal } from './components/CreateInitiativeModal.tsx';
import { EditInitiativeModal } from './components/EditInitiativeModal.tsx';
import { InitiativeDetailModal } from './components/InitiativeDetailModal.tsx';
import { SubmitAccomplishmentModal } from './components/SubmitAccomplishmentModal.tsx';
import { PersonnelPerformanceModal } from './components/PersonnelPerformanceModal.tsx';
import { EditPersonnelAssignmentModal } from './components/EditPersonnelAssignmentModal.tsx';
import { UserApprovalsModal } from './components/UserApprovalsModal.tsx';
import { UserProfileModal } from './components/UserProfileModal.tsx';
import { Task, MemberInitiative, UserProfile } from './types/index.ts';
import { Shield } from 'lucide-react';

interface PrintReportConfig {
  active: boolean;
  userId?: string | null;
  fromDate?: string;
  toDate?: string;
}

const MainAppContent: React.FC = () => {
  const { currentUser, loading, isApproved, isManager, allProfiles } = useAuth();

  const [activeTab, setActiveTab] = useState<ActiveTab>('dashboard');
  const [selectedTask, setSelectedTask] = useState<Task | null>(null);
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [reopeningTask, setReopeningTask] = useState<Task | null>(null);

  // Initiative States
  const [selectedInitiative, setSelectedInitiative] = useState<MemberInitiative | null>(null);
  const [editingInitiative, setEditingInitiative] = useState<MemberInitiative | null>(null);
  const [accomplishmentInitiative, setAccomplishmentInitiative] = useState<MemberInitiative | null>(
    null
  );
  const [createInitiativeOpen, setCreateInitiativeOpen] = useState(false);

  // Personnel & Performance Modal States
  const [performanceModalUserId, setPerformanceModalUserId] = useState<string | null>(null);
  const [editingAssignmentUser, setEditingAssignmentUser] = useState<UserProfile | null>(null);
  const [defaultTaskAssigneeId, setDefaultTaskAssigneeId] = useState<string | undefined>(undefined);

  // Modal Visibility States
  const [createTaskOpen, setCreateTaskOpen] = useState(false);
  const [createActivityOpen, setCreateActivityOpen] = useState(false);
  const [approvalsOpen, setApprovalsOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [printConfig, setPrintConfig] = useState<PrintReportConfig>({ active: false });

  // Loading state
  if (loading) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-4 text-white">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
        <div className="flex items-center space-x-2 text-base font-bold">
          <Shield className="w-5 h-5 text-blue-400" />
          <span>Security Operations Hub</span>
        </div>
        <p className="text-xs text-slate-400 mt-1">Initializing secure credentials & session...</p>
      </div>
    );
  }

  // Unauthenticated: show LoginView (no private records visible)
  if (!currentUser) {
    return <LoginView />;
  }

  // Authenticated but unapproved: show PendingApprovalScreen
  if (!isApproved) {
    return <PendingApprovalScreen />;
  }

  // Print-Friendly Report View
  if (printConfig.active) {
    return (
      <PrintReportView
        onBack={() => setPrintConfig({ active: false })}
        targetUserId={printConfig.userId}
        reportFromDate={printConfig.fromDate}
        reportToDate={printConfig.toDate}
      />
    );
  }

  const handleOpenCreateTaskForUser = (userId?: string) => {
    setDefaultTaskAssigneeId(userId);
    setCreateTaskOpen(true);
  };

  const handleOpenPrintIndividualReport = (userId: string, fromDate: string, toDate: string) => {
    setPrintConfig({
      active: true,
      userId,
      fromDate,
      toDate,
    });
  };

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col font-sans text-slate-900">
      {/* Top Navigation Bar */}
      <Navbar
        onOpenApprovals={() => setApprovalsOpen(true)}
        onOpenProfile={() => setProfileOpen(true)}
      />

      {/* Navigation Tabs */}
      <NavigationTabs activeTab={activeTab} onTabChange={setActiveTab} />

      {/* Main Content Workspace */}
      <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {activeTab === 'dashboard' && (
          <DashboardView
            onCreateTask={() => handleOpenCreateTaskForUser(undefined)}
            onSelectTask={(task) => setSelectedTask(task)}
            onNavigateToTasks={() => setActiveTab('tasks')}
            onNavigateToInitiatives={() => setActiveTab('initiatives')}
            onSelectInitiative={(init) => setSelectedInitiative(init)}
            onNavigateToPersonnel={() => setActiveTab('personnel')}
            onNavigateToMyPerformance={() => setActiveTab('my_performance')}
            onOpenApprovals={() => setApprovalsOpen(true)}
            onViewPersonnelPerformance={(uid) => setPerformanceModalUserId(uid)}
          />
        )}

        {activeTab === 'tasks' && (
          <TasksView
            onCreateTask={() => handleOpenCreateTaskForUser(undefined)}
            onSelectTask={(task) => setSelectedTask(task)}
            onOpenEditTask={(task) => setEditingTask(task)}
            onOpenReopenTask={(task) => setReopeningTask(task)}
          />
        )}

        {activeTab === 'initiatives' && (
          <InitiativesView
            onCreateInitiative={() => setCreateInitiativeOpen(true)}
            onSelectInitiative={(init: MemberInitiative) => setSelectedInitiative(init)}
            onOpenEditInitiative={(init: MemberInitiative) => setEditingInitiative(init)}
            onOpenSubmitAccomplishment={(init: MemberInitiative) => setAccomplishmentInitiative(init)}
          />
        )}

        {activeTab === 'activities' && (
          <ActivitiesView onLogActivity={() => setCreateActivityOpen(true)} />
        )}

        {activeTab === 'personnel' && isManager && (
          <PersonnelDirectoryView
            onViewPerformance={(uid) => setPerformanceModalUserId(uid)}
            onEditAssignment={(user) => setEditingAssignmentUser(user)}
            onOpenApprovals={() => setApprovalsOpen(true)}
          />
        )}

        {activeTab === 'my_performance' && (
          <MyPerformanceView
            onSelectTask={(task) => setSelectedTask(task)}
            onSelectInitiative={(init) => setSelectedInitiative(init)}
            onOpenPrintPersonalReport={(fromDate, toDate) =>
              handleOpenPrintIndividualReport(currentUser.id, fromDate, toDate)
            }
          />
        )}

        {activeTab === 'reports' && (
          <ReportsView
            onOpenPrintView={() => setPrintConfig({ active: true })}
            onOpenPrintIndividualReport={handleOpenPrintIndividualReport}
            onViewPersonnelPerformance={
              isManager ? (uid) => setPerformanceModalUserId(uid) : undefined
            }
          />
        )}
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
        <div className="max-w-7xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Security Operations Hub (SOH) • Corporate Security Department</span>
          <span className="text-[11px] text-slate-400">
            Authorized Personnel Access Only • All Actions Logged
          </span>
        </div>
      </footer>

      {/* Modals */}
      <CreateTaskModal
        isOpen={createTaskOpen}
        onClose={() => {
          setCreateTaskOpen(false);
          setDefaultTaskAssigneeId(undefined);
        }}
        onSuccess={() => setActiveTab('tasks')}
        defaultAssignedTo={defaultTaskAssigneeId}
      />

      <TaskDetailModal
        task={selectedTask}
        isOpen={Boolean(selectedTask)}
        onClose={() => setSelectedTask(null)}
        onOpenEditTask={(task) => setEditingTask(task)}
        onOpenReopenTask={(task) => setReopeningTask(task)}
      />

      <EditTaskModal
        task={editingTask}
        isOpen={Boolean(editingTask)}
        onClose={() => setEditingTask(null)}
      />

      <ReopenTaskModal
        task={reopeningTask}
        isOpen={Boolean(reopeningTask)}
        onClose={() => setReopeningTask(null)}
      />

      <CreateActivityModal
        isOpen={createActivityOpen}
        onClose={() => setCreateActivityOpen(false)}
        onSuccess={() => setActiveTab('activities')}
      />

      <CreateInitiativeModal
        isOpen={createInitiativeOpen}
        onClose={() => setCreateInitiativeOpen(false)}
        onSuccess={() => setActiveTab('initiatives')}
      />

      <InitiativeDetailModal
        initiative={selectedInitiative}
        isOpen={Boolean(selectedInitiative)}
        onClose={() => setSelectedInitiative(null)}
        onOpenEdit={(init: MemberInitiative) => setEditingInitiative(init)}
        onOpenSubmitAccomplishment={(init: MemberInitiative) => setAccomplishmentInitiative(init)}
      />

      <EditInitiativeModal
        initiative={editingInitiative}
        isOpen={Boolean(editingInitiative)}
        onClose={() => setEditingInitiative(null)}
        onSuccess={() => setActiveTab('initiatives')}
      />

      <SubmitAccomplishmentModal
        initiative={accomplishmentInitiative}
        isOpen={Boolean(accomplishmentInitiative)}
        onClose={() => setAccomplishmentInitiative(null)}
        onSuccess={() => setActiveTab('initiatives')}
      />

      {isManager && (
        <>
          <PersonnelPerformanceModal
            userId={performanceModalUserId}
            isOpen={Boolean(performanceModalUserId)}
            onClose={() => setPerformanceModalUserId(null)}
            onAssignTask={(uid) => {
              setPerformanceModalUserId(null);
              handleOpenCreateTaskForUser(uid);
            }}
            onEditAssignment={(uid) => {
              const target = allProfiles.find((p) => p.id === uid) || null;
              setPerformanceModalUserId(null);
              setEditingAssignmentUser(target);
            }}
            onSelectTask={(task) => {
              setPerformanceModalUserId(null);
              setSelectedTask(task);
            }}
            onSelectInitiative={(init) => {
              setPerformanceModalUserId(null);
              setSelectedInitiative(init);
            }}
            onOpenPrintIndividualReport={(uid, fromDate, toDate) => {
              setPerformanceModalUserId(null);
              handleOpenPrintIndividualReport(uid, fromDate, toDate);
            }}
          />

          <EditPersonnelAssignmentModal
            person={editingAssignmentUser}
            isOpen={Boolean(editingAssignmentUser)}
            onClose={() => setEditingAssignmentUser(null)}
          />
        </>
      )}

      <UserApprovalsModal
        isOpen={approvalsOpen}
        onClose={() => setApprovalsOpen(false)}
      />

      <UserProfileModal
        isOpen={profileOpen}
        onClose={() => setProfileOpen(false)}
      />
    </div>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <DataProvider>
        <MainAppContent />
      </DataProvider>
    </AuthProvider>
  );
}
