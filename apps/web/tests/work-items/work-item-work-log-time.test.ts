import { describe, expect, it } from 'vitest';
import {
  calculateWorkLogEntry,
  createDefaultWorkLogDateTimes,
} from '@/app/work-items/_helpers/work-item-work-log-time';

describe('manual work log date-time calculation', () => {
  it('calculates hours and preserves the selected start calendar date', () => {
    expect(
      calculateWorkLogEntry('2026-11-05T08:30', '2026-11-05T11:00')
    ).toEqual({
      loggedHours: 2.5,
      loggedAt: '2026-11-05',
    });
  });

  it('supports overnight entries', () => {
    expect(
      calculateWorkLogEntry('2026-11-05T23:30', '2026-11-06T01:15')
    ).toEqual({
      loggedHours: 1.75,
      loggedAt: '2026-11-05',
    });
  });

  it('rejects missing, reversed, and over-limit durations', () => {
    expect(calculateWorkLogEntry('', '')).toEqual({
      error: 'Choose a start and end date and time.',
    });
    expect(
      calculateWorkLogEntry('2026-11-05T10:00', '2026-11-05T10:00')
    ).toEqual({ error: 'End date and time must be after the start.' });
    expect(
      calculateWorkLogEntry('2026-01-01T00:00', '2026-02-12T00:01')
    ).toEqual({ error: 'Duration must not exceed 1000 hours.' });
  });

  it('creates one-hour defaults using datetime-local values', () => {
    const result = createDefaultWorkLogDateTimes(
      new Date(2026, 10, 5, 8, 37, 42)
    );

    expect(result).toEqual({
      startAt: '2026-11-05T08:37',
      endAt: '2026-11-05T09:37',
    });
  });
});
