import { redirect } from 'next/navigation';
import { getUser } from '../../lib/auth';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getAttributes } from '@/app/attributes/_services/attribute.service';
import AttributesTable from '@/app/attributes/_components/attributes-table';

export default async function AttributesDashboard() {
  const user = await getUser();

  if (!user) {
    redirect('/login');
  }

  /** Custom RBAC: load role from application database once implemented. */

  const initialAttributes = await getAttributes();

  return (
    <DashboardShell
      title="Attributes"
      description="Manage Attributes Data."
      user={user}
    >
      <AttributesTable attributes={initialAttributes} />

      {/* <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Attributes Workspace — content coming soon.
      </div> */}
    </DashboardShell>
  );
}
