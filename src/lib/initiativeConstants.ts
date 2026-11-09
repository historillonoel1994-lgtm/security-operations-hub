import { InitiativeCategory, InitiativeStatus, InitiativeType, UserRole } from '../types/index.ts';

export const INITIATIVE_CATEGORIES: InitiativeCategory[] = [
  'Security Inspection',
  'Risk Identification',
  'Preventive Security Action',
  'CCTV / Door Access Concern',
  'Security Process Improvement',
  'Incident Prevention',
  'Coordination / Collaboration',
  'Workplace Safety',
  'Other',
];

export const INITIATIVE_TYPES: {
  value: InitiativeType;
  label: string;
  badge: string;
  description: string;
  workflowHint: string;
}[] = [
  {
    value: 'proposed',
    label: 'Proposed Activity',
    badge: 'bg-indigo-50 text-indigo-800 border-indigo-200',
    description: 'Requires Manager authorization before field implementation.',
    workflowHint: 'Submit proposal -> Manager Approves -> Conduct Activity -> Submit Accomplishment -> Manager Recognition',
  },
  {
    value: 'self_initiated',
    label: 'Self-Initiated Accomplishment',
    badge: 'bg-teal-50 text-teal-800 border-teal-200',
    description: 'A permitted routine security activity already performed and awaiting manager validation.',
    workflowHint: 'Document completed activity -> Submit for Validation -> Manager Verification & Recognition',
  },
];

export const INITIATIVE_STATUS_CONFIG: Record<
  InitiativeStatus,
  {
    label: string;
    badgeClass: string;
    description: string;
  }
> = {
  draft: {
    label: 'Draft',
    badgeClass: 'bg-slate-100 text-slate-700 border-slate-300',
    description: 'Saved locally; not yet submitted for Manager review.',
  },
  pending_review: {
    label: 'Pending Review',
    badgeClass: 'bg-amber-100 text-amber-900 border-amber-300',
    description: 'Awaiting Security Manager evaluation and disposition.',
  },
  approved_to_proceed: {
    label: 'Approved to Proceed',
    badgeClass: 'bg-blue-100 text-blue-900 border-blue-300',
    description: 'Manager authorized proposed work. Field implementation may proceed.',
  },
  in_progress: {
    label: 'In Progress',
    badgeClass: 'bg-cyan-100 text-cyan-900 border-cyan-300',
    description: 'Authorized initiative is currently being executed in the field.',
  },
  accomplishment_submitted: {
    label: 'Accomplishment Submitted',
    badgeClass: 'bg-purple-100 text-purple-900 border-purple-300',
    description: 'Member submitted completed findings and evidence for Manager validation.',
  },
  returned: {
    label: 'Returned for Revision',
    badgeClass: 'bg-rose-100 text-rose-900 border-rose-300',
    description: 'Returned by Manager with feedback. Member can edit and resubmit.',
  },
  recognized: {
    label: 'Officially Recognized',
    badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-300 font-bold',
    description: 'Accomplishment validated and officially recognized in department reports.',
  },
  rejected: {
    label: 'Rejected',
    badgeClass: 'bg-zinc-200 text-zinc-800 border-zinc-400',
    description: 'Proposal or submission declined by Security Management.',
  },
};

/**
 * Validates if a status transition is permitted according to corporate governance rules.
 */
export function isValidInitiativeTransition(
  currentStatus: InitiativeStatus,
  nextStatus: InitiativeStatus,
  actorRole: UserRole,
  initiativeType: InitiativeType
): boolean {
  if (actorRole === 'manager') {
    // Managers can:
    // From pending_review:
    //   - if proposed: approved_to_proceed, returned, rejected
    //   - if self_initiated: recognized, returned, rejected
    // From accomplishment_submitted: recognized, returned, rejected
    // From recognized: can revoke recognition (reverts to returned or rejected with documented reason)
    // From in_progress: can cancel/reject or return
    if (currentStatus === 'pending_review') {
      if (initiativeType === 'proposed') {
        return ['approved_to_proceed', 'returned', 'rejected'].includes(nextStatus);
      }
      return ['recognized', 'returned', 'rejected'].includes(nextStatus);
    }
    if (currentStatus === 'accomplishment_submitted') {
      return ['recognized', 'returned', 'rejected'].includes(nextStatus);
    }
    if (currentStatus === 'recognized') {
      return ['returned', 'rejected'].includes(nextStatus); // Revocation with documented reason
    }
    if (currentStatus === 'approved_to_proceed') {
      return ['in_progress', 'returned', 'rejected'].includes(nextStatus);
    }
    if (currentStatus === 'in_progress') {
      return ['returned', 'rejected'].includes(nextStatus);
    }
    return false;
  }

  // Member transitions:
  // From draft -> pending_review (proposed) or accomplishment_submitted (self_initiated)
  if (currentStatus === 'draft') {
    return ['draft', 'pending_review', 'accomplishment_submitted'].includes(nextStatus);
  }

  // From returned -> pending_review or accomplishment_submitted
  if (currentStatus === 'returned') {
    return ['pending_review', 'accomplishment_submitted', 'draft'].includes(nextStatus);
  }

  // From approved_to_proceed -> in_progress
  if (currentStatus === 'approved_to_proceed') {
    return nextStatus === 'in_progress';
  }

  // From in_progress -> accomplishment_submitted
  if (currentStatus === 'in_progress') {
    return nextStatus === 'accomplishment_submitted';
  }

  // Members can never transition to recognized or approved_to_proceed on their own
  return false;
}
