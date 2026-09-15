import { describe, expect, it } from 'vitest';
import {
  buildChartsBreadcrumbOverrides,
  chartsWorkspaceHref,
} from '@/app/charts/_helpers/charts-links';
import { applyRuntimeBreadcrumbLabels } from '@/app/dashboard/_components/dashboard-breadcrumb-runtime';

describe('buildChartsBreadcrumbOverrides', () => {
  it('uses short id until a workspace title is known', () => {
    const id = '9cb8ba7b-15be-4b8b-a0f2-1c7c0b01ac5f';
    expect(buildChartsBreadcrumbOverrides(id)).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Charts', url: '/charts' },
      { label: '9CB8BA7B', url: chartsWorkspaceHref(id) },
    ]);
  });

  it('prefers the workspace title when provided', () => {
    const id = '9cb8ba7b-15be-4b8b-a0f2-1c7c0b01ac5f';
    expect(buildChartsBreadcrumbOverrides(id, 'Charts Newest')).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Charts', url: '/charts' },
      { label: 'Charts Newest', url: chartsWorkspaceHref(id) },
    ]);
  });
});

describe('applyRuntimeBreadcrumbLabels', () => {
  it('replaces matching crumb labels by url', () => {
    const id = '9cb8ba7b-15be-4b8b-a0f2-1c7c0b01ac5f';
    const items = buildChartsBreadcrumbOverrides(id);
    expect(
      applyRuntimeBreadcrumbLabels(items, {
        [chartsWorkspaceHref(id)]: 'Charts Newest',
      }).at(-1)?.label
    ).toBe('Charts Newest');
  });
});
