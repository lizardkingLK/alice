import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { DashboardPageMeta } from './dashboard-page-meta';
import { AuthControls } from '../auth/auth-controls';
import { User } from '@supabase/supabase-js';
import { AppHeader } from '../app-header';

type DashboardHeaderProps = {
  title: string;
  description?: string;
  user: User;
};

export function DashboardHeader({
  title,
  description,
  user,
}: Readonly<DashboardHeaderProps>) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <DashboardPageMeta title={title} description={description} />
      <section>
        <AppHeader />
      </section>
      <section>
        <AuthControls email={user?.email} />
      </section>
    </header>
  );
}
