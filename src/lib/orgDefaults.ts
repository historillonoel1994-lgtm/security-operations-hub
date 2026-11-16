import {
  OrganizationalUnit,
  OrganizationalPosition,
  OperatingRegion,
  EmploymentCategory,
  OperationalStatus,
  PerformanceTarget,
} from '../types/index.ts';

export const DEFAULT_ORGANIZATIONAL_UNITS: OrganizationalUnit[] = [
  {
    id: 'unit-exec',
    code: 'EXEC',
    name: 'Executive & Department Management',
    description: 'VP & Head of Security and Security Manager oversight (Security Department)',
    parent_unit_id: null,
    sort_order: 1,
    is_active: true,
  },
  {
    id: 'unit-rso',
    code: 'RSO',
    name: 'Regional Security Operations',
    description:
      'Regional Security Supervisors, Investigators, and Security Officers across Philippine facilities',
    parent_unit_id: 'unit-exec',
    sort_order: 2,
    is_active: true,
  },
  {
    id: 'unit-scc',
    code: 'SCC',
    name: 'Security Command Center',
    description:
      'Command Center Supervisors and CCTV Operators managing central and site monitoring',
    parent_unit_id: 'unit-exec',
    sort_order: 3,
    is_active: true,
  },
  {
    id: 'unit-rpm',
    code: 'RPM',
    name: 'Reporting & Performance Management',
    description:
      'Report Management Officers overseeing incident reporting, records, follow-up, and management reports',
    parent_unit_id: 'unit-exec',
    sort_order: 4,
    is_active: true,
  },
  {
    id: 'unit-supp',
    code: 'SUPPORT',
    name: 'Security Support Functions',
    description:
      'Other authorized security support units added by the Security Manager',
    parent_unit_id: 'unit-exec',
    sort_order: 5,
    is_active: true,
  },
];

export const DEFAULT_POSITIONS: OrganizationalPosition[] = [
  {
    id: 'pos-vp',
    title: 'VP & Head of Security',
    unit_id: 'unit-exec',
    hierarchy_level: 1,
    is_supervisory: true,
    description: 'Executive security oversight across Security Department operations',
    is_active: true,
  },
  {
    id: 'pos-mgr',
    title: 'Security Manager',
    unit_id: 'unit-exec',
    hierarchy_level: 2,
    is_supervisory: true,
    description: 'Department management, task delegation, approvals, and performance oversight',
    is_active: true,
  },
  {
    id: 'pos-rso-sup',
    title: 'Regional Security Supervisor',
    unit_id: 'unit-rso',
    hierarchy_level: 3,
    is_supervisory: true,
    description: 'Supervises regional security operations, inspections, and site compliance',
    is_active: true,
  },
  {
    id: 'pos-inv',
    title: 'Investigator',
    unit_id: 'unit-rso',
    hierarchy_level: 4,
    is_supervisory: false,
    description: 'Handles security investigations, follow-ups, and case documentation',
    is_active: true,
  },
  {
    id: 'pos-sec-off',
    title: 'Security Officer',
    unit_id: 'unit-rso',
    hierarchy_level: 4,
    is_supervisory: false,
    description: 'Organic field security officer executing inspections and preventive checks',
    is_active: true,
  },
  {
    id: 'pos-scc-sup',
    title: 'Command Center Supervisor',
    unit_id: 'unit-scc',
    hierarchy_level: 3,
    is_supervisory: true,
    description: 'Oversees central and site-based CCTV & monitoring operations',
    is_active: true,
  },
  {
    id: 'pos-cctv',
    title: 'CCTV Operator',
    unit_id: 'unit-scc',
    hierarchy_level: 4,
    is_supervisory: false,
    description: 'Monitors CCTV feeds, access control alerts, and SOC escalation logs',
    is_active: true,
  },
  {
    id: 'pos-rmo',
    title: 'Report Management Officer',
    unit_id: 'unit-rpm',
    hierarchy_level: 4,
    is_supervisory: false,
    description: 'Manages incident reporting, compliance records, follow-ups, and management reports',
    is_active: true,
  },
  {
    id: 'pos-supp',
    title: 'Security Support Specialist',
    unit_id: 'unit-supp',
    hierarchy_level: 4,
    is_supervisory: false,
    description: 'Authorized Security Department support personnel',
    is_active: true,
  },
];

