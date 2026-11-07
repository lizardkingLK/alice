import { describe, expect, it } from 'vitest';
import {
  buildProjectBreadcrumbOverrides,
  buildProjectShareUrl,
  isProjectUuid,
  looksLikeProjectKey,
  normalizeProjectKey,
  projectDetailHref,
  projectShareHref,
  withProjectSearchParams,
} from '@/app/projects/_helpers/project-links';

describe('project key share helpers', () => {
  it('detects project UUIDs', () => {
    expect(isProjectUuid('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(true);
    expect(isProjectUuid('ABC')).toBe(false);
  });

  it('detects Jira-style project keys', () => {
    expect(looksLikeProjectKey('ABC')).toBe(true);
    expect(looksLikeProjectKey('ab12')).toBe(true);
    expect(looksLikeProjectKey('A')).toBe(false);
    expect(looksLikeProjectKey('TOO-LONG-KEY')).toBe(false);
    expect(looksLikeProjectKey('a1b2c3d4-e5f6-7890-abcd-ef1234567890')).toBe(
      false
    );
  });

  it('normalizes and builds share hrefs', () => {
    expect(normalizeProjectKey(' abc ')).toBe('ABC');
    expect(projectShareHref('abc')).toBe('/projects/ABC');
    expect(buildProjectShareUrl('https://app.example.com/', 'abc')).toBe(
      'https://app.example.com/projects/ABC'
    );
  });

  it('builds canonical detail hrefs from project keys', () => {
    expect(projectDetailHref('abc')).toBe('/projects/ABC');
    expect(projectDetailHref('ABC', 'members')).toBe(
      '/projects/ABC?tab=members'
    );
    expect(projectDetailHref('ABC', 'details')).toBe('/projects/ABC');
  });

  it('passes UUID detail hrefs through for redirect resolution', () => {
    const uuid = 'a1b2c3d4-e5f6-7890-abcd-ef1234567890';
    expect(projectDetailHref(uuid)).toBe(`/projects/${uuid}`);
    expect(projectDetailHref(uuid, 'teams')).toBe(
      `/projects/${uuid}?tab=teams`
    );
  });

  it('builds breadcrumbs with the canonical project path', () => {
    expect(buildProjectBreadcrumbOverrides('abc', 'Alpha')).toEqual([
      { label: 'Dashboard', url: '/dashboard' },
      { label: 'Projects', url: '/projects' },
      { label: 'Alpha', url: '/projects/ABC' },
    ]);
  });

  it('preserves search params when redirecting between project path forms', () => {
    expect(withProjectSearchParams('/projects/ABC', { tab: 'members' })).toBe(
      '/projects/ABC?tab=members'
    );
    expect(withProjectSearchParams('/projects/ABC', {})).toBe('/projects/ABC');
  });
});
