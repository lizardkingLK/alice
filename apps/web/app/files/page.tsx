import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import UploadFiles from '@/app/files/_components/upload-form';

export default async function UploadPage() {
  return (
    <DashboardShell description="Upload files to be used in attachments.">
      <UploadFiles />
    </DashboardShell>
  );
}