export const DEFAULT_OPERATING_REGIONS: OperatingRegion[] = [
  { id: 'reg-ncr', code: 'NCR', name: 'NCR & Rizal', island_group: 'Luzon', sort_order: 1, is_active: true },
  { id: 'reg-nlz', code: 'NLZ', name: 'North Luzon', island_group: 'Luzon', sort_order: 2, is_active: true },
  { id: 'reg-clz', code: 'CLZ', name: 'Central Luzon', island_group: 'Luzon', sort_order: 3, is_active: true },
  { id: 'reg-slz', code: 'SLZ', name: 'South Luzon', island_group: 'Luzon', sort_order: 4, is_active: true },
  { id: 'reg-bcl', code: 'BCL', name: 'Bicol', island_group: 'Luzon', sort_order: 5, is_active: true },
  { id: 'reg-vis-6', code: 'VIS6', name: 'Visayas Region 6', island_group: 'Visayas', sort_order: 6, is_active: true },
  { id: 'reg-vis-7', code: 'VIS7', name: 'Visayas Region 7', island_group: 'Visayas', sort_order: 7, is_active: true },
  { id: 'reg-min-10', code: 'MIN10', name: 'Mindanao Region 10', island_group: 'Mindanao', sort_order: 8, is_active: true },
  { id: 'reg-min-11', code: 'MIN11', name: 'Mindanao Region 11', island_group: 'Mindanao', sort_order: 9, is_active: true },
  { id: 'reg-nat', code: 'NAT', name: 'Nationwide / Multi-Site', island_group: 'Nationwide', sort_order: 10, is_active: true },
];

export const DEFAULT_PERFORMANCE_TARGETS: PerformanceTarget[] = [
  {
    id: 'tgt-rso-sup',
    unit_id: 'unit-rso',
    position_id: 'pos-rso-sup',
    target_completion_rate: 90,
    target_on_time_rate: 85,
    monthly_initiative_goal: 1,
    weight_completion: 30,
    weight_on_time: 35,
    weight_activity: 20,
    weight_initiative: 15,
    daily_activity_target: 1,
    notes: 'Regional Security Supervisor: balanced site SLA, team inspection follow-up, and field logs',
  },
  {
    id: 'tgt-inv',
    unit_id: 'unit-rso',
    position_id: 'pos-inv',
    target_completion_rate: 92,
    target_on_time_rate: 88,
    monthly_initiative_goal: 1,
    weight_completion: 35,
    weight_on_time: 35,
    weight_activity: 15,
    weight_initiative: 15,
    daily_activity_target: 1,
    notes: 'Investigator: case follow-up closure, documentation timeliness, and preventive findings',
  },
  {
    id: 'tgt-sec-off',
    unit_id: 'unit-rso',
    position_id: 'pos-sec-off',
    target_completion_rate: 90,
    target_on_time_rate: 85,
    monthly_initiative_goal: 1,
    weight_completion: 30,
    weight_on_time: 30,
    weight_activity: 25,
    weight_initiative: 15,
    daily_activity_target: 1,
    notes: 'Security Officer: field inspection execution, daily shift logs, and proactive checks',
  },
  {
    id: 'tgt-scc-sup',
    unit_id: 'unit-scc',
    position_id: 'pos-scc-sup',
    target_completion_rate: 95,
    target_on_time_rate: 90,
    monthly_initiative_goal: 1,
    weight_completion: 30,
    weight_on_time: 35,
    weight_activity: 20,
    weight_initiative: 15,
    daily_activity_target: 1,
    notes: 'Command Center Supervisor: SOC escalation timeliness, audit resolution, and shift watch logs',
  },
  {
    id: 'tgt-cctv',
    unit_id: 'unit-scc',
    position_id: 'pos-cctv',
    target_completion_rate: 95,
    target_on_time_rate: 90,
    monthly_initiative_goal: 1,
    weight_completion: 25,
    weight_on_time: 30,
    weight_activity: 35,
    weight_initiative: 10,
    daily_activity_target: 2,
    notes: 'CCTV Operator: consistent shift monitoring logs, camera/access audits, and prompt escalation',
  },
  {
    id: 'tgt-rmo',
    unit_id: 'unit-rpm',
    position_id: 'pos-rmo',
    target_completion_rate: 95,
    target_on_time_rate: 92,
    monthly_initiative_goal: 1,
    weight_completion: 35,
    weight_on_time: 40,
    weight_activity: 15,
    weight_initiative: 10,
    daily_activity_target: 1,
    notes: 'Report Management Officer: report compliance timeliness, accuracy, and audit follow-ups',
  },
  {
    id: 'tgt-rso',
    unit_id: 'unit-rso',
    position_id: null,
    target_completion_rate: 90,
    target_on_time_rate: 85,
    monthly_initiative_goal: 1,
    weight_completion: 35,
    weight_on_time: 35,
    weight_activity: 15,
    weight_initiative: 15,
    daily_activity_target: 1,
    notes: 'Standard Regional Security Operations operational benchmark',
  },
];

export const EMPLOYMENT_CATEGORY_LABELS: Record<EmploymentCategory, string> = {
  management: 'Department Management',
  supervisor: 'Supervisory Personnel',
  organic_personnel: 'Organic Security Personnel',
  support_staff: 'Security Support Staff',
};

export const OPERATIONAL_STATUS_CONFIG: Record<
  OperationalStatus,
  { label: string; badgeClass: string }
> = {
  active: {
    label: 'Active Duty',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  },
  on_leave: {
    label: 'On Leave',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
  },
  reassigned: {
    label: 'Reassigned / Transition',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
  },
  inactive: {
    label: 'Inactive',
    badgeClass: 'bg-slate-100 text-slate-600 border-slate-300',
  },
};

