import { NotificationInbox } from "./notification-inbox";

export function AppHeader() {
  return (
    <header className="flex items-center justify-between border-b px-6 py-4">
      <span className="font-semibold">Alice</span>
      <NotificationInbox />
    </header>
  );
}