import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';

export default async function ManagerDashboard() {
  /** Custom RBAC: load role from application database once implemented. */

  return (
    <DashboardShell
      description="Manage your team's workload and sprints."
      breadcrumbOverrides={[
        { label: 'Dashboard', url: '/dashboard' },
        { label: 'Team', url: '/manager' },
      ]}
    >
      <div className="text-muted-foreground flex h-40 items-center justify-center rounded-lg border border-dashed text-sm">
        Manager workspace — content coming soon.
      </div>
    </DashboardShell>
  );
}
