import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { EditProfileData } from '@/app/edit-profile/_components/edit-profile-data';

export default function EditProfilePage() {
  return (
    <DashboardShell
      description="Manage your account details and preferences."
      sidebarDefaultOpen={false}
      contentClassName="p-0"
    >
      <EditProfileData />
    </DashboardShell>
  );
}
