import { describe, expect, it } from 'vitest';
import {
  buildGlobalFilterHref,
  projectKeyForId,
  sprintSlugForId,
} from '@/app/board/_helpers/global-filter-href';

describe('buildGlobalFilterHref', () => {
  it('builds board root and project/sprint path masks', () => {
    expect(buildGlobalFilterHref({ area: 'board' })).toBe('/board');
    expect(buildGlobalFilterHref({ area: 'board', projectKey: 'SCRUM' })).toBe(
      '/board/projects/SCRUM'
    );
    expect(
      buildGlobalFilterHref({
        area: 'board',
        projectKey: 'SCRUM',
        sprintSlug: 'sprint-1',
      })
    ).toBe('/board/projects/SCRUM/sprints/sprint-1');
  });

  it('keeps non-entity query params', () => {
    const params = new URLSearchParams('tab=calendar&labels=bug');
    params.set('project', 'uuid-should-strip');
    expect(
      buildGlobalFilterHref({
        area: 'board',
        projectKey: 'SCRUM',
        searchParams: params,
      })
    ).toBe('/board/projects/SCRUM?tab=calendar&labels=bug');
  });

  it('builds backlog and member project paths', () => {
    expect(
      buildGlobalFilterHref({ area: 'backlog', projectKey: 'SCRUM' })
    ).toBe('/backlog/projects/SCRUM');
    expect(buildGlobalFilterHref({ area: 'member', projectKey: 'SCRUM' })).toBe(
      '/member/projects/SCRUM'
    );
  });

  it('builds work-items project and sprint path masks', () => {
    expect(buildGlobalFilterHref({ area: 'work-items' })).toBe('/work-items');
    expect(
      buildGlobalFilterHref({ area: 'work-items', projectKey: 'MS' })
    ).toBe('/work-items/projects/MS');
    expect(
      buildGlobalFilterHref({
        area: 'work-items',
        projectKey: 'MS',
        sprintSlug: 'sprint-1',
      })
    ).toBe('/work-items/projects/MS/sprints/sprint-1');
  });
});

describe('projectKeyForId / sprintSlugForId', () => {
  it('resolves keys and slugs from collections', () => {
    expect(projectKeyForId([{ id: 'p1', key: 'SCRUM' }], 'p1')).toBe('SCRUM');
    expect(projectKeyForId([{ id: 'p1', key: 'SCRUM' }], 'missing')).toBeNull();
    expect(sprintSlugForId([{ id: 's1', slug: 'sprint-1' }], 's1')).toBe(
      'sprint-1'
    );
  });
});
