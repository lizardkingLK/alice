import { describe, expect, it } from 'vitest';
import {
  encodeHierarchyFocus,
  parseHierarchyFocus,
} from '@/app/charts/_helpers/charts-hierarchy-focus';
import {
  isNestedDonutWidgetType,
  shouldDigHierarchySlice,
} from '@/app/charts/_helpers/charts-nested-donut-widget';
import { isChartWidgetAvailable } from '@/app/charts/_components/charts-widget-catalog';

const EPIC = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const STORY = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

describe('charts hierarchy focus', () => {
  it('encodes and parses inner / outer focus keys', () => {
    const inner = encodeHierarchyFocus({ ring: 0, sliceKey: EPIC });
    expect(inner).toBe(`h0:${EPIC}`);
    expect(parseHierarchyFocus(inner)).toEqual({ ring: 0, sliceKey: EPIC });

    const outer = encodeHierarchyFocus({
      ring: 1,
      sliceKey: STORY,
      parentKey: EPIC,
    });
    expect(outer).toBe(`h1:${EPIC}:${STORY}`);
    expect(parseHierarchyFocus(outer)).toEqual({
      ring: 1,
      sliceKey: STORY,
      parentKey: EPIC,
    });

    const grandchild = encodeHierarchyFocus({
      ring: 2,
      sliceKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      parentKey: STORY,
    });
    expect(grandchild).toBe(`h2:${STORY}:cccccccc-cccc-4ccc-8ccc-cccccccccccc`);
    expect(parseHierarchyFocus(grandchild)).toEqual({
      ring: 2,
      sliceKey: 'cccccccc-cccc-4ccc-8ccc-cccccccccccc',
      parentKey: STORY,
    });
  });

  it('returns null for flat chart slice keys', () => {
    expect(parseHierarchyFocus('Done')).toBeNull();
    expect(parseHierarchyFocus('')).toBeNull();
  });
});

describe('nested-donut catalog', () => {
  it('is available as its own typeId', () => {
    expect(isNestedDonutWidgetType('nested-donut')).toBe(true);
    expect(isNestedDonutWidgetType('chart')).toBe(false);
    expect(isChartWidgetAvailable('nested-donut')).toBe(true);
  });
});

describe('shouldDigHierarchySlice', () => {
  it('digs when Chart mode, diggable, and dig handler is wired', () => {
    expect(
      shouldDigHierarchySlice({
        preferDrilldown: false,
        hasChildren: true,
        digEnabled: true,
      })
    ).toBe(true);
  });

  it('drills down for leaves, Table/Split, or when dig is disabled', () => {
    expect(
      shouldDigHierarchySlice({
        preferDrilldown: false,
        hasChildren: false,
        digEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldDigHierarchySlice({
        preferDrilldown: true,
        hasChildren: true,
        digEnabled: true,
      })
    ).toBe(false);
    expect(
      shouldDigHierarchySlice({
        preferDrilldown: false,
        hasChildren: true,
        digEnabled: false,
      })
    ).toBe(false);
  });
});
