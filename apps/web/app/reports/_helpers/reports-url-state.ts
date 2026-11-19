import {
  ianaTimezoneSchema,
  reportDateSchema,
  reportVerbositySchema,
  type ReportVerbosity,
} from '@repo/types/api/v1';

export type ReportUrlState = {
  readonly reportDate: string;
  readonly timezone: string;
  readonly projectIds: string[];
  readonly sprintIds: string[];
  readonly verbosity: ReportVerbosity;
};

type ReportUrlOptions = {
  readonly browserTimezone?: string;
  readonly now?: Date;
  readonly projectIds: readonly string[];
  readonly sprintIds: readonly string[];
};

function validTimezone(value: string | null | undefined): string | null {
  const parsed = ianaTimezoneSchema.safeParse(value);
  return parsed.success ? parsed.data : null;
}

export function getBrowserTimezone(): string {
  try {
    return (
      validTimezone(Intl.DateTimeFormat().resolvedOptions().timeZone) ?? 'UTC'
    );
  } catch {
    return 'UTC';
  }
}

export function currentDateInTimezone(now: Date, timezone: string): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const values = Object.fromEntries(
    parts.map((part) => [part.type, part.value])
  );
  return `${values.year}-${values.month}-${values.day}`;
}

function parseIds(
  value: string | null,
  allowedIds: readonly string[]
): string[] {
  if (!value) {
    return [];
  }
  const allowed = new Set(allowedIds);
  return [...new Set(value.split(',').filter((id) => allowed.has(id)))];
}

export function parseReportUrlState(
  params: Pick<URLSearchParams, 'get'>,
  options: ReportUrlOptions
): ReportUrlState {
  const timezone =
    validTimezone(params.get('timezone')) ??
    validTimezone(options.browserTimezone) ??
    'UTC';
  const now = options.now ?? new Date();
  const requestedDate = params.get('date');
  const reportDate = reportDateSchema.safeParse(requestedDate).success
    ? requestedDate!
    : currentDateInTimezone(now, timezone);
  const verbosity = reportVerbositySchema.safeParse(
    params.get('verbosity') ?? 'standard'
  );

  return {
    reportDate,
    timezone,
    projectIds: parseIds(params.get('projects'), options.projectIds),
    sprintIds: parseIds(params.get('sprints'), options.sprintIds),
    verbosity: verbosity.success ? verbosity.data : 'standard',
  };
}

export function serializeReportUrlState(
  state: ReportUrlState
): URLSearchParams {
  const params = new URLSearchParams({
    date: state.reportDate,
    timezone: state.timezone,
    verbosity: state.verbosity,
  });
  if (state.projectIds.length > 0) {
    params.set('projects', state.projectIds.join(','));
  }
  if (state.sprintIds.length > 0) {
    params.set('sprints', state.sprintIds.join(','));
  }
  return params;
}
