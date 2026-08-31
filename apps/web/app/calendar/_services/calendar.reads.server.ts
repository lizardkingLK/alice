import { getProjectList } from '@/app/projects/_services/projects.reads.server';
import { getWorkItems } from '@/app/work-items/_services/work-items.reads.server';
import { getUserList } from '@/app/users/_services/users.reads.server';

export async function getCalendarData() {
  const [projects, workItems, users] = await Promise.all([
    getProjectList(),
    getWorkItems(),
    getUserList(),
  ]);

  return {
    projects,
    workItems,
    users,
  };
}
