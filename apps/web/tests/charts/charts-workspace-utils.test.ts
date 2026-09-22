import { describe, expect, it } from 'vitest';
import { parseChartsRegistryTab } from '@/lib/search-params';
import { suggestChartWorkspaceTitle } from '@/app/charts/_helpers/charts-workspace-utils';
import {
  CHARTS_LAST_OPENED_COOKIE,
  clearChartsLastOpenedId,
  readChartsLastOpenedId,
  writeChartsLastOpenedId,
} from '@/app/charts/_helpers/charts-last-opened';

describe('parseChartsRegistryTab', () => {
  it('maps archived; everything else is mine', () => {
    expect(parseChartsRegistryTab('archived')).toBe('archived');
    expect(parseChartsRegistryTab('shared')).toBe('mine');
    expect(parseChartsRegistryTab(null)).toBe('mine');
  });
});

describe('suggestChartWorkspaceTitle', () => {
  it('uses Charts when unused', () => {
    expect(suggestChartWorkspaceTitle([])).toBe('Charts');
    expect(suggestChartWorkspaceTitle(['Other'])).toBe('Charts');
  });

  it('increments when Charts is taken', () => {
    expect(suggestChartWorkspaceTitle(['Charts'])).toBe('Charts (2)');
    expect(suggestChartWorkspaceTitle(['Charts', 'Charts (2)'])).toBe(
      'Charts (3)'
    );
  });
});

describe('charts last-opened cookie', () => {
  const CHART_ID = '22222222-2222-4222-8222-222222222222';

  it('writes and reads a chart id', () => {
    clearChartsLastOpenedId();
    writeChartsLastOpenedId(CHART_ID);
    expect(readChartsLastOpenedId()).toBe(CHART_ID);
    expect(document.cookie).toContain(CHARTS_LAST_OPENED_COOKIE);
  });

  it('rejects non-uuid values', () => {
    clearChartsLastOpenedId();
    writeChartsLastOpenedId('not-a-uuid');
    expect(readChartsLastOpenedId()).toBeNull();
  });
});
