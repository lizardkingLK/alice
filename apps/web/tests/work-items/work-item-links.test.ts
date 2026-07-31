import { describe, it, expect } from 'vitest';
import { buildWorkItemBreadcrumbOverrides } from '@/app/work-items/_helpers/work-item-links';
import { toShortId } from '@/app/_shared/utility';

describe('buildWorkItemBreadcrumbOverrides', () => {
  const workItemId = '9bcd6c86-aaaa-4bbb-8ccc-dddddddddddd';
  const projectId = 'e60c61c4-1111-4222-a333-444444444444';

  it('always builds a project-scoped trail when projectId is a UUID', () => {
    // Arrange / Act
    const crumbs = buildWorkItemBreadcrumbOverrides(workItemId, projectId);

    // Assert
    expect(crumbs).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      {
        label: toShortId(projectId),
        url: `/projects/${projectId}`,
      },
      {
        label: 'Work Items',
        url: `/projects/${projectId}?tab=work-items`,
      },
      {
        label: toShortId(workItemId),
        url: `/work-items/${workItemId}`,
      },
    ]);
  });

  it('falls back to Work Items list when projectId is missing', () => {
    // Arrange / Act
    const crumbs = buildWorkItemBreadcrumbOverrides(workItemId, null);

    // Assert
    expect(crumbs).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Work Items', url: '/work-items' },
      {
        label: toShortId(workItemId),
        url: `/work-items/${workItemId}`,
      },
    ]);
  });
});
