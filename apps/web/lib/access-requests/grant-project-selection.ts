import {
  accessRequestProjectKeysFromValue,
  emailDomainFromAddress,
  normalizeAccessAllowlistDomain,
} from '@repo/types';

export type GrantProjectOption = {
  readonly id: string;
  readonly key: string;
  readonly name: string;
};

export type GrantProjectSelection = {
  readonly projectId: string;
  readonly granted: boolean;
  readonly addMember: boolean;
};

/**
 * Prefill Grant rows from requested keys ∩ accessible projects.
 * Returns omitted keys the admin cannot grant.
 */
export function buildInitialGrantSelections(
  requestedProjectKeys: unknown,
  accessibleProjects: readonly GrantProjectOption[]
): {
  readonly selections: GrantProjectSelection[];
  readonly omittedRequestedKeys: string[];
} {
  const requested = accessRequestProjectKeysFromValue(requestedProjectKeys);
  const byKey = new Map(
    accessibleProjects.map((project) => [
      project.key.trim().toUpperCase(),
      project,
    ])
  );

  const grantedIds = new Set<string>();
  const omittedRequestedKeys: string[] = [];

  for (const key of requested) {
    const project = byKey.get(key);
    if (project) {
      grantedIds.add(project.id);
    } else {
      omittedRequestedKeys.push(key);
    }
  }

  const selections = accessibleProjects.map((project) => {
    const granted = grantedIds.has(project.id);
    return {
      projectId: project.id,
      granted,
      addMember: granted,
    };
  });

  return { selections, omittedRequestedKeys };
}

/**
 * Coupling: Grant on → Member on; Grant off → Member off.
 * Member may be cleared while Grant stays on when `memberLocked` is false
 * (email allowlist ACL path) via {@link applyMemberToggle}.
 */
export function applyGrantToggle(
  selection: GrantProjectSelection,
  granted: boolean
): GrantProjectSelection {
  if (granted) {
    return { ...selection, granted: true, addMember: true };
  }
  return { ...selection, granted: false, addMember: false };
}

export function applyMemberToggle(
  selection: GrantProjectSelection,
  addMember: boolean,
  options?: { readonly memberLocked?: boolean }
): GrantProjectSelection {
  if (options?.memberLocked) {
    return selection;
  }
  if (!selection.granted && addMember) {
    return { ...selection, granted: true, addMember: true };
  }
  return { ...selection, addMember };
}

export function hasCoveringDomainForEmail(
  email: string,
  activeDomainValues: readonly string[]
): boolean {
  const domain = emailDomainFromAddress(email);
  if (!domain || activeDomainValues.length === 0) {
    return false;
  }
  return activeDomainValues.some(
    (value) => normalizeAccessAllowlistDomain(value) === domain
  );
}

export function toGrantPayload(
  selections: readonly GrantProjectSelection[]
): Array<{ projectId: string; addMember: boolean }> {
  return selections
    .filter((row) => row.granted)
    .map((row) => ({
      projectId: row.projectId,
      addMember: row.addMember,
    }));
}
