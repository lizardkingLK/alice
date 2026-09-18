import { describe, expect, it } from 'vitest';
import {
  chartDrilldownQuerySchema,
  chartRollupGroupColumn,
  chartSeriesQuerySchema,
} from '@repo/types';

const PROJECT_ID = '33333333-3333-4333-8333-333333333333';

describe('chart analytics query schemas', () => {
  it('defaults labelField to status', () => {
    const parsed = chartSeriesQuerySchema.parse({ projectId: PROJECT_ID });
    expect(parsed).toEqual({
      projectId: PROJECT_ID,
      labelField: 'status',
    });
  });

  it('maps UI label fields to rollup columns', () => {
    expect(chartRollupGroupColumn('owner')).toBe('assignee_id');
    expect(chartRollupGroupColumn('board')).toBe('project_id');
    expect(chartRollupGroupColumn('status')).toBe('status');
  });

  it('rejects unsupported label fields', () => {
    const result = chartSeriesQuerySchema.safeParse({
      projectId: PROJECT_ID,
      labelField: 'dueDate',
    });
    expect(result.success).toBe(false);
  });

  it('rejects from after to', () => {
    const result = chartSeriesQuerySchema.safeParse({
      projectId: PROJECT_ID,
      from: '2026-02-01',
      to: '2026-01-01',
    });
    expect(result.success).toBe(false);
  });

  it('parses drilldown with empty sliceKey and pagination defaults', () => {
    const parsed = chartDrilldownQuerySchema.parse({
      projectId: PROJECT_ID,
      labelField: 'owner',
      sliceKey: '',
    });
    expect(parsed).toEqual({
      projectId: PROJECT_ID,
      labelField: 'owner',
      sliceKey: '',
      page: 1,
      limit: 20,
    });
  });
});
