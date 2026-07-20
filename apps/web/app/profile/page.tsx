import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProfileView } from '@/app/profile/_components/profile-view';

export default function ProfilePage() {
  return (
    <DashboardShell
      description="Your profile and account details."
      sidebarDefaultOpen={false}
      contentClassName="p-0"
    >
      <ProfileView />
    </DashboardShell>
  );
}
