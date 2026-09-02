import { describe, expect, it } from 'vitest';
import {
  filterDocsByRole,
  isDocsEntryVisibleForRole,
} from '@/lib/docs/docs-role-filter';
import {
  applyDocsPublishEnrichment,
  buildDocsIndexEntry,
} from '@/lib/docs/docs-shared';

describe('docs role filter', () => {
  const memberPage = applyDocsPublishEnrichment(
    buildDocsIndexEntry(
      'user-guide/work-items/create-work-item.md',
      '# Create a work item\n\nSteps.'
    ),
    {
      audience: 'user-guide',
      section: 'Work items',
      topicOrder: 5,
      pageOrder: 1,
      minimumRole: 'member',
    }
  );

  const adminPage = applyDocsPublishEnrichment(
    buildDocsIndexEntry(
      'user-guide/users-and-access/allowlist.md',
      '# Allowlist\n\nAdmin.'
    ),
    {
      audience: 'user-guide',
      section: 'Users & access',
      topicOrder: 3,
      pageOrder: 1,
      minimumRole: 'admin',
    }
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
});
