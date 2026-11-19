import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { NotesWorkspace } from '@/app/notes/_components/notes-workspace';
import {
  NOTES_SIDEBAR_COOKIE_NAME,
  resolveNotesSidebarOpen,
} from '@/app/notes/_helpers/notes-sidebar-storage';
import { getDbUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';

export default async function NotesPage() {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const store = await cookies();
  const initialSidebarOpen = resolveNotesSidebarOpen(
    store.get(NOTES_SIDEBAR_COOKIE_NAME)?.value
  );

  return (
    <DashboardShell
      stickyHeader
      contentScrollable={false}
      contentClassName="flex min-h-0 flex-1 flex-col overflow-hidden p-0"
    >
      <NotesWorkspace
        userId={dbUser.id}
        initialSidebarOpen={initialSidebarOpen}
      />
    </DashboardShell>
  );
}
