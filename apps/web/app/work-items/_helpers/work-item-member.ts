export type WorkItemMemberLike = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profile_picture?: string | null;
};

export function resolveWorkItemMember(
  members: readonly WorkItemMemberLike[],
  userId: string | null | undefined
): WorkItemMemberLike | null {
  if (!userId) {
    return null;
  }

  const member = members.find((entry) => entry.id === userId);
  if (!member) {
    return null;
  }

  return {
    id: member.id,
    name: member.name,
    email: member.email,
    profile_picture: member.profile_picture ?? null,
  };
}
