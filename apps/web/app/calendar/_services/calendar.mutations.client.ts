import { createCalendarService } from './calendar.mutations.shared';

const calendarService = createCalendarService();

export const getCalendarConfig = calendarService.getCalendarConfig;
