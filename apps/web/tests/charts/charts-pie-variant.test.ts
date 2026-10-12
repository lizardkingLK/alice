import { describe, expect, it } from 'vitest';
import type { ChartPieVariant } from '@/app/charts/_components/charts.types';

describe('ChartPieVariant', () => {
  it('includes bar and column alongside pie and donut', () => {
    const variants: ChartPieVariant[] = ['pie', 'donut', 'bar', 'column'];
    expect(variants).toContain('bar');
    expect(variants).toContain('column');
  });
});
