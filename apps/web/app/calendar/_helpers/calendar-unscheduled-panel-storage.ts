import { createBooleanLocalPreference } from '@/lib/local-preference/create-boolean-local-preference';

/** Closed by default when no preference is stored. */
const unscheduledPanelPreference = createBooleanLocalPreference({
  storagePrefix: 'alice:calendar-unscheduled-panel-open:v1:',
  defaultValue: false,
});

export const calendarUnscheduledPanelOpenStorageKey =
  unscheduledPanelPreference.storageKey;
export const readCalendarUnscheduledPanelOpen = unscheduledPanelPreference.read;
export const writeCalendarUnscheduledPanelOpen =
  unscheduledPanelPreference.write;
