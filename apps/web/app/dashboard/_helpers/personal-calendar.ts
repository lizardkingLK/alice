/**
 * Per-user personal Overview calendar (browser localStorage only).
 * Not synced with the board work-item calendar.
 */

import { toLocalYYYYMMDD } from '@/app/_shared/utility';
import { getLocalStorageJson, setLocalStorageJson } from '@/lib/local-storage';
import type { FocusTodo } from '@/app/dashboard/_helpers/focus-todos';
import {
  FOCUS_TODOS_MAX,
  focusTodosFingerprint,
} from '@/app/dashboard/_helpers/focus-todos';

const STORAGE_PREFIX = 'alice:overview-personal-calendar:v1:';
export const PERSONAL_CALENDAR_CHANGED_EVENT =
  'alice-personal-calendar-changed';
export const PERSONAL_CALENDAR_EVENTS_MAX = 200;
export const PERSONAL_CALENDAR_TITLE_MAX = 200;

export type PersonalCalendarEvent = {
  readonly id: string;
  readonly title: string;
  /** Local calendar day `YYYY-MM-DD`. */
  readonly date: string;
  readonly done: boolean;
  readonly createdAt: number;
};

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

function newEventId(): string {
  if (
    typeof crypto !== 'undefined' &&
    typeof crypto.randomUUID === 'function'
  ) {
    return crypto.randomUUID();
  }
  return `cal-${Date.now()}`;
}

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function isDateString(value: unknown): value is string {
  return typeof value === 'string' && DATE_RE.test(value);
}

function normalizeEvent(value: unknown): PersonalCalendarEvent | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  const row = value as Record<string, unknown>;
  if (typeof row.id !== 'string' || row.id.length === 0) {
    return null;
  }
  if (typeof row.title !== 'string') {
    return null;
  }
  const title = row.title.trim();
  if (!title || !isDateString(row.date)) {
    return null;
  }
  return {
    id: row.id,
    title: title.slice(0, PERSONAL_CALENDAR_TITLE_MAX),
    date: row.date,
    done: row.done === true,
    createdAt:
      typeof row.createdAt === 'number' && Number.isFinite(row.createdAt)
        ? row.createdAt
        : Date.now(),
  };
}

export function readPersonalCalendarEvents(
  userId: string | null | undefined
): PersonalCalendarEvent[] {
  if (!userId) {
    return [];
  }
  const raw = getLocalStorageJson(storageKey(userId));
  if (!Array.isArray(raw)) {
    return [];
  }
  const events: PersonalCalendarEvent[] = [];
  for (const entry of raw) {
    const event = normalizeEvent(entry);
    if (event) {
      events.push(event);
    }
    if (events.length >= PERSONAL_CALENDAR_EVENTS_MAX) {
      break;
    }
  }
  return events;
}

export function writePersonalCalendarEvents(
  userId: string | null | undefined,
  events: readonly PersonalCalendarEvent[]
): void {
  if (!userId) {
    return;
  }
  setLocalStorageJson(
    storageKey(userId),
    events.slice(0, PERSONAL_CALENDAR_EVENTS_MAX).map((event) => ({
      id: event.id,
      title: event.title,
      date: event.date,
      done: event.done,
      createdAt: event.createdAt,
    }))
  );
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event(PERSONAL_CALENDAR_CHANGED_EVENT));
  }
}

export function addPersonalCalendarEvent(
  events: readonly PersonalCalendarEvent[],
  title: string,
  date: string
): PersonalCalendarEvent[] {
  const trimmed = title.trim().slice(0, PERSONAL_CALENDAR_TITLE_MAX);
  if (
    !trimmed ||
    !isDateString(date) ||
    events.length >= PERSONAL_CALENDAR_EVENTS_MAX
  ) {
    return [...events];
  }
  return [
    ...events,
    {
      id: newEventId(),
      title: trimmed,
      date,
      done: false,
      createdAt: Date.now(),
    },
  ];
}

export function togglePersonalCalendarEvent(
  events: readonly PersonalCalendarEvent[],
  id: string
): PersonalCalendarEvent[] {
  return events.map((event) =>
    event.id === id ? { ...event, done: !event.done } : event
  );
}

