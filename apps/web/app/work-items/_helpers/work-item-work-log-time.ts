const MILLISECONDS_PER_HOUR = 60 * 60 * 1000;
const MAX_LOGGED_HOURS = 1000;

export type CalculatedWorkLogEntry =
  | { readonly loggedHours: number; readonly loggedAt: string }
  | { readonly error: string };

function formatDateTimeLocal(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

export function createDefaultWorkLogDateTimes(now = new Date()): {
  readonly startAt: string;
  readonly endAt: string;
} {
  const start = new Date(now.getTime());
  start.setSeconds(0, 0);
  const end = new Date(start.getTime() + MILLISECONDS_PER_HOUR);
  return {
    startAt: formatDateTimeLocal(start),
    endAt: formatDateTimeLocal(end),
  };
}

/**
 * Calculates elapsed browser-local time for a new worklog. The persistence
 * contract stores only the start calendar date and calculated hours.
 */
export function calculateWorkLogEntry(
  startAtInput: string,
  endAtInput: string
): CalculatedWorkLogEntry {
  if (!startAtInput || !endAtInput) {
    return { error: 'Choose a start and end date and time.' };
  }

  const start = new Date(startAtInput);
  const end = new Date(endAtInput);
  const durationMilliseconds = end.getTime() - start.getTime();
  if (
    !Number.isFinite(start.getTime()) ||
    !Number.isFinite(end.getTime()) ||
    !Number.isFinite(durationMilliseconds)
  ) {
    return { error: 'Choose valid start and end date-times.' };
  }
  if (durationMilliseconds <= 0) {
    return { error: 'End date and time must be after the start.' };
  }

  const loggedHours = durationMilliseconds / MILLISECONDS_PER_HOUR;
  if (loggedHours > MAX_LOGGED_HOURS) {
    return { error: `Duration must not exceed ${MAX_LOGGED_HOURS} hours.` };
  }

  return {
    loggedHours: Math.round(loggedHours * 1_000_000) / 1_000_000,
    loggedAt: startAtInput.slice(0, 10),
  };
}