/**
 * Maps legacy or site-specific region strings (e.g. "Region IV-A - CALABARZON (Santa Rosa Warehouse)")
 * onto the canonical Philippine Operating Region ID for accurate regional performance aggregation
 * without altering historical task/activity/initiative records.
 */
export function resolveOperatingRegionId(
  regionString?: string | null,
  regions: OperatingRegion[] = DEFAULT_OPERATING_REGIONS
): string {
  if (!regionString) return 'reg-ncr';
  const s = regionString.toLowerCase();

  // Direct match by id, code, or name
  const exact = regions.find(
    (r) => r.id.toLowerCase() === s || r.name.toLowerCase() === s || r.code.toLowerCase() === s
  );
  if (exact) return exact.id;

  if (s.includes('nationwide') || s.includes('multi-site')) {
    return 'reg-nat';
  }
  if (
    s.includes('ncr') ||
    s.includes('metro manila') ||
    s.includes('rizal') ||
    s.includes('antipolo') ||
    s.includes('cainta') ||
    s.includes('taytay') ||
    s.includes('bgc') ||
    s.includes('makati') ||
    s.includes('pasig') ||
    s.includes('ortigas') ||
    s.includes('quezon') ||
    s.includes('taguig')
  ) {
    return 'reg-ncr';
  }
  if (
    s.includes('south luzon') ||
    /\bregion\s+iv\b/.test(s) ||
    s.includes('region iv-a') ||
    s.includes('region iv-b') ||
    s.includes('calabarzon') ||
    s.includes('mimaropa') ||
    s.includes('laguna') ||
    s.includes('cavite') ||
    s.includes('santa rosa') ||
    s.includes('batangas')
  ) {
    return 'reg-slz';
  }
  if (
    s.includes('central luzon') ||
    /\bregion\s+iii\b/.test(s) ||
    s.includes('clark') ||
    s.includes('subic') ||
    s.includes('pampanga') ||
    s.includes('bulacan')
  ) {
    return 'reg-clz';
  }
  if (
    s.includes('bicol') ||
    /\bregion\s+v\b/.test(s) ||
    s.includes('legazpi') ||
    s.includes('naga')
  ) {
    return 'reg-bcl';
  }

  // Visayas Subdivisions: Region 6 vs Region 7 (checked before generic Visayas)
  if (
    s.includes('visayas region 6') ||
    s.includes('region 6') ||
    /\bregion\s+vi\b/.test(s) ||
    s.includes('western visayas') ||
    s.includes('iloilo') ||
    s.includes('bacolod') ||
    s.includes('negros occidental') ||
    s.includes('kalibo') ||
    s.includes('capiz')
  ) {
    return 'reg-vis-6';
  }
  if (
    s.includes('visayas region 7') ||
    s.includes('region 7') ||
    /\bregion\s+vii\b/.test(s) ||
    s.includes('central visayas') ||
    s.includes('cebu') ||
    s.includes('mandaue') ||
    s.includes('lapu-lapu') ||
    s.includes('bohol') ||
    s.includes('dumaguete')
  ) {
    return 'reg-vis-7';
  }
  if (s.includes('visayas') || /\bregion\s+viii\b/.test(s)) {
    return regions.some((r) => r.id === 'reg-vis') ? 'reg-vis' : 'reg-vis-7';
  }

  // Mindanao Subdivisions: Region 10 vs Region 11 (checked before generic Mindanao)
  if (
    s.includes('mindanao region 10') ||
    s.includes('region 10') ||
    /\bregion\s+x\b/.test(s) ||
    s.includes('northern mindanao') ||
    s.includes('cagayan de oro') ||
    /\bcdo\b/.test(s) ||
    s.includes('iligan') ||
    s.includes('bukidnon') ||
    s.includes('misamis')
  ) {
    return 'reg-min-10';
  }
  if (
    s.includes('mindanao region 11') ||
    s.includes('region 11') ||
    /\bregion\s+xi\b/.test(s) ||
    s.includes('davao') ||
    s.includes('tagum') ||
    s.includes('digos') ||
    s.includes('panabo')
  ) {
    return 'reg-min-11';
  }
  if (
    s.includes('mindanao') ||
    s.includes('zamboanga') ||
    s.includes('gensan') ||
    s.includes('caraga') ||
    /\bregion\s+(ix|xii|xiii)\b/.test(s)
  ) {
    return regions.some((r) => r.id === 'reg-min') ? 'reg-min' : 'reg-min-11';
  }

  if (
    s.includes('north luzon') ||
    /\bregion\s+(i|ii)\b/.test(s) ||
    /\bcar\b/.test(s) ||
    s.includes('baguio') ||
    s.includes('ilocos') ||
    s.includes('cagayan valley')
  ) {
    return 'reg-nlz';
  }

  return 'reg-ncr';
}
