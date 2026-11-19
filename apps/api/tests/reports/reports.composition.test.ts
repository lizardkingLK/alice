import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { ReportsAiInsightsService } from '../../src/routes/api/reports/reports.ai-insights.service';
import { ReportsService } from '../../src/routes/api/reports/reports.service';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

vi.mock('../../src/lib/supabase', () => ({
  supabase: {},
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: {},
  waitForPrisma: async () => undefined,
}));

let composition: typeof import('../../src/config/composition.js');

describe('reports dependency composition', () => {
  // Cold-loading composition pulls most of the API graph; keep headroom under load.
  beforeAll(async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    composition = await import('../../src/config/composition.js');
  }, 30_000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('reuses the configured integrations service for report insights', () => {
    const { integrations, reports } = composition;

    expect(reports.reportsAiInsightsService).toBeInstanceOf(
      ReportsAiInsightsService
    );
    expect(reports.reportsService).toBeInstanceOf(ReportsService);
    expect(
      (
        reports.reportsAiInsightsService as unknown as {
          integrationResolver: unknown;
        }
      ).integrationResolver
    ).toBe(integrations.integrationsService);
    expect(
      (
        reports.reportsService as unknown as {
          aiInsightsService: unknown;
        }
      ).aiInsightsService
    ).toBe(reports.reportsAiInsightsService);
  });
});
