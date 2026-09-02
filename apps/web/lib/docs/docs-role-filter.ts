import { roleAtLeast, type AppRole } from '@/lib/rbac/roles';
import {
  DEFAULT_DOCS_MINIMUM_ROLE,
  type DocsIndexEntry,
  type DocsMinimumRole,
} from '@/lib/docs/docs-shared';

export function minimumRoleForDocsEntry(
  entry: DocsIndexEntry
): DocsMinimumRole | null {
  if (entry.audience !== 'user-guide') {
    return null;
  }

  return entry.minimumRole ?? DEFAULT_DOCS_MINIMUM_ROLE;
}

export function isDocsEntryVisibleForRole(
  entry: DocsIndexEntry,
  userRole: AppRole | null | undefined
): boolean {
  const minimum = minimumRoleForDocsEntry(entry);
  if (minimum == null) {
    return true;
  }

  return roleAtLeast(userRole, minimum);
}

export function filterDocsByRole(
  entries: readonly DocsIndexEntry[],
  userRole: AppRole | null | undefined
): DocsIndexEntry[] {
  return entries.filter((entry) => isDocsEntryVisibleForRole(entry, userRole));
}
