import { createCalendarService } from './calendar.service.base';

const service = createCalendarService();

export const getCalendarConfig = service.getCalendarConfig;
