/**
 * Date and Time Utilities for Security Operations Hub (SOH)
 * Configured specifically for Philippine Local Time (Asia/Manila, UTC+8)
 */

/**
 * Returns current date in Philippine Standard Time as YYYY-MM-DD
 */
export function getPhilippineToday(): string {
  const now = new Date();
  // Using Intl to guarantee Asia/Manila date string
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Manila',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
  return formatter.format(now); // en-CA gives YYYY-MM-DD
}

/**
 * Format date string (YYYY-MM-DD or ISO) into readable Philippine format
 * e.g., "Nov 08, 2026"
 */
export function formatPhilippineDate(dateStr?: string | null): string {
  if (!dateStr) return '—';
  try {
    const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00+08:00`);
    return new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(date);
  } catch {
    return dateStr;
  }
}

/**
 * Format ISO timestamp into full date & time with Philippine Timezone notation
 * e.g., "Nov 08, 2026, 11:00 AM PHT"
 */
export function formatPhilippineDateTime(isoStr?: string | null): string {
  if (!isoStr) return '—';
  try {
    const date = new Date(isoStr);
    const formatted = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(date);
    return `${formatted} PHT`;
  } catch {
    return isoStr;
  }
}

/**
 * Check if a task is overdue based on Philippine date and incomplete status.
 * Incomplete = NOT completed.
 * Overdue = due_date < today and status != 'completed'
 */
export function isTaskOverdue(dueDate: string, status: string): boolean {
  if (status === 'completed') return false;
  const today = getPhilippineToday();
  return dueDate < today;
}

/**
 * Check if a task is due today in Philippine Time.
 */
export function isTaskDueToday(dueDate: string, status: string): boolean {
  if (status === 'completed') return false;
  const today = getPhilippineToday();
  return dueDate === today;
}

/**
 * Get human-readable time remaining or days overdue
 */
export function getDueStatusLabel(dueDate: string, status: string): {
  label: string;
  isOverdue: boolean;
  isToday: boolean;
} {
  if (status === 'completed') {
    return { label: 'Completed', isOverdue: false, isToday: false };
  }

  const today = getPhilippineToday();
  if (dueDate === today) {
    return { label: 'Due Today', isOverdue: false, isToday: true };
  }

  if (dueDate < today) {
    // Calculate days overdue
    const dToday = new Date(`${today}T00:00:00`);
    const dDue = new Date(`${dueDate}T00:00:00`);
    const diffTime = Math.abs(dToday.getTime() - dDue.getTime());
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    return {
      label: `${diffDays} day${diffDays > 1 ? 's' : ''} overdue`,
      isOverdue: true,
      isToday: false,
    };
  }

  // Future due date
  const dToday = new Date(`${today}T00:00:00`);
  const dDue = new Date(`${dueDate}T00:00:00`);
  const diffTime = Math.abs(dDue.getTime() - dToday.getTime());
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return {
    label: diffDays === 1 ? 'Due tomorrow' : `Due in ${diffDays} days`,
    isOverdue: false,
    isToday: false,
  };
}
