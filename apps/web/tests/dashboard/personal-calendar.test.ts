import { beforeEach, describe, expect, it, vi } from 'vitest';

const store = new Map<string, string>();

vi.mock('@/lib/local-storage', () => ({
  getLocalStorageJson: (key: string) => {
    const raw = store.get(key);
    if (!raw) {
      return null;
    }
    return JSON.parse(raw) as unknown;
  },
  setLocalStorageJson: (key: string, value: unknown) => {
    store.set(key, JSON.stringify(value));
    return true;
  },
}));

import {
  addFocusTodo,
  type FocusTodo,
} from '@/app/dashboard/_helpers/focus-todos';
import {
  addPersonalCalendarEvent,
  calendarEventIdForFocusTodo,
  filterPersonalCalendarEvents,
  focusTodoIdForCalendarEvent,
  listPersonalCalendarEventsForDate,
  mirrorFocusToggleOntoCalendar,
  readPersonalCalendarEvents,
  reconcileTodayFocusAndCalendar,
  removeFocusTodosForCalendarEvent,
  syncFocusTodosFromTodayCalendar,
  syncTodayCalendarFromFocusTodos,
  togglePersonalCalendarEvent,
  writePersonalCalendarEvents,
} from '@/app/dashboard/_helpers/personal-calendar';

describe('personal calendar', () => {
  beforeEach(() => {
    store.clear();
  });

  it('round-trips events and lists by date', () => {
    let events = addPersonalCalendarEvent([], 'Ship docs', '2026-11-11');
    events = addPersonalCalendarEvent(events, 'Review PR', '2026-11-12');
    writePersonalCalendarEvents('user-1', events);
    expect(readPersonalCalendarEvents('user-1')).toHaveLength(2);
    expect(
      listPersonalCalendarEventsForDate(events, '2026-11-11').map(
        (e) => e.title
      )
    ).toEqual(['Ship docs']);
  });

  it('syncs incomplete today events into Focus without duplicating', () => {
    const events = addPersonalCalendarEvent([], 'Kata', '2026-11-11');
    const first = syncFocusTodosFromTodayCalendar([], events, '2026-11-11');
    expect(first).toHaveLength(1);
    expect(first[0]?.id).toBe(focusTodoIdForCalendarEvent(events[0]!.id));
    const second = syncFocusTodosFromTodayCalendar(first, events, '2026-11-11');
    expect(second).toHaveLength(1);
  });

  it('pushes Focus todos onto today and keeps a date-cell count', () => {
    const todos = addFocusTodo([], 'NeetCode');
    const withMore = addFocusTodo(todos, 'LeetCode x 3');
    const events = syncTodayCalendarFromFocusTodos([], withMore, '2026-11-11');
    expect(events).toHaveLength(2);
    expect(
      listPersonalCalendarEventsForDate(events, '2026-11-11').map(
        (e) => e.title
      )
    ).toEqual(['NeetCode', 'LeetCode x 3']);
    expect(calendarEventIdForFocusTodo(withMore[0]!.id)).toBe(withMore[0]!.id);
  });

  it('reconciles Focus and Calendar two-way for today', () => {
    const focusOnly = addFocusTodo([], 'SQL x 2');
    const calendarOnly = addPersonalCalendarEvent(
      [],
      'KataBench',
      '2026-11-11'
    );
    const { todos, events } = reconcileTodayFocusAndCalendar(
      focusOnly,
      calendarOnly,
      '2026-11-11'
    );
    expect(todos.map((todo) => todo.text).sort()).toEqual([
      'KataBench',
      'SQL x 2',
    ]);
    expect(
      listPersonalCalendarEventsForDate(events, '2026-11-11')
        .map((event) => event.title)
        .sort()
    ).toEqual(['KataBench', 'SQL x 2']);
  });

  it('mirrors Focus toggle onto the linked calendar event', () => {
    const events = addPersonalCalendarEvent([], 'Kata', '2026-11-11');
    const linkedId = focusTodoIdForCalendarEvent(events[0]!.id);
    const next = mirrorFocusToggleOntoCalendar(events, linkedId, true);
    expect(next[0]?.done).toBe(true);
  });

  it('filters Active / Done / All like Focus', () => {
    let events = addPersonalCalendarEvent([], 'Active one', '2026-11-11');
    events = addPersonalCalendarEvent(events, 'Done one', '2026-11-11');
    events = togglePersonalCalendarEvent(events, events[1]!.id);
    expect(
      filterPersonalCalendarEvents(events, 'active').map((e) => e.title)
    ).toEqual(['Active one']);
    expect(
      filterPersonalCalendarEvents(events, 'done').map((e) => e.title)
    ).toEqual(['Done one']);
    expect(filterPersonalCalendarEvents(events, 'all')).toHaveLength(2);
  });

  it('removes Focus rows when a calendar event is deleted', () => {
    const events = addPersonalCalendarEvent([], 'Kata', '2026-11-11');
    const todos: FocusTodo[] = [
      {
        id: focusTodoIdForCalendarEvent(events[0]!.id),
        text: 'Kata',
        done: false,
        createdAt: 1,
      },
      {
        id: 'keep-me',
        text: 'Other',
        done: false,
        createdAt: 2,
      },
    ];
    expect(
      removeFocusTodosForCalendarEvent(todos, events[0]!.id).map((t) => t.id)
    ).toEqual(['keep-me']);
  });

  it('does not resurrect a deleted calendar event after Focus twin is removed', () => {
    const focusTodo: FocusTodo = {
      id: 'todo-neetcode',
      text: 'NeetCode',
      done: false,
      createdAt: 1,
    };
    const events = syncTodayCalendarFromFocusTodos(
      [],
      [focusTodo],
      '2026-11-11'
    );
    expect(events).toHaveLength(1);

    const withoutFocus = removeFocusTodosForCalendarEvent(
      [focusTodo],
      events[0]!.id
    );
    const withoutEvent = events.filter((event) => event.id !== events[0]!.id);
    const { events: reconciledEvents } = reconcileTodayFocusAndCalendar(
      withoutFocus,
      withoutEvent,
      '2026-11-11'
    );
    expect(reconciledEvents).toHaveLength(0);
  });
});
