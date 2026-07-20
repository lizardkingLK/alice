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
