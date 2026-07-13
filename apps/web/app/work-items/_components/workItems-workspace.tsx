import { DbProject } from '@/app/projects/_services/projects.service';
import { DbUser } from '@/app/users/_services/users.service';
import WorkItemsTable from '@/app/work-items/_components/workItems-table';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';

export interface WorkItemWorkspaceProps {
  projects: DbProject[];
  projectMembers: DbUser[];
  initialWorkItems: DbWorkItem[];
}

export default function WorkItemsWorkspace(
  props: Readonly<WorkItemWorkspaceProps>
) {
  return (
    <div className="w-full">
      <WorkItemsTable {...props} />
    </div>
  );
}
