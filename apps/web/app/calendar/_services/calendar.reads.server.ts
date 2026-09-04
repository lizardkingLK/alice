import { getUserList } from '@/app/users/_services/users.reads.server';
import { getWorkItems } from '@/app/work-items/_services/work-items.reads.server';
import { getDbUser } from '@/lib/auth';
import { getAccessibleProjectList } from '@/lib/projects/accessible-project-list';
import { listAccessibleProjectIds } from '@/lib/projects/project-workspace-access';

export async function getCalendarData() {
  const dbUser = await getDbUser();
  const accessibleIds = dbUser ? await listAccessibleProjectIds(dbUser.id) : [];

  const [projects, workItems, users] = await Promise.all([
    dbUser ? getAccessibleProjectList(dbUser.id) : Promise.resolve([]),
    accessibleIds.length === 0
      ? Promise.resolve([])
      : getWorkItems({ projectIds: accessibleIds }),
    getUserList(),
  ]);

  return {
    projects,
    workItems,
    users,
  };
}
