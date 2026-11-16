/**
 * Philippine Regions and Facility Sites for Security Operations Hub (SOH)
 * Covers major corporate facilities, data centers, and regional hubs in the Philippines.
 */

export const PHILIPPINE_REGIONS = [
  'NCR & Rizal (Head Office / BGC)',
  'NCR & Rizal (Makati SOC)',
  'NCR & Rizal (Pasig / Ortigas)',
  'NCR & Rizal (Quezon City Facility)',
  'NCR & Rizal (Taguig Data Center)',
  'NCR & Rizal (Antipolo / Cainta Rizal Hub)',
  'Region III - Central Luzon (Clark Logistics Hub)',
  'Region III - Central Luzon (Subic Security Post)',
  'Region IV-A - CALABARZON (Santa Rosa Warehouse)',
  'Region IV-A - CALABARZON (Laguna Technopark)',
  'Region IV-A - CALABARZON (Cavite Export Zone)',
  'Region VI - Western Visayas (Iloilo Hub)',
  'Region VI - Western Visayas (Bacolod Logistics Site)',
  'Region VII - Central Visayas (Cebu IT Park Hub)',
  'Region VII - Central Visayas (Mandaue Warehouse)',
  'Region X - Northern Mindanao (Cagayan de Oro Branch)',
  'Region XI - Davao Region (Davao Operations Center)',
  'Nationwide / Multi-Site',
] as const;

export const TASK_CATEGORIES = [
  'Inspection',
  'Investigation Follow-up',
  'CCTV / Access Concern',
  'Security Report',
  'Project Update',
  'Administrative Task',
  'Other',
] as const;

export const TASK_PRIORITIES = [
  { value: 'normal', label: 'Normal Priority', color: 'bg-slate-100 text-slate-700 border-slate-300' },
  { value: 'high', label: 'High Priority', color: 'bg-amber-100 text-amber-800 border-amber-300' },
  { value: 'urgent', label: 'Urgent Priority', color: 'bg-rose-100 text-rose-800 border-rose-300' },
] as const;

export const TASK_STATUS_CONFIG = {
  assigned: {
    label: 'Assigned',
    badgeClass: 'bg-blue-50 text-blue-700 border-blue-200',
    description: 'Task assigned to field supervisor; awaiting initial action',
  },
  in_progress: {
    label: 'In Progress',
    badgeClass: 'bg-indigo-50 text-indigo-700 border-indigo-200',
    description: 'Field inspection or investigation underway',
  },
  for_review: {
    label: 'For Review',
    badgeClass: 'bg-amber-50 text-amber-800 border-amber-200',
    description: 'Submitted by team member for Manager review & approval',
  },
  returned: {
    label: 'Returned for Revision',
    badgeClass: 'bg-rose-50 text-rose-700 border-rose-200',
    description: 'Manager requested corrections or additional evidence',
  },
  completed: {
    label: 'Completed',
    badgeClass: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    description: 'Verified and officially closed by Security Manager',
  },
} as const;
