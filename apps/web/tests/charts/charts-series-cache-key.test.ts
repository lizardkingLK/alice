import { describe, expect, it } from 'vitest';
import { chartSeriesCacheKey } from '@/app/charts/_helpers/charts-series-cache-key';

describe('chartSeriesCacheKey', () => {
  it('stable key for project + label + sprint + dimensions', () => {
    expect(
      chartSeriesCacheKey({
        projectId: 'proj-1',
        labelField: 'category',
        sprintId: 'sprint-1',
        dimensionFilters: { status: 'ToDo', type: 'Story' },
      })
    ).toBe('proj-1::category::sprint-1::ToDo|Story||');
  });

  it('uses all when project is null', () => {
    expect(
      chartSeriesCacheKey({ projectId: null, labelField: 'priority' })
    ).toBe('all::priority::::');
  });
});
