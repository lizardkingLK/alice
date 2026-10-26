import {
  UserRoleEnum,
  estimateSprintWorkItem,
  sprintEstimationResponseSchema,
  type SprintEstimationInput,
} from '@repo/types';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ActorUserLookupError,
  ActorUserNotFoundError,
} from '../../src/lib/auth-helpers';
import {
  SprintAccessError,
  SprintEstimationCancelledError,
  SprintEstimationDataError,
  SprintEstimationForbiddenError,
  SprintEstimationLimitError,
  SprintEstimationNotFoundError,
  SprintEstimationUnauthenticatedError,
} from '../../src/routes/api/sprints/sprints.errors';
import { SprintEstimationService } from '../../src/routes/api/sprints/sprint-estimation.service';

const { getActorUserMock } = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  return { getActorUserMock: vi.fn() };
});

vi.mock('../../src/lib/auth-helpers', () => ({
  getActorUser: getActorUserMock,
  ActorUserLookupError: class ActorUserLookupError extends Error {},
  ActorUserNotFoundError: class ActorUserNotFoundError extends Error {},
}));

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const SPRINT_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';

function workItemId(index: number): string {
  return `00000000-0000-4000-8000-${String(index).padStart(12, '0')}`;
}

function inputs(count: number): SprintEstimationInput[] {
  return Array.from({ length: count }, (_, index) => ({
    workItem: {
      id: workItemId(index),
      projectId: PROJECT_ID,
      type: 'Task' as const,
      priority: 'medium' as const,
      severity: null,
      storyPoints: 5,
      assigneeId: null,
      assigneeSeniority: null,
    },
    history: [],
    previousSprintCompletions: [],
  }));
}

function repositoryData(estimationInputs: SprintEstimationInput[]) {
  return {
    sprintId: SPRINT_ID,
    projectId: PROJECT_ID,
    estimationInputs,
    previousSprintCompletionBasis:
      'current_work_item_state_approximation' as const,
  };
}

function successResult(batch: readonly SprintEstimationInput[]) {
  return {
    status: 'success' as const,
    estimates: batch.map((input, index) => ({
      workItemId: input.workItem.id,
      suggestedHours: 6 + index * 0.5,
      minimumHours: 4,
      maximumHours: 10 + index * 0.5,
      confidence: 'medium' as const,
      explanation: 'AI estimate based on the supplied bounded evidence.',
    })),
    deterministicEstimates: batch.map(estimateSprintWorkItem),
  };
}

