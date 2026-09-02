import { describe, expect, it } from 'vitest';
import {
  filterDocsByRole,
  filterDocsForViewer,
  isDocsEntryVisibleForRole,
} from '@/lib/docs/docs-role-filter';
import { buildDocsIndexEntry } from '@/lib/docs/docs-shared';
import {
  adminUserGuideEnrichment,
  memberUserGuideEnrichment,
  userGuideTestEntry,
} from '@/tests/docs/docs-test-helpers';

describe('docs role filter', () => {
  const memberPage = userGuideTestEntry(
    'user-guide/work-items/create-work-item.md',
    '# Create a work item\n\nSteps.',
    memberUserGuideEnrichment('Work items', 5, 1)
  );

  const adminPage = userGuideTestEntry(
    'user-guide/users-and-access/allowlist.md',
    '# Allowlist\n\nAdmin.',
    adminUserGuideEnrichment('Users & access', 3, 1)
  );

  const devPage = buildDocsIndexEntry('guides/SONAR.md', '# Sonar\n\nQuality.');

  it('allows dev docs regardless of role', () => {
    expect(isDocsEntryVisibleForRole(devPage, 'member')).toBe(true);
    expect(isDocsEntryVisibleForRole(devPage, null)).toBe(true);
  });

  it('inherits role hierarchy for user-guide pages', () => {
    expect(isDocsEntryVisibleForRole(memberPage, 'member')).toBe(true);
    expect(isDocsEntryVisibleForRole(adminPage, 'member')).toBe(false);
    expect(isDocsEntryVisibleForRole(adminPage, 'manager')).toBe(false);
    expect(isDocsEntryVisibleForRole(adminPage, 'admin')).toBe(true);
    expect(isDocsEntryVisibleForRole(adminPage, null)).toBe(false);
  });

  it('filters a mixed index by role', () => {
    const filtered = filterDocsByRole(
      [memberPage, adminPage, devPage],
      'manager'
    );
    expect(filtered.map((entry) => entry.slug)).toEqual([
      'user-guide/work-items/create-work-item',
      'guides/SONAR',
    ]);
  });

  it('applies env visibility before role filtering', () => {
    const filtered = filterDocsForViewer([memberPage, adminPage, devPage], {
      includeDevDocs: false,
      userRole: 'admin',
    });
    expect(filtered.map((entry) => entry.slug)).toEqual([
      'user-guide/work-items/create-work-item',
      'user-guide/users-and-access/allowlist',
    ]);
  });
});
