import React, { useState, useMemo, useEffect } from 'react';
import { useAuth } from '../context/AuthContext.tsx';
import { useData } from '../context/DataContext.tsx';
import {
  PersonnelPerformanceRecord,
  DateRangePreset,
  UserProfile,
  PerformanceTarget,
} from '../types/index.ts';
import {
  computePersonnelPerformance,
  computeUnitPerformanceSummaries,
  computeRegionalPerformanceSummaries,
  computeConsolidatedRegionRollups,
  getDateRangeForPreset,
} from '../lib/performanceUtils.ts';
import { OPERATIONAL_STATUS_CONFIG } from '../lib/orgDefaults.ts';
import { formatPhilippineDate, formatPhilippineDateTime } from '../lib/dateUtils.ts';
import {
  Users,
  Search,
  Building2,
  MapPin,
  GitBranch,
  Eye,
  Edit3,
  Plus,
  RefreshCw,
  ShieldCheck,
  AlertTriangle,
  Award,
  CheckCircle2,
  Database,
  Layers,
  ChevronRight,
  ChevronDown,
  Settings,
  UserCheck,
  Info,
  Sliders,
  Copy,
  Check,
} from 'lucide-react';

interface PersonnelDirectoryViewProps {
  onViewPerformance: (userId: string) => void;
  onEditAssignment: (user: UserProfile) => void;
  onOpenApprovals: () => void;
  initialSubTab?: 'directory' | 'team_performance' | 'hierarchy';
}

