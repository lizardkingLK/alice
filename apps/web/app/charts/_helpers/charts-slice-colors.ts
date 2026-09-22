import type { ChartSeriesLabelField, WorkItemStatus } from '@repo/types';
import { STATUS_CHART_COLORS } from '@/components/status-distribution-wheel';

/**
 * Curated theme swatch ids for per-widget slice color overrides.
 * Values resolve to CSS vars so light/dark themes stay aligned.
 */
export const CHARTS_SLICE_COLOR_TOKEN_IDS = [
  'chart-1',
  'chart-2',
  'chart-3',
  'chart-4',
  'chart-5',
  'chart-6',
  'chart-7',
  'chart-8',
] as const;

export type ChartsSliceColorToken =
  (typeof CHARTS_SLICE_COLOR_TOKEN_IDS)[number];

export type ChartsSliceColorSwatch = {
  readonly id: ChartsSliceColorToken;
  readonly cssVar: string;
  readonly label: string;
};

export const CHARTS_SLICE_COLOR_SWATCHES: readonly ChartsSliceColorSwatch[] =
  CHARTS_SLICE_COLOR_TOKEN_IDS.map((id, index) => ({
    id,
    cssVar: `var(--${id})`,
    label: `Color ${index + 1}`,
  }));

const TOKEN_CSS_BY_ID: Readonly<Record<ChartsSliceColorToken, string>> =
  Object.fromEntries(
    CHARTS_SLICE_COLOR_SWATCHES.map((swatch) => [swatch.id, swatch.cssVar])
  ) as Record<ChartsSliceColorToken, string>;

const TOKEN_ID_SET: ReadonlySet<string> = new Set(CHARTS_SLICE_COLOR_TOKEN_IDS);

const FALLBACK_STATUS_COLOR = 'var(--muted-foreground)';

export function isChartsSliceColorToken(
  value: string
): value is ChartsSliceColorToken {
  return TOKEN_ID_SET.has(value);
}

export function chartsSliceColorCssVar(token: ChartsSliceColorToken): string {
  return TOKEN_CSS_BY_ID[token];
}

/** Default rotating palette (same order as legacy pie builder). */
export const CHARTS_DEFAULT_TOKEN_COLORS: readonly string[] =
  CHARTS_SLICE_COLOR_SWATCHES.slice(0, 5).map((swatch) => swatch.cssVar);

/**
 * Resolve the CSS color for a pie slice.
 * Custom token overrides win; otherwise status uses STATUS_CHART_COLORS and
 * other label fields rotate the theme chart tokens.
 */
export function resolveSliceSwatch(
  labelField: ChartSeriesLabelField,
  sliceKey: string,
  index: number,
  sliceColors?: Readonly<Record<string, string>> | null
): string {
  const override = sliceColors?.[sliceKey];
  if (override && isChartsSliceColorToken(override)) {
    return chartsSliceColorCssVar(override);
  }

  if (labelField === 'status') {
    const statusColors = STATUS_CHART_COLORS as Partial<
      Record<WorkItemStatus, string>
    >;
    return statusColors[sliceKey as WorkItemStatus] ?? FALLBACK_STATUS_COLOR;
  }

  return CHARTS_DEFAULT_TOKEN_COLORS[
    index % CHARTS_DEFAULT_TOKEN_COLORS.length
  ] as string;
}
