'use server';

import {
  getProjectMembers,
  type ProjectMemberWithUser,
} from '@/app/projects/_services/projects.service.server';

/** Server action for client forms — loads members without the Express read hop. */
export async function fetchProjectMembersForForm(
  projectId: string
): Promise<ProjectMemberWithUser[]> {
  const members = await getProjectMembers(projectId);
  return members.filter((member) => member.status === 'active' && member.user);
}
