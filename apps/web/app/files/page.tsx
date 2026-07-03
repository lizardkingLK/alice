import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import UploadFiles from '@/app/files/_components/upload-form';
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