export function removePersonalCalendarEvent(
  events: readonly PersonalCalendarEvent[],
  id: string
): PersonalCalendarEvent[] {
  return events.filter((event) => event.id !== id);
}

export function movePersonalCalendarEvent(
  events: readonly PersonalCalendarEvent[],
  id: string,
  date: string
): PersonalCalendarEvent[] {
  if (!isDateString(date)) {
    return [...events];
  }
  return events.map((event) => (event.id === id ? { ...event, date } : event));
}

export function listPersonalCalendarEventsForDate(
  events: readonly PersonalCalendarEvent[],
  date: string
): PersonalCalendarEvent[] {
  return events
    .filter((event) => event.date === date)
    .slice()
    .sort((a, b) => a.createdAt - b.createdAt);
}

/** Same Active / Done / All filters as Focus. */
export type PersonalCalendarEventFilter = 'all' | 'active' | 'done';

export function filterPersonalCalendarEvents(
  events: readonly PersonalCalendarEvent[],
  filter: PersonalCalendarEventFilter
): PersonalCalendarEvent[] {
  if (filter === 'active') {
    return events.filter((event) => !event.done);
  }
  if (filter === 'done') {
    return events.filter((event) => event.done);
  }
  return [...events];
}

export function groupPersonalCalendarEventsByDate(
  events: readonly PersonalCalendarEvent[]
): Readonly<Record<string, PersonalCalendarEvent[]>> {
  const grouped: Record<string, PersonalCalendarEvent[]> = {};
  for (const event of events) {
    const bucket = grouped[event.date] ?? [];
    bucket.push(event);
    grouped[event.date] = bucket;
  }
  for (const date of Object.keys(grouped)) {
    grouped[date] = (grouped[date] ?? [])
      .slice()
      .sort((a, b) => a.createdAt - b.createdAt);
  }
  return grouped;
}

/** Focus tod0 id reserved for a personal calendar event. */
export function focusTodoIdForCalendarEvent(eventId: string): string {
  return `cal:${eventId}`;
}

export function isCalendarLinkedFocusTodoId(id: string): boolean {
  return id.startsWith('cal:');
}

/** Calendar event id for a Focus row (`cal:<eventId>` → `<eventId>`). */
export function calendarEventIdForFocusTodo(focusTodoId: string): string {
  if (isCalendarLinkedFocusTodoId(focusTodoId)) {
    return focusTodoId.slice('cal:'.length);
  }
  return focusTodoId;
}

export function personalCalendarEventsFingerprint(
  events: readonly PersonalCalendarEvent[]
): string {
  return events
    .map(
      (event) =>
        `${event.id}\0${event.date}\0${event.done ? 1 : 0}\0${event.title}`
    )
    .join('\n');
}

function findFocusTodoIndexForEvent(
  todos: readonly FocusTodo[],
  eventId: string
): number {
  const linkedId = focusTodoIdForCalendarEvent(eventId);
  return todos.findIndex((todo) => todo.id === eventId || todo.id === linkedId);
}

/** Drop Focus rows tied to a calendar event (same id or `cal:` link). */
export function removeFocusTodosForCalendarEvent(
  todos: readonly FocusTodo[],
  eventId: string
): FocusTodo[] {
  const linkedId = focusTodoIdForCalendarEvent(eventId);
  return todos.filter((todo) => todo.id !== eventId && todo.id !== linkedId);
}

/** Drop calendar rows for removed Focus todos. */
export function removeCalendarEventsForFocusTodos(
  events: readonly PersonalCalendarEvent[],
  focusTodoIds: readonly string[]
): PersonalCalendarEvent[] {
  const removeIds = new Set(
    focusTodoIds.map((id) => calendarEventIdForFocusTodo(id))
  );
  return events.filter((event) => !removeIds.has(event.id));
}

/**
 * Pull today's calendar tasks into Focus (add / mirror title+done).
 * Drops orphaned `cal:` rows when their event is gone.
 */
