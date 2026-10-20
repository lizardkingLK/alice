type DateParts = {
  readonly year: number;
  readonly month: number;
  readonly day: number;
};

export class ReportTimezoneError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ReportTimezoneError';
  }
}

function parseDateOnly(value: string): DateParts {
  const [year, month, day] = value.split('-').map(Number);
  return { year: year!, month: month!, day: day! };
}

function addCalendarDays(value: string, days: number): string {
  const { year, month, day } = parseDateOnly(value);
  const result = new Date(Date.UTC(year, month - 1, day + days));
  return result.toISOString().slice(0, 10);
}

function zonedParts(date: Date, timezone: string) {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: timezone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  });
  const values = new Map(
    formatter
      .formatToParts(date)
      .filter((part) => part.type !== 'literal')
      .map((part) => [part.type, Number(part.value)])
  );
  return {
    year: values.get('year')!,
    month: values.get('month')!,
    day: values.get('day')!,
    hour: values.get('hour')!,
    minute: values.get('minute')!,
    second: values.get('second')!,
  };
}

function timezoneOffsetMs(date: Date, timezone: string): number {
  const parts = zonedParts(date, timezone);
  const representedAsUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second
  );
  return representedAsUtc - date.getTime();
}

function localMidnightToUtc(value: string, timezone: string): Date {
  const { year, month, day } = parseDateOnly(value);
  const localAsUtc = Date.UTC(year, month - 1, day);
  const offsets = new Set<number>();
  const sampleHours = [-48, -24, -12, 0, 12, 24, 48];
  for (const hours of sampleHours) {
    offsets.add(
      timezoneOffsetMs(new Date(localAsUtc + hours * 60 * 60 * 1000), timezone)
    );
  }

  const candidates = [...offsets]
    .map((offset) => localAsUtc - offset)
    .filter((instant) => {
      const parts = zonedParts(new Date(instant), timezone);
      return parts.year === year && parts.month === month && parts.day === day;
    });

  if (candidates.length === 0) {
    throw new ReportTimezoneError(
      `${value} does not exist in timezone ${timezone}`
    );
  }

  return new Date(Math.min(...candidates));
}

/** UTC half-open interval for one calendar date in an IANA timezone. */
export function dailyReportUtcRange(
  reportDate: string,
  timezone: string
): {
  start: Date;
  endExclusive: Date;
} {
  return {
    start: localMidnightToUtc(reportDate, timezone),
    endExclusive: localMidnightToUtc(addCalendarDays(reportDate, 1), timezone),
  };
}
