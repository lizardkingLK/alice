import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { SprintEstimationAiService } from '../../src/routes/api/sprints/sprint-estimation.ai.service';
import { SprintEstimationRepository } from '../../src/routes/api/sprints/sprint-estimation.repository';
import { SprintEstimationService } from '../../src/routes/api/sprints/sprint-estimation.service';

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

describe('sprint estimation dependency composition', () => {
  // Cold-loading composition pulls most of the API graph; keep headroom under load.
  beforeAll(async () => {
    vi.stubEnv('GITHUB_ACTIONS', 'true');
    composition = await import('../../src/config/composition.js');
  }, 30_000);

  afterAll(() => {
    vi.unstubAllEnvs();
  });

  it('reuses the configured integrations service and injects estimation dependencies', () => {
    const { integrations, sprints } = composition;

    expect(sprints.sprintEstimationRepository).toBeInstanceOf(
      SprintEstimationRepository
    );
    expect(sprints.sprintEstimationAiService).toBeInstanceOf(
      SprintEstimationAiService
    );
    expect(sprints.sprintEstimationService).toBeInstanceOf(
      SprintEstimationService
    );
    expect(
      (
        sprints.sprintEstimationAiService as unknown as {
          integrationResolver: unknown;
        }
      ).integrationResolver
    ).toBe(integrations.integrationsService);
    expect(
      (
        sprints.sprintEstimationService as unknown as {
          historyRepository: unknown;
        }
      ).historyRepository
    ).toBe(sprints.sprintEstimationRepository);
    expect(
      (
        sprints.sprintEstimationService as unknown as {
          aiService: unknown;
        }
      ).aiService
    ).toBe(sprints.sprintEstimationAiService);
  });
});
