/**
 * When the workspace role Select should be locked on the edit-user form,
 * and the tooltip copy to show.
 */
export function resolveUserRoleLock(params: {
  readonly isEdit: boolean;
  readonly targetUserId: string | undefined;
  readonly targetRole: string | undefined;
  readonly currentUserId: string | null | undefined;
  readonly activeAdminCount: number;
}): { readonly locked: boolean; readonly reason: string | null } {
  if (!params.isEdit || !params.targetUserId || !params.targetRole) {
    return { locked: false, reason: null };
  }

  const isSelf = params.targetUserId === params.currentUserId;
  const isSoleActiveAdmin =
    params.targetRole === 'admin' && params.activeAdminCount <= 1;

  if (isSelf && isSoleActiveAdmin) {
    return {
      locked: true,
      reason:
        "You can't change your own role while you're the only admin. Promote another admin first.",
    };
  }
  if (isSelf) {
    return {
      locked: true,
      reason: "You can't change your own workspace role. Ask another admin.",
    };
  }
  if (isSoleActiveAdmin) {
    return {
      locked: true,
      reason: 'At least one admin must remain in the workspace.',
    };
  }

  return { locked: false, reason: null };
}
