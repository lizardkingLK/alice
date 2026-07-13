import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { getWorkItems } from '@/app/work-items/_services/workItem.server.service';
import { getUserList } from '@/app/users/_services/users.service';
import WorkItemsWorkspace from '@/app/work-items/_components/workItems-workspace';
import { getProjectList } from '@/app/projects/_services/projects.service';

export default async function WorkItemsDashboard() {
  /** Custom RBAC: load role from application database once implemented. */

  const projects = await getProjectList();
  const projectMembers = await getUserList();
  const initialWorkItems = await getWorkItems();

  return (
    <DashboardShell description="Manage Work Items.">
      <WorkItemsWorkspace
        projects={projects}
        projectMembers={projectMembers}
        initialWorkItems={initialWorkItems}
      />
    </DashboardShell>
  );
}
