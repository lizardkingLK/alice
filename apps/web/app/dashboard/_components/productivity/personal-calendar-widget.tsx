'use client';

import {
  useEffect,
  useMemo,
  useState,
  type Dispatch,
  type SetStateAction,
} from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Input } from '@repo/ui/components/ui/input';
import { Tabs, TabsList, TabsTrigger } from '@repo/ui/components/ui/tabs';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Star,
  Trash2,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { toLocalYYYYMMDD } from '@/app/_shared/utility';
import {
  DAYS_OF_WEEK,
  MONTHS,
} from '@/app/calendar/_components/calendar-constants';
import { buildCalendarDays } from '@/app/calendar/_components/calendar-utils';
import { UNDERLINE_TAB_TRIGGER_CLASS } from '@/components/underline-tab-trigger';
import { DashboardWidgetShell } from '@/app/dashboard/_components/dashboard-widget-shell';
import {
  FOCUS_TODOS_CHANGED_EVENT,
  readFocusTodos,
  writeFocusTodos,
} from '@/app/dashboard/_helpers/focus-todos';
import {
  addPersonalCalendarEvent,
  filterPersonalCalendarEvents,
  groupPersonalCalendarEventsByDate,
  listPersonalCalendarEventsForDate,
  PERSONAL_CALENDAR_CHANGED_EVENT,
  PERSONAL_CALENDAR_EVENTS_MAX,
  PERSONAL_CALENDAR_TITLE_MAX,
  readPersonalCalendarEvents,
  reconcileTodayFocusAndCalendar,
  removeFocusTodosForCalendarEvent,
  removePersonalCalendarEvent,
  shouldWriteFocusTodos,
  shouldWritePersonalCalendarEvents,
  togglePersonalCalendarEvent,
  writePersonalCalendarEvents,
  type PersonalCalendarEvent,
  type PersonalCalendarEventFilter,
} from '@/app/dashboard/_helpers/personal-calendar';

const CALENDAR_EVENT_FILTERS: readonly {
  readonly id: PersonalCalendarEventFilter;
  readonly label: string;
}[] = [
  { id: 'active', label: 'Active' },
  { id: 'done', label: 'Done' },
  { id: 'all', label: 'All' },
];

type PersonalCalendarWidgetProps = {
  readonly userId: string;
  /**
   * When true, render only the calendar body (Focus widget embeds this pane).
   */
  readonly embedded?: boolean;
};

function personalCalendarEmptyMessage(
  selectedCount: number,
  filter: PersonalCalendarEventFilter
): string {
  if (selectedCount === 0) {
    return 'No personal tasks on this day.';
  }
  if (filter === 'done') {
    return 'No completed tasks.';
  }
  if (filter === 'active') {
    return 'No active tasks.';
  }
  return 'No tasks.';
}

type CalendarInteractionsProps = {
  readonly selectedDate: string;
  readonly eventFilter: PersonalCalendarEventFilter;
  readonly onEventFilterChange: Dispatch<
    SetStateAction<PersonalCalendarEventFilter>
  >;
  readonly selectedEvents: readonly PersonalCalendarEvent[];
  readonly visibleEvents: readonly PersonalCalendarEvent[];
  readonly events: readonly PersonalCalendarEvent[];
  readonly draft: string;
  readonly onDraftChange: Dispatch<SetStateAction<string>>;
  readonly onPersist: (
    // eslint-disable-next-line no-unused-vars -- persist callback
    next: PersonalCalendarEvent[],
    // eslint-disable-next-line no-unused-vars -- persist callback
    removedEventId?: string
  ) => void;
  readonly onSubmitEvent: () => void;
};

