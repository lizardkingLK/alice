import { UserButton } from '@clerk/nextjs';
import { SidebarTrigger } from '@repo/ui/components/ui/sidebar';
import { DashboardPageMeta } from './dashboard-page-meta';

type DashboardHeaderProps = {
  title: string;
  description?: string;
};

export function DashboardHeader({ title, description }: DashboardHeaderProps) {
  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <DashboardPageMeta title={title} description={description} />
      <UserButton />
    </header>
  );
}
