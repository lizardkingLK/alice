import { describe, expect, it } from 'vitest';
import {
  buildProjectShareUrl,
  isProjectUuid,
  looksLikeProjectKey,
  normalizeProjectKey,
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

  it('preserves search params when redirecting key to uuid', () => {
    expect(
      withProjectSearchParams('/projects/uuid-1', { tab: 'members' })
    ).toBe('/projects/uuid-1?tab=members');
    expect(withProjectSearchParams('/projects/uuid-1', {})).toBe(
      '/projects/uuid-1'
    );
  });
});
