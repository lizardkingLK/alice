import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { DashboardPageMeta } from './dashboard-page-meta';
import { User } from '@supabase/supabase-js';
import { AuthControls } from '@/app/dashboard/_components/dashboard-auth';
import { NotificationInbox } from '@/app/dashboard/_components/dashboard-notifications';

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
        <NotificationInbox />
      </section>
      <section>
        <AuthControls email={user?.email} meta={user?.user_metadata} />
      </section>
    </header>
  );
}
