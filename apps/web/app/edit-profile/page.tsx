import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { EditProfileView } from '@/app/edit-profile/_components/edit-profile-view';

export default function EditProfilePage() {
  return (
    <DashboardShell
      description="Manage your account details and preferences."
      sidebarDefaultOpen={false}
      contentClassName="p-0"
    >
      <EditProfileView />
    </DashboardShell>
  );
}