function CalendarInteractions({
  selectedDate,
  eventFilter,
  onEventFilterChange,
  selectedEvents,
  visibleEvents,
  events,
  draft,
  onDraftChange,
  onPersist,
  onSubmitEvent,
}: Readonly<CalendarInteractionsProps>) {
  const showEmpty = selectedEvents.length === 0 || visibleEvents.length === 0;
  const atCapacity = events.length >= PERSONAL_CALENDAR_EVENTS_MAX;

  let listBody = (
    <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-y-auto pr-0.5">
      {visibleEvents.map((event) => (
        <li
          key={event.id}
          className="border-border/60 bg-background/40 flex items-center gap-2 rounded-md border px-2 py-2"
        >
          <Checkbox
            checked={event.done}
            onCheckedChange={() =>
              onPersist(togglePersonalCalendarEvent(events, event.id))
            }
            aria-label={
              event.done
                ? `Mark "${event.title}" as not done`
                : `Mark "${event.title}" as done`
            }
          />
          <TruncatedText
            className={cn(
              'min-w-0 flex-1 text-sm',
              event.done && 'text-muted-foreground line-through'
            )}
          >
            {event.title}
          </TruncatedText>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="text-muted-foreground hover:text-foreground size-8 shrink-0 cursor-pointer"
            aria-label={`Delete "${event.title}"`}
            onClick={() =>
              onPersist(removePersonalCalendarEvent(events, event.id), event.id)
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        </li>
      ))}
    </ul>
  );

  if (showEmpty) {
    listBody = (
      <p className="text-muted-foreground flex min-h-0 flex-1 items-center justify-center text-center text-xs">
        {personalCalendarEmptyMessage(selectedEvents.length, eventFilter)}
      </p>
    );
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <div className="flex shrink-0 items-center justify-between gap-2">
        <p className="text-muted-foreground min-w-0 text-xs tabular-nums">
          {selectedDate}
        </p>
        <Tabs
          value={eventFilter}
          onValueChange={(value) =>
            onEventFilterChange(value as PersonalCalendarEventFilter)
          }
          className="w-auto"
        >
          <TabsList
            aria-label="Task filter"
            className="border-border flex h-auto justify-end gap-3 rounded-none border-b bg-transparent p-0"
          >
            {CALENDAR_EVENT_FILTERS.map((filter) => (
              <TabsTrigger
                key={filter.id}
                value={filter.id}
                className={cn(UNDERLINE_TAB_TRIGGER_CLASS, 'px-0 text-xs')}
              >
                {filter.label}
              </TabsTrigger>
            ))}
          </TabsList>
        </Tabs>
      </div>

      {listBody}

      <form
        className="mt-auto flex shrink-0 gap-2 p-0.5 pt-1"
        onSubmit={(event) => {
          event.preventDefault();
          onSubmitEvent();
        }}
      >
        <Input
          value={draft}
          onChange={(event) => onDraftChange(event.target.value)}
          placeholder="Add a personal task…"
          aria-label="New personal calendar task"
          className="h-9"
          maxLength={PERSONAL_CALENDAR_TITLE_MAX}
          disabled={atCapacity}
        />
        <Button
          type="submit"
          size="sm"
          className="h-9 shrink-0 cursor-pointer"
          disabled={!draft.trim() || atCapacity}
        >
          Add
        </Button>
      </form>
    </div>
  );
}

export function PersonalCalendarWidget({
  userId,
  embedded = false,
}: Readonly<PersonalCalendarWidgetProps>) {
  const today = toLocalYYYYMMDD(new Date());
  const [cursor, setCursor] = useState(() => {
    const now = new Date();
    return { year: now.getFullYear(), month: now.getMonth() };
  });
  const [selectedDate, setSelectedDate] = useState(today);
  const [events, setEvents] = useState<PersonalCalendarEvent[]>([]);
  const [eventFilter, setEventFilter] =
    useState<PersonalCalendarEventFilter>('active');
  const [draft, setDraft] = useState('');
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    const existingEvents = readPersonalCalendarEvents(userId);
    const existingTodos = readFocusTodos(userId);
    const reconciled = reconcileTodayFocusAndCalendar(
      existingTodos,
      existingEvents
    );
    setEvents(reconciled.events);
    if (shouldWritePersonalCalendarEvents(existingEvents, reconciled.events)) {
      writePersonalCalendarEvents(userId, reconciled.events);
    }
    if (shouldWriteFocusTodos(existingTodos, reconciled.todos)) {
      writeFocusTodos(userId, reconciled.todos);
    }
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    const onChanged = () => {
      setEvents(readPersonalCalendarEvents(userId));
    };
    window.addEventListener(PERSONAL_CALENDAR_CHANGED_EVENT, onChanged);
    window.addEventListener(FOCUS_TODOS_CHANGED_EVENT, onChanged);
    return () => {
      window.removeEventListener(PERSONAL_CALENDAR_CHANGED_EVENT, onChanged);
      window.removeEventListener(FOCUS_TODOS_CHANGED_EVENT, onChanged);
    };
  }, [userId]);

  const persist = (next: PersonalCalendarEvent[], removedEventId?: string) => {
    setEvents(next);
    if (!hydrated) {
      return;
    }

    // On delete: drop the Focus twin first. Writing calendar first lets Focus
    // reconcile and recreate the event from the still-present tod0.
    if (removedEventId) {
      const todos = removeFocusTodosForCalendarEvent(
        readFocusTodos(userId),
        removedEventId
      );
      writeFocusTodos(userId, todos);
      writePersonalCalendarEvents(userId, next);
      return;
    }

    writePersonalCalendarEvents(userId, next);
    const todos = readFocusTodos(userId);
    const reconciled = reconcileTodayFocusAndCalendar(todos, next);
    if (shouldWriteFocusTodos(todos, reconciled.todos)) {
      writeFocusTodos(userId, reconciled.todos);
    }
    if (shouldWritePersonalCalendarEvents(next, reconciled.events)) {
      setEvents(reconciled.events);
      writePersonalCalendarEvents(userId, reconciled.events);
    }
  };

  const calendarDays = useMemo(
    () => buildCalendarDays(cursor.year, cursor.month, today),
    [cursor.month, cursor.year, today]
  );
  const eventsByDate = useMemo(
    () => groupPersonalCalendarEventsByDate(events),
    [events]
  );
  const selectedEvents = useMemo(
    () => listPersonalCalendarEventsForDate(events, selectedDate),
    [events, selectedDate]
  );
  const visibleEvents = useMemo(
    () => filterPersonalCalendarEvents(selectedEvents, eventFilter),
    [eventFilter, selectedEvents]
  );

  const shiftMonth = (delta: number) => {
    setCursor((previous) => {
      const date = new Date(previous.year, previous.month + delta, 1);
      return { year: date.getFullYear(), month: date.getMonth() };
    });
  };

  const goToToday = () => {
    const now = new Date();
    setCursor({ year: now.getFullYear(), month: now.getMonth() });
    setSelectedDate(toLocalYYYYMMDD(now));
  };

  const viewingToday =
    selectedDate === today &&
    `${cursor.year}-${String(cursor.month + 1).padStart(2, '0')}` ===
      today.slice(0, 7);

  const submitEvent = () => {
    const next = addPersonalCalendarEvent(events, draft, selectedDate);
    if (next.length === events.length) {
      return;
    }
    persist(next);
    setDraft('');
  };

  const calendarHeader = (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer"
        aria-label="Previous month"
        onClick={() => shiftMonth(-1)}
      >
        <ChevronLeft className="size-4" />
      </Button>
      <p className="min-w-0 flex-1 text-center text-sm font-medium tabular-nums">
        {MONTHS[cursor.month]} {cursor.year}
      </p>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="cursor-pointer"
        aria-label="Next month"
        onClick={() => shiftMonth(1)}
      >
        <ChevronRight className="size-4" />
      </Button>
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            className="cursor-pointer"
            aria-label="Go to today"
            disabled={viewingToday}
            onClick={goToToday}
          >
            <CalendarDays className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Today</TooltipContent>
      </Tooltip>
    </div>
  );

  const calendarContent = (
    <div className="border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-lg border">
      <div className="bg-muted/60 grid shrink-0 grid-cols-7 border-b">
        {DAYS_OF_WEEK.map((day) => (
          <div
            key={day}
            className="text-muted-foreground py-1 text-center text-[10px] font-semibold tracking-wide uppercase"
          >
            {day}
          </div>
        ))}
      </div>
      <div className="bg-border grid min-h-48 flex-1 grid-cols-7 grid-rows-6 gap-px">
        {calendarDays.map((day) => {
          const dayEvents = eventsByDate[day.dateString] ?? [];
          const incomplete = dayEvents.filter((event) => !event.done).length;
          const selected = selectedDate === day.dateString;
          const count = incomplete > 0 ? incomplete : dayEvents.length;
          const showOverflowStar = count > 9;
          let todayButtonLabel = day.dateString;
          if (dayEvents.length > 0) {
            todayButtonLabel = `${day.dateString}, ${dayEvents.length} task${dayEvents.length === 1 ? '' : 's'}`;
          }

          return (
            <button
              key={day.dateString}
              type="button"
              className={cn(
                'bg-card hover:bg-muted/50 relative flex min-h-0 flex-col items-center p-1 text-center',
                !day.isCurrentMonth && 'bg-muted/30 text-muted-foreground',
                day.isToday && 'ring-primary/40 ring-1 ring-inset',
                selected && 'bg-primary/10'
              )}
              aria-label={todayButtonLabel}
              onClick={() => setSelectedDate(day.dateString)}
            >
              <span
                className={cn(
                  'text-[11px] font-medium tabular-nums',
                  selected && 'text-primary'
                )}
              >
                {day.dayNum}
              </span>
              {count > 0 ? (
                <span
                  className="bg-primary text-primary-foreground absolute right-0.5 bottom-0.5 flex size-3.5 items-center justify-center rounded-full"
                  aria-hidden
                >
                  {showOverflowStar ? (
                    <Star className="size-2 fill-current" />
                  ) : (
                    <span className="text-[8px] leading-none font-semibold tabular-nums">
                      {count}
                    </span>
                  )}
                </span>
              ) : null}
            </button>
          );
        })}
      </div>
    </div>
  );

  const calendarBody = (
    <div className="flex min-h-0 flex-1 flex-col gap-3">
      {calendarHeader}
      {calendarContent}
      <CalendarInteractions
        selectedDate={selectedDate}
        eventFilter={eventFilter}
        onEventFilterChange={setEventFilter}
        selectedEvents={selectedEvents}
        visibleEvents={visibleEvents}
        events={events}
        draft={draft}
        onDraftChange={setDraft}
        onPersist={persist}
        onSubmitEvent={submitEvent}
      />
    </div>
  );

  if (embedded) {
    return calendarBody;
  }

  return (
    <DashboardWidgetShell
      variant="glass"
      title="Calendar"
      description="Personal schedule on this device"
    >
      {calendarBody}
    </DashboardWidgetShell>
  );
}
