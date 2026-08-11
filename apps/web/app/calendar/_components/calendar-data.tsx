import { getCalendarData } from '@/app/calendar/_services/calendar.service.server';
import { CalendarRegistry } from './calendar-registry';

export async function CalendarData() {
  const data = await getCalendarData();

  return (
    <CalendarRegistry
      projects={data.projects}
      workItems={data.workItems}
      users={data.users}
    />
  );
}