export const PersonnelDirectoryView: React.FC<PersonnelDirectoryViewProps> = ({
  onViewPerformance,
  onEditAssignment,
  onOpenApprovals,
  initialSubTab = 'directory',
}) => {
  const { isManager, allProfiles } = useAuth();
  const {
    allDepartmentTasks,
    taskUpdates,
    activities,
    allDepartmentInitiatives,
    initiativeHistory,
    organizationalUnits,
    positions,
    operatingRegions,
    assignmentsByUserId,
    performanceTargets,
    orgTablesReady,
    lastUpdatedAt,
    realtimeStatus,
    dataError,
    refreshData,
    createOrganizationalUnit,
    createOrganizationalPosition,
    createOperatingRegion,
    updatePerformanceTarget,
  } = useData();

  const [subTab, setSubTab] = useState<'directory' | 'team_performance' | 'hierarchy'>(
    initialSubTab
  );

  // Reporting Period Filter
  const [preset, setPreset] = useState<DateRangePreset>('month');
  const [customFrom, setCustomFrom] = useState<string>(() => getDateRangeForPreset('month').fromDate);
  const [customTo, setCustomTo] = useState<string>(() => getDateRangeForPreset('month').toDate);

  const { fromDate, toDate } = useMemo(() => {
    if (preset === 'custom') return { fromDate: customFrom, toDate: customTo };
    return getDateRangeForPreset(preset);
  }, [preset, customFrom, customTo]);

  // Directory Filters
  const [searchName, setSearchName] = useState('');
  const [unitFilter, setUnitFilter] = useState('all');
  const [regionFilter, setRegionFilter] = useState('all');
  const [positionFilter, setPositionFilter] = useState('all');
  const [supervisorFilter, setSupervisorFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'inactive' | 'pending'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Team Performance drill-down state
  const [selectedUnitDrill, setSelectedUnitDrill] = useState<string | null>(null);
  const [selectedRegionDrill, setSelectedRegionDrill] = useState<string | null>(null);

  // Config modals/forms in Hierarchy tab
  const [newUnitCode, setNewUnitCode] = useState('');
  const [newUnitName, setNewUnitName] = useState('');
  const [newUnitDesc, setNewUnitDesc] = useState('');
  const [newPosTitle, setNewPosTitle] = useState('');
  const [newPosUnitId, setNewPosUnitId] = useState('unit-rso');
  const [newPosSupervisory, setNewPosSupervisory] = useState(false);
  const [newRegCode, setNewRegCode] = useState('');
  const [newRegName, setNewRegName] = useState('');
  const [newRegIsland, setNewRegIsland] = useState('Luzon');
  const [selectedTargetId, setSelectedTargetId] = useState<string>(() => performanceTargets[0]?.id || 'tgt-rso');
  const [targetDraft, setTargetDraft] = useState<PerformanceTarget | null>(() => performanceTargets[0] || null);
  const [savingTarget, setSavingTarget] = useState(false);
  const [configMsg, setConfigMsg] = useState<string | null>(null);
  const [configErr, setConfigErr] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const match = performanceTargets.find((t) => t.id === selectedTargetId) || performanceTargets[0] || null;
    if (match) {
      setTargetDraft({ ...match });
    }
  }, [performanceTargets, selectedTargetId]);

  const profilesById = useMemo(() => {
    const map: Record<string, UserProfile> = {};
    for (const p of allProfiles) map[p.id] = p;
    return map;
  }, [allProfiles]);

  // Compute live performance for every registered Supabase profile
  const allPersonnelRecords: PersonnelPerformanceRecord[] = useMemo(() => {
    return allProfiles.map((user) =>
      computePersonnelPerformance({
        user,
        assignment: assignmentsByUserId[user.id] || null,
        units: organizationalUnits,
        positions,
        regions: operatingRegions,
        profilesById,
        assignmentsById: assignmentsByUserId,
        tasks: allDepartmentTasks,
        taskUpdates,
        activities,
        initiatives: allDepartmentInitiatives,
        initiativeHistory,
        performanceTargets,
        fromDate,
        toDate,
      })
    );
  }, [
    allProfiles,
    assignmentsByUserId,
    organizationalUnits,
    positions,
    operatingRegions,
    profilesById,
    allDepartmentTasks,
    taskUpdates,
    activities,
    allDepartmentInitiatives,
    initiativeHistory,
    performanceTargets,
    fromDate,
    toDate,
  ]);

  // Filtered directory rows
  const filteredPersonnel = useMemo(() => {
    return allPersonnelRecords.filter((rec) => {
      if (searchName.trim()) {
        const q = searchName.toLowerCase();
        const match =
          rec.user.display_name.toLowerCase().includes(q) ||
          rec.user.email.toLowerCase().includes(q) ||
          rec.user.id.toLowerCase().includes(q) ||
          (rec.position?.title || '').toLowerCase().includes(q) ||
          (rec.assignment?.assigned_site || '').toLowerCase().includes(q);
        if (!match) return false;
      }

      if (unitFilter !== 'all' && rec.unit?.id !== unitFilter) return false;
      if (regionFilter !== 'all' && rec.region?.id !== regionFilter) return false;
      if (positionFilter !== 'all' && rec.position?.id !== positionFilter) return false;
      if (supervisorFilter !== 'all' && rec.supervisor?.id !== supervisorFilter) return false;

      if (statusFilter === 'active' && (!rec.user.approved || !rec.user.active)) return false;
      if (statusFilter === 'inactive' && rec.user.active) return false;
      if (statusFilter === 'pending' && rec.user.approved) return false;

      return true;
    });
  }, [
    allPersonnelRecords,
    searchName,
    unitFilter,
    regionFilter,
    positionFilter,
    supervisorFilter,
    statusFilter,
  ]);

  // Unit & Regional summaries
  const unitSummaries = useMemo(
    () =>
      computeUnitPerformanceSummaries({
        units: organizationalUnits,
        personnelRecords: allPersonnelRecords,
      }),
    [organizationalUnits, allPersonnelRecords]
  );

  const regionalSummaries = useMemo(
    () =>
      computeRegionalPerformanceSummaries({
        regions: operatingRegions,
        personnelRecords: allPersonnelRecords,
        tasks: allDepartmentTasks,
        taskUpdates,
        activities,
        initiatives: allDepartmentInitiatives,
        fromDate,
        toDate,
      }),
    [
      operatingRegions,
      allPersonnelRecords,
      allDepartmentTasks,
      taskUpdates,
      activities,
      allDepartmentInitiatives,
      fromDate,
      toDate,
    ]
  );

  const consolidatedRollups = useMemo(
    () => computeConsolidatedRegionRollups(regionalSummaries),
    [regionalSummaries]
  );

  // Unique supervisors currently assigned in directory for filter dropdown
  const supervisorOptions = useMemo(() => {
    const map: Record<string, { id: string; name: string }> = {};
    for (const r of allPersonnelRecords) {
      if (r.supervisor) {
        map[r.supervisor.id] = { id: r.supervisor.id, name: r.supervisor.name };
      }
    }
    return Object.values(map).sort((a, b) => a.name.localeCompare(b.name));
  }, [allPersonnelRecords]);

  if (!isManager) {
    return (
      <div className="bg-white p-10 rounded-xl border border-rose-200 text-center space-y-2">
        <AlertTriangle className="w-8 h-8 text-rose-600 mx-auto" />
        <h2 className="font-bold text-slate-900">Manager Authorization Required</h2>
        <p className="text-xs text-slate-500">
          The Personnel Directory and Team Performance modules are restricted to approved Security Managers.
        </p>
      </div>
    );
  }

  const handleManualRefresh = async () => {
    setRefreshing(true);
    try {
      await refreshData({ silent: true });
    } finally {
      setRefreshing(false);
    }
  };

  const handleAddUnit = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigMsg(null);
    setConfigErr(null);
    try {
      await createOrganizationalUnit({
        code: newUnitCode,
        name: newUnitName,
        description: newUnitDesc,
      });
      setNewUnitCode('');
      setNewUnitName('');
      setNewUnitDesc('');
      setConfigMsg('New organizational unit added to Supabase.');
    } catch (err: any) {
      setConfigErr(err.message);
    }
  };

  const handleAddPosition = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigMsg(null);
    setConfigErr(null);
    try {
      await createOrganizationalPosition({
        title: newPosTitle,
        unit_id: newPosUnitId || null,
        hierarchy_level: newPosSupervisory ? 3 : 4,
        is_supervisory: newPosSupervisory,
      });
      setNewPosTitle('');
      setConfigMsg('New position / designation added to Supabase.');
    } catch (err: any) {
      setConfigErr(err.message);
    }
  };

  const handleAddRegion = async (e: React.FormEvent) => {
    e.preventDefault();
    setConfigMsg(null);
    setConfigErr(null);
    try {
      await createOperatingRegion({
        code: newRegCode,
        name: newRegName,
        island_group: newRegIsland,
      });
      setNewRegCode('');
      setNewRegName('');
      setConfigMsg('New operating region added to Supabase.');
    } catch (err: any) {
      setConfigErr(err.message);
    }
  };

  const handleSelectTargetForEdit = (id: string) => {
    setSelectedTargetId(id);
    const found = performanceTargets.find((t) => t.id === id) || null;
    setTargetDraft(found ? { ...found } : null);
    setConfigMsg(null);
    setConfigErr(null);
  };

  const getTargetLabel = (t: PerformanceTarget | null | undefined): string => {
    if (!t) return 'Standard Target';
    const posTitle = t.position_id ? positions.find((p) => p.id === t.position_id)?.title : null;
    if (posTitle) return posTitle;
    const unitName = t.unit_id ? organizationalUnits.find((u) => u.id === t.unit_id)?.name : null;
    if (unitName) return `${unitName} (Unit Default)`;
    return t.notes?.split(':')[0] || t.id;
  };

  const handleSavePerformanceTarget = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!targetDraft) return;
    setConfigMsg(null);
    setConfigErr(null);
    setSavingTarget(true);
    try {
      await updatePerformanceTarget(targetDraft);
      setConfigMsg(`Saved KPI targets & position weights for "${getTargetLabel(targetDraft)}".`);
    } catch (err: any) {
      setConfigErr(err.message || 'Failed to update KPI target.');
    } finally {
      setSavingTarget(false);
    }
  };

  const handleCopyUserId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  // Build recursive org chart nodes for approved profiles
  const approvedProfiles = allPersonnelRecords.filter((r) => r.user.approved && r.user.active);
  const topLevelNodes = approvedProfiles.filter(
    (r) => !r.assignment?.reports_to_user_id || !profilesById[r.assignment.reports_to_user_id]
  );

  const renderHierarchyNode = (node: PersonnelPerformanceRecord, depth = 0) => {
    const directReports = approvedProfiles.filter(
      (r) => r.assignment?.reports_to_user_id === node.user.id
    );
    return (
      <div key={node.user.id} className={`${depth > 0 ? 'ml-6 pl-4 border-l-2 border-slate-200' : ''} mt-2.5`}>
        <div className="p-3 bg-white border border-slate-200 rounded-xl shadow-xs flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 hover:border-blue-300 transition">
          <div className="flex items-center space-x-3">
            <div className="w-8 h-8 rounded-full bg-slate-800 text-white font-bold text-xs flex items-center justify-center flex-shrink-0">
              {node.user.display_name.charAt(0).toUpperCase()}
            </div>
            <div>
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onViewPerformance(node.user.id)}
                  className="font-bold text-slate-900 hover:text-blue-700 hover:underline text-xs cursor-pointer"
                >
                  {node.user.display_name}
                </button>
                <span className="text-[10px] px-2 py-0.2 rounded-full bg-blue-50 text-blue-800 border border-blue-200 font-semibold">
                  {node.position?.title || (node.user.role === 'manager' ? 'Security Manager' : 'Security Personnel')}
                </span>
                {node.user.role === 'manager' && (
                  <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-white font-semibold">
                    App Admin
                  </span>
                )}
              </div>
              <div className="text-[11px] text-slate-500">
                {node.unit?.name || 'Unassigned Unit'} • {node.region?.name || node.user.regional_assignment || 'No Region'} •{' '}
                <span className="font-mono">{node.user.email}</span>
              </div>
            </div>
          </div>

          <div className="flex items-center space-x-2 text-[11px]">
            <span className="text-slate-500">
              Active: <strong className="text-slate-800">{node.activeTasksCount}</strong> • Overdue:{' '}
              <strong className={node.overdueTasksCount > 0 ? 'text-rose-700' : 'text-slate-800'}>
                {node.overdueTasksCount}
              </strong>
            </span>
            <button
              type="button"
              onClick={() => onEditAssignment(node.user)}
              className="px-2 py-1 border border-slate-300 rounded text-slate-700 hover:bg-slate-50 font-medium cursor-pointer"
            >
              Edit Line
            </button>
          </div>
        </div>
        {directReports.map((child) => renderHierarchyNode(child, depth + 1))}
      </div>
    );
  };

  const pendingApprovalsCount = allProfiles.filter((p) => !p.approved).length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-slate-900 tracking-tight">
            Personnel Directory & Performance Command
          </h1>
          <p className="text-xs sm:text-sm text-slate-500">
            Nationwide organizational structure, reporting hierarchy, workload balance, and verified performance metrics
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2 text-xs">
          <div className="px-3 py-1.5 bg-white border border-slate-200 rounded-lg flex items-center space-x-2 text-slate-600">
            <span
              className={`w-2 h-2 rounded-full ${
                realtimeStatus === 'live' ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
              }`}
            />
            <span>
              Updated: <strong>{formatPhilippineDateTime(lastUpdatedAt)}</strong>
            </span>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            disabled={refreshing}
            className="inline-flex items-center px-3 py-1.5 bg-white border border-slate-300 hover:bg-slate-50 rounded-lg font-semibold text-slate-700 transition space-x-1.5 cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${refreshing ? 'animate-spin' : ''}`} />
            <span>Refresh</span>
          </button>
          {pendingApprovalsCount > 0 && (
            <button
              type="button"
              onClick={onOpenApprovals}
              className="inline-flex items-center px-3 py-1.5 bg-amber-500 hover:bg-amber-600 text-slate-950 font-bold rounded-lg transition space-x-1.5 cursor-pointer"
            >
              <UserCheck className="w-3.5 h-3.5" />
              <span>Pending Approvals ({pendingApprovalsCount})</span>
            </button>
          )}
        </div>
      </div>

      {/* Data Sync Error Banner */}
      {dataError && (
        <div className="p-4 bg-rose-50 border border-rose-300 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-900">
          <div className="flex items-start space-x-2.5">
            <AlertTriangle className="w-4 h-4 text-rose-700 flex-shrink-0 mt-0.5" />
            <div>
              <span className="font-bold">Supabase Sync Notice:</span> {dataError}
            </div>
          </div>
          <button
            type="button"
            onClick={handleManualRefresh}
            className="px-3 py-1 bg-rose-700 hover:bg-rose-800 text-white font-semibold rounded-lg cursor-pointer"
          >
            Retry Sync
          </button>
        </div>
      )}

      {/* Migration Notice if org tables are not yet applied in Supabase */}
      {!orgTablesReady && (
        <div className="p-4 bg-amber-50 border border-amber-300 rounded-xl flex items-start space-x-3 text-xs text-amber-900">
          <Database className="w-5 h-5 text-amber-700 flex-shrink-0 mt-0.5" />
          <div>
            <h3 className="font-bold text-sm">Organizational & Hierarchy Migration Pending</h3>
            <p className="mt-0.5 leading-relaxed">
              Your registered Supabase profiles and live task/activity data are loaded cleanly below. To persist custom units, positions, supervisors, regional subdivisions, and position KPI weights in Supabase, execute{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-semibold">
                supabase/migration_personnel_hierarchy.sql
              </code>{' '}
              and{' '}
              <code className="bg-amber-100 px-1.5 py-0.5 rounded font-mono font-semibold">
                supabase/migration_phase1_2_reconciliation.sql
              </code>{' '}
              in your Supabase SQL Editor.
            </p>
          </div>
        </div>
      )}

      {/* Sub-Navigation & Period Filter Bar */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <button
            type="button"
            onClick={() => setSubTab('directory')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
              subTab === 'directory'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Users className="w-3.5 h-3.5" />
            <span>Personnel Directory ({allProfiles.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('team_performance')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
              subTab === 'team_performance'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <Layers className="w-3.5 h-3.5" />
            <span>Team & Regional Performance</span>
          </button>

          <button
            type="button"
            onClick={() => setSubTab('hierarchy')}
            className={`px-3.5 py-2 rounded-lg font-semibold flex items-center space-x-1.5 transition cursor-pointer ${
              subTab === 'hierarchy'
                ? 'bg-slate-900 text-white'
                : 'text-slate-600 hover:bg-slate-100'
            }`}
          >
            <GitBranch className="w-3.5 h-3.5" />
            <span>Org Chart & Configuration</span>
          </button>
        </div>

        {/* Reporting Period Controls */}
        <div className="flex flex-wrap items-center gap-1.5 text-xs">
          <span className="text-slate-500 font-medium mr-1">Reporting Period:</span>
          {(['today', 'week', 'month', 'quarter', 'custom'] as DateRangePreset[]).map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setPreset(p)}
              className={`px-2.5 py-1 rounded-md font-semibold capitalize transition cursor-pointer ${
                preset === p
                  ? 'bg-blue-700 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {p === 'week' ? 'This Week' : p === 'month' ? 'This Month' : p === 'quarter' ? 'This Quarter' : p}
            </button>
          ))}
          {preset === 'custom' && (
            <div className="flex items-center space-x-1 ml-1">
              <input
                type="date"
                value={customFrom}
                onChange={(e) => setCustomFrom(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-xs"
              />
              <span>to</span>
              <input
                type="date"
                value={customTo}
                onChange={(e) => setCustomTo(e.target.value)}
                className="px-2 py-1 border border-slate-300 rounded text-xs"
              />
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
          SUB-TAB 1: PERSONNEL DIRECTORY
         ===================================================================== */}
      {subTab === 'directory' && (
        <div className="space-y-4">
          {/* Filters */}
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-3 text-xs">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-6 gap-2.5">
              <div className="relative lg:col-span-2">
                <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
                <input
                  type="text"
                  placeholder="Search by name, email, position, or site..."
                  value={searchName}
                  onChange={(e) => setSearchName(e.target.value)}
                  className="w-full pl-8 pr-3 py-2 border border-slate-300 rounded-lg text-slate-900"
                />
              </div>

              <select
                value={unitFilter}
                onChange={(e) => setUnitFilter(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="all">All Units</option>
                {organizationalUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>

              <select
                value={regionFilter}
                onChange={(e) => setRegionFilter(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="all">All Regions</option>
                {operatingRegions.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>

              <select
                value={positionFilter}
                onChange={(e) => setPositionFilter(e.target.value)}
                className="px-2.5 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
              >
                <option value="all">All Positions</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>

              <div className="flex space-x-2">
                <select
                  value={supervisorFilter}
                  onChange={(e) => setSupervisorFilter(e.target.value)}
                  className="w-1/2 px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="all">All Supervisors</option>
                  {supervisorOptions.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
                <select
                  value={statusFilter}
                  onChange={(e) => setStatusFilter(e.target.value as any)}
                  className="w-1/2 px-2 py-2 border border-slate-300 rounded-lg bg-white text-slate-900"
                >
                  <option value="all">All Status</option>
                  <option value="active">Active Approved</option>
                  <option value="pending">Pending Approval</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="flex items-center justify-between text-[11px] text-slate-500 pt-1 border-t border-slate-100">
              <span>
                Showing <strong>{filteredPersonnel.length}</strong> of{' '}
                <strong>{allPersonnelRecords.length}</strong> registered Supabase personnel account(s)
              </span>
              {(searchName ||
                unitFilter !== 'all' ||
                regionFilter !== 'all' ||
                positionFilter !== 'all' ||
                supervisorFilter !== 'all' ||
                statusFilter !== 'all') && (
                <button
                  type="button"
                  onClick={() => {
                    setSearchName('');
                    setUnitFilter('all');
                    setRegionFilter('all');
                    setPositionFilter('all');
                    setSupervisorFilter('all');
                    setStatusFilter('all');
                  }}
                  className="text-blue-700 hover:underline font-semibold cursor-pointer"
                >
                  Reset Filters
                </button>
              )}
            </div>
          </div>

          {/* Directory Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Personnel, UUID & Account</th>
                    <th className="px-4 py-3">Position & Unit</th>
                    <th className="px-4 py-3">Region / Assigned Site</th>
                    <th className="px-4 py-3">Immediate Supervisor</th>
                    <th className="px-4 py-3 text-center">Open Tasks</th>
                    <th className="px-4 py-3 text-center" title="All uncompleted overdue tasks (Philippine Time)">Curr. Overdue</th>
                    <th className="px-4 py-3 text-center">Completed</th>
                    <th className="px-4 py-3 text-center" title="Position-weighted non-appraisal Operational Index">Op. Index</th>
                    <th className="px-4 py-3 text-center">Recognized</th>
                    <th className="px-4 py-3">Last Activity</th>
                    <th className="px-4 py-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {filteredPersonnel.length === 0 ? (
                    <tr>
                      <td colSpan={11} className="p-8 text-center text-slate-400">
                        No registered personnel match your filter criteria.
                      </td>
                    </tr>
                  ) : (
                    filteredPersonnel.map((rec) => {
                      const opStatus =
                        rec.assignment?.operational_status ||
                        (rec.user.active ? 'active' : 'inactive');
                      const opBadge =
                        OPERATIONAL_STATUS_CONFIG[opStatus] || OPERATIONAL_STATUS_CONFIG.active;

                      return (
                        <tr key={rec.user.id} className="hover:bg-slate-50/80 transition">
                          {/* Name, UUID, Email, App Role, Approval & Operational Status */}
                          <td className="px-4 py-3">
                            <button
                              type="button"
                              onClick={() => onViewPerformance(rec.user.id)}
                              className="font-bold text-slate-900 hover:text-blue-700 hover:underline text-left cursor-pointer"
                            >
                              {rec.user.display_name}
                            </button>
                            <div className="text-[11px] font-mono text-slate-500">
                              {rec.user.email}
                            </div>
                            <div className="flex items-center gap-1 mt-0.5 text-[10px] font-mono text-slate-400">
                              <span title={rec.user.id}>UUID: {rec.user.id.slice(0, 8)}...{rec.user.id.slice(-4)}</span>
                              <button
                                type="button"
                                onClick={() => handleCopyUserId(rec.user.id)}
                                className="text-slate-400 hover:text-blue-600 cursor-pointer"
                                title="Copy full Supabase User UUID"
                              >
                                {copiedId === rec.user.id ? (
                                  <Check className="w-3 h-3 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3 h-3" />
                                )}
                              </button>
                            </div>
                            <div className="flex flex-wrap items-center gap-1 mt-1">
                              <span
                                className={`text-[10px] font-bold px-1.5 py-0.2 rounded border ${
                                  rec.user.role === 'manager'
                                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                                    : 'bg-slate-100 text-slate-700 border-slate-300'
                                }`}
                              >
                                {rec.user.role === 'manager' ? 'Manager' : 'Member'}
                              </span>
                              {!rec.user.approved ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-amber-100 text-amber-800 border border-amber-300">
                                  Pending Approval
                                </span>
                              ) : !rec.user.active ? (
                                <span className="text-[10px] font-bold px-1.5 py-0.2 rounded bg-rose-100 text-rose-800 border border-rose-300">
                                  Deactivated
                                </span>
                              ) : (
                                <>
                                  <span className="text-[10px] font-semibold px-1.5 py-0.2 rounded bg-emerald-50 text-emerald-800 border border-emerald-200">
                                    Approved
                                  </span>
                                  <span
                                    className={`text-[10px] font-semibold px-1.5 py-0.2 rounded border ${opBadge.badgeClass}`}
                                  >
                                    {opBadge.label}
                                  </span>
                                </>
                              )}
                            </div>
                          </td>

                          {/* Position & Unit */}
                          <td className="px-4 py-3">
                            <div className="font-semibold text-slate-800">
                              {rec.position?.title || (rec.user.role === 'manager' ? 'Security Manager' : 'Unassigned Position')}
                            </div>
                            <div className="text-[11px] text-slate-500">
                              {rec.unit?.name || 'Unassigned Unit'}
                            </div>
                          </td>

                          {/* Region & Assigned Site */}
                          <td className="px-4 py-3">
                            <div className="font-medium text-slate-800">
                              {rec.region?.name || rec.user.regional_assignment || 'Not Assigned'}
                            </div>
                            {rec.assignment?.assigned_site && (
                              <div className="text-[11px] text-slate-500">
                                Site: {rec.assignment.assigned_site}
                              </div>
                            )}
                          </td>

                          {/* Immediate Supervisor */}
                          <td className="px-4 py-3">
                            {rec.supervisor ? (
                              <div>
                                <div className="font-medium text-slate-800">{rec.supervisor.name}</div>
                                <div className="text-[10px] text-slate-400">
                                  {rec.supervisor.positionTitle}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">Top Level / Unassigned</span>
                            )}
                          </td>

                          {/* Open Tasks (all non-completed) */}
                          <td className="px-4 py-3 text-center font-bold text-slate-800">
                            {rec.allOpenTasksCount}
                            {rec.activeTasksCount !== rec.allOpenTasksCount && (
                              <span className="block text-[9px] font-normal text-slate-400">
                                {rec.activeTasksCount} in period
                              </span>
                            )}
                          </td>

                          {/* Currently Overdue */}
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full ${
                                rec.overdueTasksCount > 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'text-slate-500'
                              }`}
                            >
                              {rec.overdueTasksCount}
                            </span>
                          </td>

                          {/* Completed */}
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-emerald-700">
                              {rec.completedTasksCount}
                            </span>
                            <span className="block text-[9px] text-slate-400 font-mono">
                              {rec.completionRate.display}
                            </span>
                          </td>

                          {/* Operational Index (Non-Appraisal) */}
                          <td className="px-4 py-3 text-center" title={rec.operationalIndex.formulaDescription}>
                            <span className="font-mono font-bold text-blue-900">
                              {rec.operationalIndex.display}
                            </span>
                            <span className="block text-[9px] text-slate-400">
                              SLA: {rec.onTimeRate.display === 'N/A' ? 'N/A' : `${rec.onTimeRate.percentage}%`}
                            </span>
                          </td>

                          {/* Recognized Initiatives */}
                          <td className="px-4 py-3 text-center">
                            <span className="font-bold text-amber-700">
                              {rec.recognizedInitiativesCount}
                            </span>
                          </td>

                          {/* Last Recorded Activity */}
                          <td className="px-4 py-3">
                            {rec.lastRecordedActivityDate ? (
                              <div>
                                <div className="font-medium text-slate-800">
                                  {formatPhilippineDate(rec.lastRecordedActivityDate)}
                                </div>
                                <div
                                  className="text-[10px] text-slate-500 truncate max-w-[120px]"
                                  title={rec.lastRecordedActivityTitle || ''}
                                >
                                  {rec.lastRecordedActivityTitle}
                                </div>
                              </div>
                            ) : (
                              <span className="text-slate-400 italic">N/A</span>
                            )}
                          </td>

                          {/* Actions */}
                          <td className="px-4 py-3 text-right whitespace-nowrap space-x-1.5">
                            <button
                              type="button"
                              onClick={() => onEditAssignment(rec.user)}
                              className="inline-flex items-center px-2 py-1 border border-slate-300 rounded-md text-slate-700 hover:bg-slate-100 font-medium cursor-pointer"
                              title="Edit organizational unit, position, supervisor, or site"
                            >
                              <Edit3 className="w-3 h-3 mr-1" />
                              <span>Org</span>
                            </button>
                            <button
                              type="button"
                              onClick={() => onViewPerformance(rec.user.id)}
                              className="inline-flex items-center px-2.5 py-1 bg-blue-50 text-blue-700 border border-blue-200 rounded-md hover:bg-blue-100 font-semibold cursor-pointer"
                            >
                              <Eye className="w-3 h-3 mr-1" />
                              <span>View Performance</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 2: TEAM & REGIONAL PERFORMANCE
         ===================================================================== */}
      {subTab === 'team_performance' && (
        <div className="space-y-6">
          {/* Functional Units Performance Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Security Functional Units Performance
                </h2>
                <p className="text-xs text-slate-500">
                  Click any functional unit row to drill down into assigned personnel and individual metrics
                </p>
              </div>
              <span className="text-[11px] text-slate-500">
                Period: {formatPhilippineDate(fromDate)} – {formatPhilippineDate(toDate)}
              </span>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Department Unit</th>
                    <th className="px-4 py-3 text-center">Active Users</th>
                    <th className="px-4 py-3 text-center">Open Tasks</th>
                    <th className="px-4 py-3 text-center">Completed</th>
                    <th className="px-4 py-3 text-center" title="All uncompleted overdue tasks across unit">Curr. Overdue</th>
                    <th className="px-4 py-3 text-center">Pending Reviews</th>
                    <th className="px-4 py-3 text-center">Returned</th>
                    <th className="px-4 py-3 text-center">Recognized Init.</th>
                    <th className="px-4 py-3 text-right">On-Time Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {unitSummaries.map((u) => {
                    const isExpanded = selectedUnitDrill === u.unit.id;
                    const unitMembers = allPersonnelRecords.filter((p) =>
                      u.memberIds.includes(p.user.id)
                    );

                    return (
                      <React.Fragment key={u.unit.id}>
                        <tr
                          onClick={() =>
                            setSelectedUnitDrill(isExpanded ? null : u.unit.id)
                          }
                          className="hover:bg-blue-50/50 cursor-pointer transition"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{u.unit.name}</div>
                                <div className="text-[10px] text-slate-500">{u.unit.code}</div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-800">
                            {u.activeUsersCount}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-700">
                            {u.allOpenTasksCount}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-700">
                            {u.completedTasksCount}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full ${
                                u.overdueTasksCount > 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'text-slate-500'
                              }`}
                            >
                              {u.overdueTasksCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-800">
                            {u.pendingReviewsCount}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {u.returnedSubmissionsCount}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-indigo-700">
                            {u.recognizedInitiativesCount}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {u.onTimeRate.display}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-slate-50 px-6 py-4 border-t border-b border-slate-200">
                              <div className="text-[11px] font-bold text-slate-700 uppercase mb-2">
                                Personnel Assigned to {u.unit.name} ({unitMembers.length})
                              </div>
                              {unitMembers.length === 0 ? (
                                <p className="text-slate-400 italic">
                                  No registered users currently assigned to this unit. Use the Personnel Directory to assign users.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {unitMembers.map((m) => (
                                    <div
                                      key={m.user.id}
                                      onClick={() => onViewPerformance(m.user.id)}
                                      className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
                                    >
                                      <div>
                                        <div className="font-bold text-slate-900">
                                          {m.user.display_name}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          {m.position?.title || 'Personnel'} • {m.region?.name || 'Site'}
                                        </div>
                                      </div>
                                      <div className="text-right text-[11px]">
                                        <div className="font-semibold text-slate-800">
                                          Active: {m.activeTasksCount} • Done: {m.completedTasksCount}
                                        </div>
                                        <div className="text-blue-700 font-semibold">
                                          Open Profile →
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          {/* Philippine Regional Performance Table */}
          <div className="bg-white rounded-xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="px-5 py-4 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
              <div>
                <h2 className="font-bold text-sm text-slate-900">
                  Philippine Regional Security Performance
                </h2>
                <p className="text-xs text-slate-500">
                  Preserves historical regional attribution: tasks, activities, and initiatives remain credited to the region recorded at creation even if personnel transfer later
                </p>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50 text-slate-600 uppercase font-semibold border-b border-slate-200 text-[11px]">
                  <tr>
                    <th className="px-4 py-3">Operating Region & Supervisors</th>
                    <th className="px-4 py-3 text-center">Current Staff</th>
                    <th className="px-4 py-3 text-center">Open Tasks</th>
                    <th className="px-4 py-3 text-center">Completed</th>
                    <th className="px-4 py-3 text-center">Curr. Overdue</th>
                    <th className="px-4 py-3 text-center">Pending Review</th>
                    <th className="px-4 py-3 text-center">Shift Logs</th>
                    <th className="px-4 py-3 text-center">Recognized Init.</th>
                    <th className="px-4 py-3 text-right">On-Time Rate</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {regionalSummaries.map((r) => {
                    const isExpanded = selectedRegionDrill === r.region.id;
                    const regMembers = allPersonnelRecords.filter(
                      (p) => p.region?.id === r.region.id
                    );

                    return (
                      <React.Fragment key={r.region.id}>
                        <tr
                          onClick={() =>
                            setSelectedRegionDrill(isExpanded ? null : r.region.id)
                          }
                          className="hover:bg-blue-50/50 cursor-pointer transition"
                        >
                          <td className="px-4 py-3">
                            <div className="flex items-center space-x-2">
                              {isExpanded ? (
                                <ChevronDown className="w-4 h-4 text-blue-600" />
                              ) : (
                                <ChevronRight className="w-4 h-4 text-slate-400" />
                              )}
                              <div>
                                <div className="font-bold text-slate-900">{r.region.name}</div>
                                <div className="text-[10px] text-slate-500">
                                  {r.region.island_group} ({r.region.code})
                                  {r.assignedSupervisors.length > 0 && (
                                    <span className="ml-1.5 text-blue-700 font-medium">
                                      • Sup: {r.assignedSupervisors.map((s) => s.name).join(', ')}
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-slate-800">
                            {r.assignedPersonnelCount}
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-blue-700">
                            {r.allOpenTasksCount}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-emerald-700">
                            {r.completedTasksCount}
                          </td>
                          <td className="px-4 py-3 text-center">
                            <span
                              className={`font-bold px-2 py-0.5 rounded-full ${
                                r.overdueTasksCount > 0
                                  ? 'bg-rose-100 text-rose-800'
                                  : 'text-slate-500'
                              }`}
                            >
                              {r.overdueTasksCount}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-center font-semibold text-amber-800">
                            {r.pendingReviewsCount}
                          </td>
                          <td className="px-4 py-3 text-center text-slate-700">
                            {r.activitiesCount}
                          </td>
                          <td className="px-4 py-3 text-center font-bold text-indigo-700">
                            {r.recognizedInitiativesCount}
                          </td>
                          <td className="px-4 py-3 text-right font-semibold text-slate-900">
                            {r.onTimeRate.display}
                          </td>
                        </tr>

                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="bg-slate-50 px-6 py-4 border-t border-b border-slate-200">
                              <div className="text-[11px] font-bold text-slate-700 uppercase mb-2">
                                Currently Assigned Personnel in {r.region.name} ({regMembers.length})
                              </div>
                              {regMembers.length === 0 ? (
                                <p className="text-slate-400 italic">
                                  No personnel currently assigned to {r.region.name}.
                                </p>
                              ) : (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
                                  {regMembers.map((m) => (
                                    <div
                                      key={m.user.id}
                                      onClick={() => onViewPerformance(m.user.id)}
                                      className="p-3 bg-white border border-slate-200 rounded-lg hover:border-blue-400 cursor-pointer flex items-center justify-between"
                                    >
                                      <div>
                                        <div className="font-bold text-slate-900">
                                          {m.user.display_name}
                                        </div>
                                        <div className="text-[10px] text-slate-500">
                                          {m.position?.title || 'Security Officer'} •{' '}
                                          {m.assignment?.assigned_site || r.region.name}
                                        </div>
                                      </div>
                                      <span className="text-blue-700 font-semibold text-[11px]">
                                        View Performance →
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}

                  {/* Consolidated Island Group Rollups (Visayas R6+R7 & Mindanao R10+R11) */}
                  {[consolidatedRollups.consolidatedVisayas, consolidatedRollups.consolidatedMindanao].map((cg) => (
                    <tr key={cg.region.id} className="bg-blue-50/60 border-t-2 border-blue-200 font-semibold">
                      <td className="px-4 py-3">
                        <div className="font-bold text-blue-950">{cg.region.name}</div>
                        <div className="text-[10px] text-blue-700">
                          Consolidated Rollup ({cg.region.code}) • Combined Numerators & Denominators
                        </div>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-950">
                        {cg.assignedPersonnelCount}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-blue-800">
                        {cg.allOpenTasksCount}
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-emerald-800">
                        {cg.completedTasksCount}
                      </td>
                      <td className="px-4 py-3 text-center">
                        <span
                          className={`font-bold px-2 py-0.5 rounded-full ${
                            cg.overdueTasksCount > 0
                              ? 'bg-rose-100 text-rose-800'
                              : 'text-slate-500'
                          }`}
                        >
                          {cg.overdueTasksCount}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-center font-bold text-amber-900">
                        {cg.pendingReviewsCount}
                      </td>
                      <td className="px-4 py-3 text-center text-blue-950">{cg.activitiesCount}</td>
                      <td className="px-4 py-3 text-center font-bold text-indigo-800">
                        {cg.recognizedInitiativesCount}
                      </td>
                      <td className="px-4 py-3 text-right font-bold text-blue-950 font-mono">
                        {cg.onTimeRate.display}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* =====================================================================
          SUB-TAB 3: ORG HIERARCHY TREE & CONFIGURATION
         ===================================================================== */}
      {subTab === 'hierarchy' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left 2 Cols: Reporting Hierarchy Chart */}
          <div className="lg:col-span-2 space-y-4">
            <div className="bg-white p-5 rounded-xl border border-slate-200 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                <div>
                  <h2 className="font-bold text-sm text-slate-900 flex items-center space-x-2">
                    <GitBranch className="w-4 h-4 text-blue-700" />
                    <span>Security Department Reporting Hierarchy</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    Executive Oversight (VP & Head of Security) → Security Manager → Regional / Command Supervisors → Field & Support Personnel
                  </p>
                </div>
              </div>

              {/* Executive Oversight Header */}
              <div className="p-3 bg-slate-900 text-white rounded-xl text-xs flex items-center justify-between">
                <div>
                  <div className="text-[10px] uppercase tracking-wider text-blue-300 font-bold">
                    Executive Oversight Layer
                  </div>
                  <div className="font-bold text-sm">VP & Head of Security → Security Manager (Security Department)</div>
                </div>
                <ShieldCheck className="w-5 h-5 text-blue-400" />
              </div>

              {topLevelNodes.length === 0 ? (
                <p className="text-xs text-slate-400 italic py-4">
                  No approved personnel accounts available yet.
                </p>
              ) : (
                <div className="space-y-2">{topLevelNodes.map((n) => renderHierarchyNode(n, 0))}</div>
              )}

              {/* Agency Guard Separation Notice */}
              <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-xl flex items-start space-x-2.5 text-xs text-slate-600">
                <Info className="w-4 h-4 text-blue-600 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="text-slate-800">Agency-Deployed Guard Oversight Policy:</strong>{' '}
                  External security agency guards deployed across facilities are supervised operationally by Regional Security Supervisors and Site Leads, and are intentionally excluded from individual SOH user registrations unless explicitly onboarded and approved by the Security Manager.
                </div>
              </div>
            </div>
          </div>

          {/* Right Col: Configurable Units, Positions & Regions */}
          <div className="space-y-4 text-xs">
            {configMsg && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 text-emerald-800 rounded-lg flex items-center space-x-2">
                <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                <span>{configMsg}</span>
              </div>
            )}
            {configErr && (
              <div className="p-3 bg-rose-50 border border-rose-200 text-rose-800 rounded-lg flex items-center space-x-2">
                <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                <span>{configErr}</span>
              </div>
            )}

            {/* Add Unit */}
            <form
              onSubmit={handleAddUnit}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5"
            >
              <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Settings className="w-4 h-4 text-blue-600" />
                <span>Add Organizational Unit</span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Code (e.g. K9)"
                  value={newUnitCode}
                  onChange={(e) => setNewUnitCode(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="Unit Name"
                  value={newUnitName}
                  onChange={(e) => setNewUnitName(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <input
                type="text"
                placeholder="Description (optional)"
                value={newUnitDesc}
                onChange={(e) => setNewUnitDesc(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
              />
              <button
                type="submit"
                disabled={!orgTablesReady}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                + Add Functional Unit
              </button>
            </form>

            {/* Add Position */}
            <form
              onSubmit={handleAddPosition}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5"
            >
              <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
                <Plus className="w-4 h-4 text-blue-600" />
                <span>Add Security Position</span>
              </h3>
              <input
                type="text"
                placeholder="Position Title (e.g. Executive Protection Lead)"
                value={newPosTitle}
                onChange={(e) => setNewPosTitle(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg"
                required
              />
              <select
                value={newPosUnitId}
                onChange={(e) => setNewPosUnitId(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                {organizationalUnits.map((u) => (
                  <option key={u.id} value={u.id}>
                    {u.name}
                  </option>
                ))}
              </select>
              <label className="flex items-center space-x-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={newPosSupervisory}
                  onChange={(e) => setNewPosSupervisory(e.target.checked)}
                />
                <span>Supervisory organizational position</span>
              </label>
              <button
                type="submit"
                disabled={!orgTablesReady}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                + Add Position
              </button>
            </form>

            {/* Add Operating Region */}
            <form
              onSubmit={handleAddRegion}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5"
            >
              <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
                <MapPin className="w-4 h-4 text-blue-600" />
                <span>Add Operating Region</span>
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <input
                  type="text"
                  placeholder="Code"
                  value={newRegCode}
                  onChange={(e) => setNewRegCode(e.target.value)}
                  className="px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  required
                />
                <input
                  type="text"
                  placeholder="Region Name"
                  value={newRegName}
                  onChange={(e) => setNewRegName(e.target.value)}
                  className="col-span-2 px-2.5 py-1.5 border border-slate-300 rounded-lg"
                  required
                />
              </div>
              <select
                value={newRegIsland}
                onChange={(e) => setNewRegIsland(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white"
              >
                <option value="Luzon">Luzon</option>
                <option value="Visayas">Visayas</option>
                <option value="Mindanao">Mindanao</option>
                <option value="Nationwide">Nationwide</option>
              </select>
              <button
                type="submit"
                disabled={!orgTablesReady}
                className="w-full py-1.5 bg-slate-800 hover:bg-slate-900 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
              >
                + Add Region
              </button>
            </form>

            {/* Position-Specific KPI Weights & Targets Configuration */}
            <form
              onSubmit={handleSavePerformanceTarget}
              className="bg-white p-4 rounded-xl border border-slate-200 shadow-xs space-y-2.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="font-bold text-slate-900 flex items-center space-x-1.5">
                  <Sliders className="w-4 h-4 text-blue-600" />
                  <span>Position KPI Weights & Targets</span>
                </h3>
                <span className="text-[10px] text-slate-400">Non-Appraisal</span>
              </div>

              <select
                value={selectedTargetId}
                onChange={(e) => handleSelectTargetForEdit(e.target.value)}
                className="w-full px-2.5 py-1.5 border border-slate-300 rounded-lg bg-white text-slate-900 font-medium"
              >
                {performanceTargets.map((t) => (
                  <option key={t.id} value={t.id}>
                    {getTargetLabel(t)}
                  </option>
                ))}
              </select>

              {targetDraft && (
                <>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <label className="space-y-0.5">
                      <span className="text-slate-600 font-medium">Completion Wt %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={targetDraft.weight_completion ?? 35}
                        onChange={(e) =>
                          setTargetDraft({
                            ...targetDraft,
                            weight_completion: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-600 font-medium">On-Time SLA Wt %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={targetDraft.weight_on_time ?? 35}
                        onChange={(e) =>
                          setTargetDraft({
                            ...targetDraft,
                            weight_on_time: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-600 font-medium">Shift Logs Wt %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={targetDraft.weight_activity ?? 15}
                        onChange={(e) =>
                          setTargetDraft({
                            ...targetDraft,
                            weight_activity: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-600 font-medium">Initiatives Wt %</span>
                      <input
                        type="number"
                        min={0}
                        max={100}
                        value={targetDraft.weight_initiative ?? 15}
                        onChange={(e) =>
                          setTargetDraft({
                            ...targetDraft,
                            weight_initiative: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-600 font-medium">On-Time Goal %</span>
                      <input
                        type="number"
                        min={1}
                        max={100}
                        value={targetDraft.target_on_time_rate}
                        onChange={(e) =>
                          setTargetDraft({
                            ...targetDraft,
                            target_on_time_rate: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </label>
                    <label className="space-y-0.5">
                      <span className="text-slate-600 font-medium">Daily Logs / Day</span>
                      <input
                        type="number"
                        min={0}
                        max={10}
                        step={1}
                        value={targetDraft.daily_activity_target ?? 1}
                        onChange={(e) =>
                          setTargetDraft({
                            ...targetDraft,
                            daily_activity_target: Number(e.target.value),
                          })
                        }
                        className="w-full px-2 py-1 border border-slate-300 rounded"
                      />
                    </label>
                  </div>
                  {(() => {
                    const weightSum =
                      (targetDraft.weight_completion ?? 0) +
                      (targetDraft.weight_on_time ?? 0) +
                      (targetDraft.weight_activity ?? 0) +
                      (targetDraft.weight_initiative ?? 0);
                    return (
                      <div className="flex items-center justify-between text-[11px] pt-1">
                        <span
                          className={`font-semibold ${
                            weightSum === 100 ? 'text-emerald-700' : 'text-rose-700'
                          }`}
                        >
                          Total Weight: {weightSum}% {weightSum === 100 ? '✓' : '(Must = 100%)'}
                        </span>
                        <span className="text-slate-400">
                          Init. Goal: {targetDraft.monthly_initiative_goal}/mo
                        </span>
                      </div>
                    );
                  })()}
                  <button
                    type="submit"
                    disabled={!orgTablesReady || savingTarget}
                    className="w-full py-1.5 bg-blue-700 hover:bg-blue-800 text-white font-semibold rounded-lg transition disabled:opacity-50 cursor-pointer"
                  >
                    {savingTarget ? 'Saving Targets...' : 'Save KPI Weights & Targets'}
                  </button>
                </>
              )}
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
