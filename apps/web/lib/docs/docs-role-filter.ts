import { roleAtLeast, type AppRole } from '@/lib/rbac/roles';
import {
  DEFAULT_DOCS_MINIMUM_ROLE,
  filterDocsByVisibility,
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

export function filterDocsForViewer(
  entries: readonly DocsIndexEntry[],
  options: {
    readonly includeDevDocs: boolean;
    readonly userRole: AppRole | null | undefined;
  }
): DocsIndexEntry[] {
  return filterDocsByRole(
    filterDocsByVisibility(entries, options.includeDevDocs),
    options.userRole
  );
}
