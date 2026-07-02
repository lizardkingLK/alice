import { DashboardShell } from '@/components/dashboard/dashboard-shell';
import UploadFiles from '@/components/files/upload-form';
import { getUser } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function UploadPage() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <DashboardShell
      title="Files"
      description="Upload files to be used in attachments."
      user={user}
    >
      <UploadFiles />
    </DashboardShell>
  );
}
