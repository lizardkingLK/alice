import { describe, expect, it } from 'vitest';
import type { ChartPieVariant } from '@/app/charts/_components/charts.types';

describe('ChartPieVariant', () => {
  it('includes bar alongside pie and donut', () => {
    const variants: ChartPieVariant[] = ['pie', 'donut', 'bar'];
    expect(variants).toContain('bar');
  });
});
