import { CalendarData } from '@/app/calendar/_components/calendar-data';
import {
  REGISTRY_PAGES,
  RegistrySuspensePage,
} from '@/components/registry-page-shell';

export default function CalendarPage() {
  return (
    <RegistrySuspensePage meta={REGISTRY_PAGES.calendar}>
      <CalendarData />
    </RegistrySuspensePage>
  );
}
