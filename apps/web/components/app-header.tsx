import { NotificationInbox } from './notification-inbox';

export function AppHeader() {
  return (
    <header className="flex items-center justify-between p-4">
      <NotificationInbox />
    </header>
  );
}
