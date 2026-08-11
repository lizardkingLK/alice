import { createCalendarService } from './calendar.service.base';

const calendarService = createCalendarService();

export const getCalendarConfig = calendarService.getCalendarConfig;