describe('SprintEstimationService', () => {
  const authorizeActor = vi.fn();
  const requireProjectMember = vi.fn();
  const loadForSprint = vi.fn();
  const generate = vi.fn();

  function service(maxAiConcurrency = 3) {
    return new SprintEstimationService(
      { requireProjectMember } as never,
      { loadForSprint } as never,
      { generate } as never,
      { authorizeActor, maxAiConcurrency }
    );
  }

  beforeEach(() => {
    vi.clearAllMocks();
    authorizeActor.mockResolvedValue(undefined);
    getActorUserMock.mockResolvedValue({
      id: ACTOR_ID,
      role: UserRoleEnum.manager,
      email: 'manager@alice.dev',
    });
    requireProjectMember.mockResolvedValue({ projectId: PROJECT_ID });
    loadForSprint.mockResolvedValue(repositoryData(inputs(1)));
    generate.mockImplementation(async (batch: SprintEstimationInput[]) =>
      successResult(batch)
    );
  });

  it.each([UserRoleEnum.manager, UserRoleEnum.admin])(
    'authorizes a %s and checks project access before loading history',
    async (role) => {
      const order: string[] = [];
      getActorUserMock.mockImplementationOnce(async () => {
        order.push('role');
        return { id: ACTOR_ID, role, email: `${role}@alice.dev` };
      });
      requireProjectMember.mockImplementationOnce(async () => {
        order.push('project');
        return { projectId: PROJECT_ID };
      });
      loadForSprint.mockImplementationOnce(async () => {
        order.push('history');
        return repositoryData(inputs(1));
      });

      const defaultService = new SprintEstimationService(
        { requireProjectMember } as never,
        { loadForSprint } as never,
        { generate } as never
      );
      await defaultService.generate(ACTOR_ID, SPRINT_ID);

      expect(getActorUserMock).toHaveBeenCalledWith(ACTOR_ID);
      expect(requireProjectMember).toHaveBeenCalledWith(SPRINT_ID, ACTOR_ID);
      expect(order).toEqual(['role', 'project', 'history']);
    }
  );

  it('maps a genuine role denial to forbidden before repository reads', async () => {
    getActorUserMock.mockResolvedValueOnce({
      id: ACTOR_ID,
      role: UserRoleEnum.member,
      email: 'member@alice.dev',
    });
    const defaultService = new SprintEstimationService(
      { requireProjectMember } as never,
      { loadForSprint } as never,
      { generate } as never
    );

    await expect(
      defaultService.generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationForbiddenError);
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
  });

  it('preserves Alice missing-profile policy as unauthenticated', async () => {
    getActorUserMock.mockRejectedValueOnce(new ActorUserNotFoundError());
    const defaultService = new SprintEstimationService(
      { requireProjectMember } as never,
      { loadForSprint } as never,
      { generate } as never
    );

    await expect(
      defaultService.generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationUnauthenticatedError);
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
  });

  it('preserves role lookup infrastructure failures as internal errors', async () => {
    getActorUserMock.mockRejectedValueOnce(new ActorUserLookupError());
    const defaultService = new SprintEstimationService(
      { requireProjectMember } as never,
      { loadForSprint } as never,
      { generate } as never
    );

    await expect(
      defaultService.generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationDataError);
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
  });

  it('rejects unauthorized roles before project or historical reads', async () => {
    authorizeActor.mockRejectedValueOnce(new SprintEstimationForbiddenError());

    await expect(
      service().generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationForbiddenError);
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
  });

  it('rejects inaccessible projects before historical reads', async () => {
    requireProjectMember.mockRejectedValueOnce(new SprintAccessError());

    await expect(
      service().generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationForbiddenError);
    expect(loadForSprint).not.toHaveBeenCalled();
  });

  it('reports a missing sprint without loading historical data', async () => {
    requireProjectMember.mockRejectedValueOnce(new Error('Sprint not found'));

    await expect(
      service().generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationNotFoundError);
    expect(loadForSprint).not.toHaveBeenCalled();
  });

  it('returns an empty response without calling AI', async () => {
    loadForSprint.mockResolvedValueOnce(repositoryData([]));

    await expect(service().generate(ACTOR_ID, SPRINT_ID)).resolves.toEqual({
      sprintId: SPRINT_ID,
      aiStatus: 'empty',
      estimates: [],
    });
    expect(generate).not.toHaveBeenCalled();
  });

  it.each([
    [21, [20, 1]],
    [40, [20, 20]],
    [41, [20, 20, 1]],
    [200, [20, 20, 20, 20, 20, 20, 20, 20, 20, 20]],
  ])('batches %i work items without exceeding 20', async (count, sizes) => {
    const estimationInputs = inputs(count);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(generate.mock.calls.map(([batch]) => batch.length)).toEqual(sizes);
    expect(result.estimates.map((estimate) => estimate.workItemId)).toEqual(
      estimationInputs.map((input) => input.workItem.id)
    );
    expect(result.aiStatus).toBe('generated');
    expect(sprintEstimationResponseSchema.safeParse(result).success).toBe(true);
  });

  it('restores original order when AI results are returned out of order', async () => {
    const estimationInputs = inputs(3);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
    generate.mockImplementationOnce(async (batch: SprintEstimationInput[]) => ({
      ...successResult(batch),
      estimates: [...successResult(batch).estimates].reverse(),
    }));

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(result.estimates.map((estimate) => estimate.workItemId)).toEqual(
      estimationInputs.map((input) => input.workItem.id)
    );
  });

  it.each(['duplicate', 'unknown'] as const)(
    'falls back when AI results contain a %s work-item id',
    async (kind) => {
      const estimationInputs = inputs(2);
      loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
      generate.mockImplementationOnce(
        async (batch: SprintEstimationInput[]) => {
          const result = successResult(batch);
          return {
            ...result,
            estimates:
              kind === 'duplicate'
                ? [result.estimates[0], result.estimates[0]]
                : [
                    result.estimates[0],
                    {
                      ...result.estimates[1],
                      workItemId: '99999999-9999-4999-8999-999999999999',
                    },
                  ],
          };
        }
      );

      const result = await service().generate(ACTOR_ID, SPRINT_ID);

      expect(result.aiStatus).toBe('fallback');
      expect(result.estimates).toEqual(
        estimationInputs.map((input) =>
          expect.objectContaining({
            workItemId: input.workItem.id,
            estimationMethod: 'deterministic',
            fallbackReason: 'invalid_response',
          })
        )
      );
    }
  );

  it('maps AI fields while retaining deterministic evidence metadata', async () => {
    const estimationInputs = inputs(1);
    const baseline = estimateSprintWorkItem(estimationInputs[0]!);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(result.estimates[0]).toEqual({
      ...baseline,
      suggestedHours: 6,
      minimumHours: 4,
      maximumHours: 10,
      confidence: 'medium',
      rationale: 'AI estimate based on the supplied bounded evidence.',
      estimationMethod: 'ai',
      fallbackReason: null,
    });
  });

  it('uses deterministic fallback only for failed AI batches', async () => {
    const estimationInputs = inputs(41);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
    generate.mockImplementation(async (batch: SprintEstimationInput[]) => {
      if (batch[0]?.workItem.id === workItemId(20)) {
        return {
          status: 'unavailable' as const,
          reason: 'timeout' as const,
          deterministicEstimates: batch.map(estimateSprintWorkItem),
        };
      }
      return successResult(batch);
    });

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(result.aiStatus).toBe('partial_fallback');
    expect(result.estimates.slice(0, 20)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          estimationMethod: 'ai',
          fallbackReason: null,
        }),
      ])
    );
    expect(result.estimates.slice(20, 40)).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          estimationMethod: 'deterministic',
          fallbackReason: 'timeout',
        }),
      ])
    );
    expect(result.estimates[40]).toMatchObject({
      estimationMethod: 'ai',
      fallbackReason: null,
    });
  });

  it('falls back for an incomplete or invalid successful AI response', async () => {
    const estimationInputs = inputs(2);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
    generate.mockImplementationOnce(async (batch: SprintEstimationInput[]) => ({
      ...successResult(batch),
      estimates: successResult(batch).estimates.slice(0, 1),
    }));

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(result.aiStatus).toBe('fallback');
    expect(result.estimates).toEqual([
      expect.objectContaining({
        workItemId: workItemId(0),
        estimationMethod: 'deterministic',
        fallbackReason: 'invalid_response',
      }),
      expect.objectContaining({
        workItemId: workItemId(1),
        estimationMethod: 'deterministic',
        fallbackReason: 'invalid_response',
      }),
    ]);
  });

  it('falls back safely for an invalid AI result discriminator', async () => {
    loadForSprint.mockResolvedValueOnce(repositoryData(inputs(1)));
    generate.mockResolvedValueOnce({
      status: 'unavailable',
      reason: 'provider_secret',
      deterministicEstimates: [],
    });

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(result).toMatchObject({
      aiStatus: 'fallback',
      estimates: [
        {
          workItemId: workItemId(0),
          estimationMethod: 'deterministic',
          fallbackReason: 'invalid_response',
        },
      ],
    });
  });

  it('uses provider-error fallback when the AI service throws', async () => {
    const estimationInputs = inputs(1);
    const baseline = estimateSprintWorkItem(estimationInputs[0]!);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
    generate.mockRejectedValueOnce(new Error('provider secret'));

    const result = await service().generate(ACTOR_ID, SPRINT_ID);

    expect(result).toEqual({
      sprintId: SPRINT_ID,
      aiStatus: 'fallback',
      estimates: [
        {
          ...baseline,
          estimationMethod: 'deterministic',
          fallbackReason: 'provider_error',
        },
      ],
    });
  });

  it('aborts active AI calls and does not schedule another batch wave', async () => {
    const estimationInputs = inputs(80);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
    const controller = new AbortController();
    const observedSignals: AbortSignal[] = [];
    generate.mockImplementation(
      async (batch: SprintEstimationInput[], signal?: AbortSignal) => {
        if (!signal) throw new Error('missing cancellation signal');
        observedSignals.push(signal);
        await new Promise<void>((resolve) => {
          signal.addEventListener('abort', () => resolve(), { once: true });
        });
        return {
          status: 'unavailable' as const,
          reason: 'cancelled' as const,
          deterministicEstimates: batch.map(estimateSprintWorkItem),
        };
      }
    );

    const pending = service(2).generate(ACTOR_ID, SPRINT_ID, controller.signal);
    await vi.waitFor(() => expect(generate).toHaveBeenCalledTimes(2));
    controller.abort();

    await expect(pending).rejects.toBeInstanceOf(
      SprintEstimationCancelledError
    );
    expect(generate).toHaveBeenCalledTimes(2);
    expect(observedSignals).toHaveLength(2);
    expect(observedSignals.every((signal) => signal.aborted)).toBe(true);
  });

  it('limits concurrent AI batches', async () => {
    const estimationInputs = inputs(80);
    loadForSprint.mockResolvedValueOnce(repositoryData(estimationInputs));
    let active = 0;
    let maximumActive = 0;
    generate.mockImplementation(async (batch: SprintEstimationInput[]) => {
      active += 1;
      maximumActive = Math.max(maximumActive, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      return successResult(batch);
    });

    await service(2).generate(ACTOR_ID, SPRINT_ID);

    expect(maximumActive).toBe(2);
  });

  it('rejects more than 200 items instead of silently truncating', async () => {
    loadForSprint.mockResolvedValueOnce(repositoryData(inputs(201)));

    await expect(
      service().generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationLimitError);
    expect(generate).not.toHaveBeenCalled();
  });

  it('rejects repository data outside the authorized project', async () => {
    loadForSprint.mockResolvedValueOnce({
      ...repositoryData(inputs(1)),
      projectId: '99999999-9999-4999-8999-999999999999',
    });

    await expect(
      service().generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationDataError);
    expect(generate).not.toHaveBeenCalled();
  });

  it('maps repository infrastructure failure to a safe service data error', async () => {
    loadForSprint.mockRejectedValueOnce(new Error('database password leaked'));

    await expect(
      service().generate(ACTOR_ID, SPRINT_ID)
    ).rejects.toBeInstanceOf(SprintEstimationDataError);
    expect(generate).not.toHaveBeenCalled();
  });
});