export function syncFocusTodosFromTodayCalendar(
  todos: readonly FocusTodo[],
  events: readonly PersonalCalendarEvent[],
  todayDateString: string = toLocalYYYYMMDD(new Date())
): FocusTodo[] {
  const todayEvents = listPersonalCalendarEventsForDate(
    events,
    todayDateString
  );
  const eventIds = new Set(events.map((event) => event.id));

  let next = todos.filter((todo) => {
    if (!isCalendarLinkedFocusTodoId(todo.id)) {
      return true;
    }
    return eventIds.has(calendarEventIdForFocusTodo(todo.id));
  });

  for (const event of todayEvents) {
    const index = findFocusTodoIndexForEvent(next, event.id);
    if (index >= 0) {
      const current = next[index]!;
      if (current.text === event.title && current.done === event.done) {
        continue;
      }
      next = next.map((todo, todoIndex) =>
        todoIndex === index
          ? { ...todo, text: event.title, done: event.done }
          : todo
      );
      continue;
    }
    if (event.done || next.length >= FOCUS_TODOS_MAX) {
      continue;
    }
    next = [
      ...next,
      {
        id: focusTodoIdForCalendarEvent(event.id),
        text: event.title,
        done: false,
        createdAt: event.createdAt,
      },
    ];
  }
  return next;
}

/**
 * Upsert today's calendar rows from Focus (title + done). Other dates stay put.
 */
export function syncTodayCalendarFromFocusTodos(
  events: readonly PersonalCalendarEvent[],
  todos: readonly FocusTodo[],
  todayDateString: string = toLocalYYYYMMDD(new Date())
): PersonalCalendarEvent[] {
  const byId = new Map(events.map((event) => [event.id, event] as const));

  for (const todo of todos) {
    const eventId = calendarEventIdForFocusTodo(todo.id);
    const title = todo.text.trim().slice(0, PERSONAL_CALENDAR_TITLE_MAX);
    if (!title) {
      continue;
    }
    const existing = byId.get(eventId);
    if (existing) {
      byId.set(eventId, {
        ...existing,
        title,
        done: todo.done,
        date: todayDateString,
      });
      continue;
    }
    if (byId.size >= PERSONAL_CALENDAR_EVENTS_MAX) {
      break;
    }
    byId.set(eventId, {
      id: eventId,
      title,
      date: todayDateString,
      done: todo.done,
      createdAt: todo.createdAt,
    });
  }

  return Array.from(byId.values()).slice(0, PERSONAL_CALENDAR_EVENTS_MAX);
}

/**
 * Two-way reconcile for today. Call after either widget mutates.
 */
export function reconcileTodayFocusAndCalendar(
  todos: readonly FocusTodo[],
  events: readonly PersonalCalendarEvent[],
  todayDateString: string = toLocalYYYYMMDD(new Date())
): {
  readonly todos: FocusTodo[];
  readonly events: PersonalCalendarEvent[];
} {
  const syncedTodos = syncFocusTodosFromTodayCalendar(
    todos,
    events,
    todayDateString
  );
  const syncedEvents = syncTodayCalendarFromFocusTodos(
    events,
    syncedTodos,
    todayDateString
  );
  return { todos: syncedTodos, events: syncedEvents };
}

export function shouldWriteFocusTodos(
  previous: readonly FocusTodo[],
  next: readonly FocusTodo[]
): boolean {
  return focusTodosFingerprint(previous) !== focusTodosFingerprint(next);
}

export function shouldWritePersonalCalendarEvents(
  previous: readonly PersonalCalendarEvent[],
  next: readonly PersonalCalendarEvent[]
): boolean {
  return (
    personalCalendarEventsFingerprint(previous) !==
    personalCalendarEventsFingerprint(next)
  );
}

/**
 * When a Focus tod0 linked to the calendar is toggled, mirror done onto the event.
 * Prefer `syncTodayCalendarFromFocusTodos` for full two-way updates.
 */
export function mirrorFocusToggleOntoCalendar(
  events: readonly PersonalCalendarEvent[],
  focusTodoId: string,
  done: boolean
): PersonalCalendarEvent[] {
  const eventId = calendarEventIdForFocusTodo(focusTodoId);
  return events.map((event) =>
    event.id === eventId ? { ...event, done } : event
  );
}
