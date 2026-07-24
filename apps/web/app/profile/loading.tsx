import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProfilePageSkeleton } from '@/app/profile/_components/profile-page-skeleton';

export default function ProfileLoading() {
  return (
    <DashboardShell
      description="Your profile and account details."
      sidebarDefaultOpen={false}
      contentClassName="p-0"
    >
      <ProfilePageSkeleton />
    </DashboardShell>
  );
}
