import { beforeEach, describe, expect, it } from 'vitest';
import {
  calendarUnscheduledPanelOpenStorageKey,
  readCalendarUnscheduledPanelOpen,
  writeCalendarUnscheduledPanelOpen,
} from '@/app/calendar/_helpers/calendar-unscheduled-panel-storage';

const USER_ID = 'user-calendar-unscheduled-1';
const STORAGE_KEY = calendarUnscheduledPanelOpenStorageKey(USER_ID);

describe('calendar-unscheduled-panel-storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('defaults to closed when nothing is stored or user is missing', () => {
    expect(readCalendarUnscheduledPanelOpen(USER_ID)).toBe(false);
    expect(readCalendarUnscheduledPanelOpen(undefined)).toBe(false);
  });

  it('persists open and closed preference', () => {
    writeCalendarUnscheduledPanelOpen(USER_ID, true);
    expect(JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null')).toBe(true);
    expect(readCalendarUnscheduledPanelOpen(USER_ID)).toBe(true);

    writeCalendarUnscheduledPanelOpen(USER_ID, false);
    expect(readCalendarUnscheduledPanelOpen(USER_ID)).toBe(false);
  });

  it('skips writes without a user id', () => {
    writeCalendarUnscheduledPanelOpen(null, true);
    expect(localStorage).toHaveLength(0);
  });
});
