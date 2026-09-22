import type { ProjectMembersByProjectId } from '@/app/projects/_services/projects.mutations.shared';
import type { WorkItemMemberLike } from '@/app/work-items/_helpers/work-item-member';

/**
 * Flatten a project→members map into a unique member list (union across
 * projects the viewer can access).
 */
export function unionProjectMembers(
  membersByProjectId: ProjectMembersByProjectId
): WorkItemMemberLike[] {
  const byId = new Map<string, WorkItemMemberLike>();

  for (const members of Object.values(membersByProjectId)) {
    for (const row of members) {
      const user = row.user;
      if (!user || byId.has(user.id)) {
        continue;
      }
      byId.set(user.id, {
        id: user.id,
        name: user.name,
        email: user.email,
        profile_picture: user.profile_picture ?? null,
      });
    }
  }

  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name));
}

/**
 * Assignee options for work-item filters:
 * - When a project is selected (filter / locked / draft), use that project's
 *   members.
 * - Otherwise use the union of members across accessible projects.
 */
export function resolveAssigneeFilterMembers(options: {
  readonly membersByProjectId: ProjectMembersByProjectId;
  readonly projectId: string | null | undefined;
  readonly allValue?: string;
}): WorkItemMemberLike[] {
  const allValue = options.allValue ?? 'all';
  const projectId = options.projectId?.trim();

  if (projectId && projectId !== allValue) {
    const rows = options.membersByProjectId[projectId] ?? [];
    return rows
      .map((row) => row.user)
      .filter((user): user is NonNullable<typeof user> => Boolean(user))
      .map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        profile_picture: user.profile_picture ?? null,
      }))
      .sort((a, b) => a.name.localeCompare(b.name));
  }

  return unionProjectMembers(options.membersByProjectId);
}
