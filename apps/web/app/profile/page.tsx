import { Suspense } from 'react';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProfileData } from '@/app/profile/_components/profile-data';
import { ProfilePageSkeleton } from '@/app/profile/_components/profile-page-skeleton';

export default function ProfilePage() {
  return (
    <DashboardShell
      description="Your profile and account details."
      sidebarDefaultOpen={false}
      contentClassName="p-0"
    >
      <Suspense fallback={<ProfilePageSkeleton />}>
        <ProfileData />
      </Suspense>
    </DashboardShell>
  );
}
