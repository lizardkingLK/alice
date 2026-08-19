import { getProjectList } from '@/app/projects/_services/projects.service.server';
import { getWorkItems } from '@/app/work-items/_services/workItem.service.server';
import { getUserList } from '@/app/users/_services/users.service.server';

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
