import { describe, expect, it, vi, afterEach } from 'vitest';
import {
  isWorkItemOverdue,
  toDateOnly,
} from '@/app/work-items/_helpers/work-item-due-date';

describe('work-item-due-date', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('normalizes ISO timestamps to date-only', () => {
    expect(toDateOnly('2026-07-31T12:00:00.000Z')).toBe('2026-07-31');
    expect(toDateOnly(null)).toBeNull();
  });

  it('marks past due incomplete items as overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00'));

    expect(isWorkItemOverdue('2026-07-31', 'InProgress')).toBe(true);
    expect(isWorkItemOverdue('2026-08-06', 'InProgress')).toBe(false);
    expect(isWorkItemOverdue('2026-08-07', 'InProgress')).toBe(false);
  });

  it('does not mark Done items as overdue', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-08-06T12:00:00'));

    expect(isWorkItemOverdue('2026-07-31', 'Done')).toBe(false);
  });

  it('ignores missing due dates', () => {
    expect(isWorkItemOverdue(null, 'ToDo')).toBe(false);
  });
});
