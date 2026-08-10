export const delay = (ms: number = 3000) => {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
};

const DATE_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  day: 'numeric',
  year: 'numeric',
  // UTC keeps SSR and the browser on the same calendar day (avoids
  // hydration mismatches around local midnight).
  timeZone: 'UTC',
};

const DATE_TIME_FORMAT: Intl.DateTimeFormatOptions = {
  ...DATE_FORMAT,
  hour: 'numeric',
  minute: '2-digit',
};

const TIME_FORMAT: Intl.DateTimeFormatOptions = {
  hour: '2-digit',
  minute: '2-digit',
  hour12: true,
  timeZone: 'UTC',
};

const MONTH_YEAR_FORMAT: Intl.DateTimeFormatOptions = {
  month: 'short',
  year: 'numeric',
  timeZone: 'UTC',
};

/**
 * Formats a date for month/year display. Hydration-safe via `en-US` + UTC.
 */
export const formatMonthYear = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month] = value.split('-').map(Number);
    return new Date(Date.UTC(year!, month! - 1, 1)).toLocaleDateString(
      'en-US',
      MONTH_YEAR_FORMAT
    );
  }

  return new Date(value).toLocaleDateString('en-US', MONTH_YEAR_FORMAT);
};

/**
 * Formats a date string for display. Always uses `en-US` + UTC so server
 * and client render the same text (hydration-safe).
 */
export const formatDate = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  // Date-only values (YYYY-MM-DD) — treat as a calendar day, not local midnight.
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year!, month! - 1, day!)).toLocaleDateString(
      'en-US',
      DATE_FORMAT
    );
  }

  return new Date(value).toLocaleDateString('en-US', DATE_FORMAT);
};

/**
 * Formats a timestamp for display (date + time). Hydration-safe via `en-US` + UTC.
 */
export const formatDateTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleString('en-US', DATE_TIME_FORMAT);
};

/**
 * Relative time for client UI (e.g. "2 minutes ago"). Not hydration-safe —
 * only use in client components after mount when needed.
 */
export const formatRelativeTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '—';
  }

  const diffSeconds = Math.round((date.getTime() - Date.now()) / 1000);
  const absSeconds = Math.abs(diffSeconds);
  const rtf = new Intl.RelativeTimeFormat('en', { numeric: 'auto' });

  if (absSeconds < 60) {
    return rtf.format(diffSeconds, 'second');
  }

  const diffMinutes = Math.round(diffSeconds / 60);
  if (Math.abs(diffMinutes) < 60) {
    return rtf.format(diffMinutes, 'minute');
  }

  const diffHours = Math.round(diffMinutes / 60);
  if (Math.abs(diffHours) < 24) {
    return rtf.format(diffHours, 'hour');
  }

  const diffDays = Math.round(diffHours / 24);
  if (Math.abs(diffDays) < 30) {
    return rtf.format(diffDays, 'day');
  }

  const diffMonths = Math.round(diffDays / 30);
  if (Math.abs(diffMonths) < 12) {
    return rtf.format(diffMonths, 'month');
  }

  return rtf.format(Math.round(diffMonths / 12), 'year');
};

/**
 * Formats a time-of-day for display. Hydration-safe via `en-US` + UTC.
 */
export const formatTime = (value: string | null): string => {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleTimeString('en-US', TIME_FORMAT);
};

export const formatLabelWithSpace = (value: string): string => {
  return value.replace(/([a-z])([A-Z])/g, '$1 $2');
};

export const formatLabelFirstLetterCapitalized = (value: string): string => {
  return value[0]?.toUpperCase() + value.substring(1, value.length);
};

export const getInitials = (name: string | null | undefined): string => {
  if (!name) {
    return '?';
  }

  return name
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
};

const UUID_SEGMENT =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

/** First 8 chars of a UUID (or any id), uppercased — breadcrumb / list key display. */
export function toShortId(id: string): string {
  return id.slice(0, 8).toUpperCase();
}

/** True when a path segment looks like a UUID (used to shorten breadcrumb labels). */
export function isUuidSegment(segment: string): boolean {
  return UUID_SEGMENT.test(segment);
}

/**
 * Stable string ids for skeleton maps (avoids React array-index keys / S6479).
 */
export function skeletonKeys(prefix: string, count: number): string[] {
  return Array.from({ length: count }, (_, i) => `${prefix}-${i}`);
}

/** Human-readable file size (B / KB / MB). */
export function formatFileSize(bytes: number): string {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Format a UTC date to ISO-8601 string. Month index is 0-indexed. */
export function formatDateToISOString(
  year: number,
  monthIndex: number,
  day: number,
  hour: number = 0,
  minute: number = 0,
  second: number = 0
): string {
  return new Date(
    Date.UTC(year, monthIndex, day, hour, minute, second)
  ).toISOString();
}
