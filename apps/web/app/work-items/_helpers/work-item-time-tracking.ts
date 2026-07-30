export type TimeTrackingSummary = {
  estimatedHours: number;
  loggedHours: number;
  remainingHours: number;
  hasEstimate: boolean;
};

export function sumLoggedHours(
  workLogs: ReadonlyArray<{ logged_hours: number }>
): number {
  return workLogs.reduce((total, log) => total + log.logged_hours, 0);
}

export function computeTimeTrackingSummary(
  storyPoints: number | null | undefined,
  workLogs: ReadonlyArray<{ logged_hours: number }>
): TimeTrackingSummary {
  const estimatedHours = storyPoints ?? 0;
  const loggedHours = sumLoggedHours(workLogs);
  const remainingHours = Math.max(0, estimatedHours - loggedHours);

  return {
    estimatedHours,
    loggedHours,
    remainingHours,
    hasEstimate: estimatedHours > 0,
  };
}

export function formatDuration(hours: number): string {
  if (!Number.isFinite(hours) || hours <= 0) {
    return '0m';
  }

  const totalMinutes = Math.round(hours * 60);
  const days = Math.floor(totalMinutes / (60 * 8));
  const remainderAfterDays = totalMinutes - days * 60 * 8;
  const h = Math.floor(remainderAfterDays / 60);
  const m = remainderAfterDays % 60;

  const parts: string[] = [];
  if (days > 0) {
    parts.push(`${days}d`);
  }
  if (h > 0) {
    parts.push(`${h}h`);
  }
  if (m > 0 || parts.length === 0) {
    parts.push(`${m}m`);
  }

  return parts.join(' ');
}

export function progressPercent(value: number, total: number): number {
  if (total <= 0) {
    return 0;
  }

  return Math.min(100, Math.max(0, (value / total) * 100));
}
