import { Project as DbProject } from '@/app/projects/_services/projects.service';
import { User as DbUser } from '@/app/users/_services/users.service';
import WorkItemsTable from '@/app/work-items/_components/workItems-table';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';

export interface WorkItemWorkspaceProps {
  projects: DbProject[];
  projectMembers: DbUser[];
  initialWorkItems: DbWorkItem[];
  totalCount: number;
  page: number;
  limit: number;
  totalPages: number;
  search: string;
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
