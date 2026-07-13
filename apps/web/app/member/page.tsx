import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

export default async function MemberDashboard() {
  /** Custom RBAC: load role from application database once implemented. */

  return (
    <DashboardShell
      description="Issues and tasks assigned to you."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'My Work', url: '/member' },
      ]}
    >
      <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Member workspace — content coming soon.
      </div>
    </DashboardShell>
  );
}
