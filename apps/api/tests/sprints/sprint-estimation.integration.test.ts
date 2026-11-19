import {
  UserRoleEnum,
  estimateSprintWorkItem,
  sprintEstimationResponseSchema,
  type SprintEstimationInput,
} from '@repo/types';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const {
  authGetUserMock,
  getActorUserMock,
  prismaGuard,
  unexpectedBoundaryAccess,
  unexpectedPrismaAccess,
} = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  const unexpectedPrismaAccess = vi.fn((property: PropertyKey): never => {
    throw new Error(`Unexpected Prisma access: ${String(property)}`);
  });
  return {
    authGetUserMock: vi.fn(),
    getActorUserMock: vi.fn(),
    prismaGuard: new Proxy(
      {},
      {
        get: (_target, property) => unexpectedPrismaAccess(property),
      }
    ),
    unexpectedBoundaryAccess: vi.fn((access: string): never => {
      throw new Error(`Unexpected dependency access: ${access}`);
    }),
    unexpectedPrismaAccess,
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => ({ auth: { getUser: authGetUserMock } }),
}));

vi.mock('../../src/lib/auth-helpers', () => ({
  getActorUser: getActorUserMock,
  ActorUserNotFoundError: class ActorUserNotFoundError extends Error {},
}));

vi.mock('../../src/lib/prisma', () => ({
  prisma: prismaGuard,
}));

import { createSprintsRouter } from '../../src/routes/api/sprints/sprints.route';
import { SprintAccessError } from '../../src/routes/api/sprints/sprints.errors';
import { SprintEstimationService } from '../../src/routes/api/sprints/sprint-estimation.service';
import type {
  SprintBurndownService,
  SprintsService,
} from '../../src/routes/api/sprints/sprints.service';
import { withMountedRouter } from '../helpers/route-test.harness';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const SPRINT_ID = '22222222-2222-4222-8222-222222222222';
const PROJECT_ID = '33333333-3333-4333-8333-333333333333';
const FIRST_WORK_ITEM_ID = '44444444-4444-4444-8444-444444444444';
const SECOND_WORK_ITEM_ID = '55555555-5555-4555-8555-555555555555';

const requireProjectMember = vi.fn();
const loadForSprint = vi.fn();
const generateAi = vi.fn();

function strictReadOnlyDependency<T extends object>(
  name: string,
  dependency: T
): T {
  return new Proxy(Object.freeze(dependency), {
    get(target, property, receiver) {
      if (!Object.hasOwn(target, property)) {
        return unexpectedBoundaryAccess(`${name}.${String(property)}`);
      }
      return Reflect.get(target, property, receiver);
    },
    set(_target, property) {
      return unexpectedBoundaryAccess(`${name}.${String(property)}=`);
    },
  });
}

function estimationInput(
  workItemId: string,
  storyPoints: number
): SprintEstimationInput {
  return {
    workItem: {
      id: workItemId,
      projectId: PROJECT_ID,
      type: 'Task',
      priority: 'medium',
      severity: null,
      storyPoints,
      assigneeId: null,
      assigneeSeniority: null,
    },
    history: [],
    previousSprintCompletions: [],
  };
}

const estimationInputs = [
  estimationInput(FIRST_WORK_ITEM_ID, 8),
  estimationInput(SECOND_WORK_ITEM_ID, 3),
];

const accessRepository = strictReadOnlyDependency('accessRepository', {
  requireProjectMember,
});
const historyRepository = strictReadOnlyDependency('historyRepository', {
  loadForSprint,
});
const aiService = strictReadOnlyDependency('aiService', {
  generate: generateAi,
});

const estimationService = new SprintEstimationService(
  accessRepository,
  historyRepository,
  aiService
);

const router = createSprintsRouter({
  sprintsService: {} as SprintsService,
  sprintBurndownService: {} as SprintBurndownService,
  sprintEstimationService: estimationService,
});

function postEstimate(baseUrl: string, token: string | null = 'valid-token') {
  return fetch(`${baseUrl}/api/v1/sprints/${SPRINT_ID}/estimates`, {
    method: 'POST',
    headers: token ? { Authorization: `Bearer ${token}` } : undefined,
  });
}

function expectNoUnexpectedPersistenceAccess(): void {
  expect(unexpectedBoundaryAccess).not.toHaveBeenCalled();
  expect(unexpectedPrismaAccess).not.toHaveBeenCalled();
}

describe('sprint estimation HTTP integration', () => {
  beforeEach(() => {
    authGetUserMock.mockReset();
    getActorUserMock.mockReset();
    requireProjectMember.mockReset();
    loadForSprint.mockReset();
    generateAi.mockReset();
    unexpectedBoundaryAccess.mockClear();
    unexpectedPrismaAccess.mockClear();

    authGetUserMock.mockResolvedValue({
      data: { user: { id: ACTOR_ID } },
      error: null,
    });
    requireProjectMember.mockResolvedValue({ projectId: PROJECT_ID });
    loadForSprint.mockResolvedValue({
      sprintId: SPRINT_ID,
      projectId: PROJECT_ID,
      estimationInputs,
      previousSprintCompletionBasis: 'current_work_item_state_approximation',
    });
    generateAi.mockImplementation(async (inputs: SprintEstimationInput[]) => ({
      status: 'success',
      estimates: [
        {
          workItemId: SECOND_WORK_ITEM_ID,
          suggestedHours: 3.5,
          minimumHours: 2.5,
          maximumHours: 5.5,
          confidence: 'medium',
          explanation: 'Second item estimate.',
        },
        {
          workItemId: FIRST_WORK_ITEM_ID,
          suggestedHours: 8.5,
          minimumHours: 6.5,
          maximumHours: 10.5,
          confidence: 'high',
          explanation: 'First item estimate.',
        },
      ],
      deterministicEstimates: inputs.map(estimateSprintWorkItem),
    }));
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it.each([UserRoleEnum.manager, UserRoleEnum.admin])(
    'returns an ordered, contract-valid 200 response for a %s',
    async (role) => {
      getActorUserMock.mockResolvedValue({
        id: ACTOR_ID,
        role,
        email: `${role}@alice.dev`,
      });

      await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
        const response = await postEstimate(baseUrl);
        const body = (await response.json()) as {
          data: unknown;
          error: unknown;
        };

        expect(response.status).toBe(200);
        expect(body.error).toBeNull();
        const parsed = sprintEstimationResponseSchema.safeParse(body.data);
        expect(parsed.success).toBe(true);
        if (!parsed.success) return;
        expect(
          parsed.data.estimates.map((estimate) => estimate.workItemId)
        ).toEqual([FIRST_WORK_ITEM_ID, SECOND_WORK_ITEM_ID]);
        expect(
          parsed.data.estimates.map((estimate) => estimate.suggestedHours)
        ).toEqual([8.5, 3.5]);
        expect(parsed.data).toMatchObject({
          sprintId: SPRINT_ID,
          aiStatus: 'generated',
          estimates: [
            {
              minimumHours: 6.5,
              maximumHours: 10.5,
              estimationMethod: 'ai',
              fallbackReason: null,
            },
            {
              minimumHours: 2.5,
              maximumHours: 5.5,
              estimationMethod: 'ai',
              fallbackReason: null,
            },
          ],
        });
      });

      expect(authGetUserMock).toHaveBeenCalledWith('valid-token');
      expect(getActorUserMock).toHaveBeenCalledWith(ACTOR_ID);
      expect(requireProjectMember).toHaveBeenCalledWith(SPRINT_ID, ACTOR_ID);
      expect(loadForSprint).toHaveBeenCalledWith(SPRINT_ID);
      expect(generateAi).toHaveBeenCalledTimes(1);
      expectNoUnexpectedPersistenceAccess();
    }
  );

  it('returns 403 for a member before project, history, or AI access', async () => {
    getActorUserMock.mockResolvedValue({
      id: ACTOR_ID,
      role: UserRoleEnum.member,
      email: 'member@alice.dev',
    });

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl);

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        data: null,
        error: 'Forbidden',
      });
    });

    expect(authGetUserMock).toHaveBeenCalledWith('valid-token');
    expect(getActorUserMock).toHaveBeenCalledWith(ACTOR_ID);
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
    expect(generateAi).not.toHaveBeenCalled();
    expectNoUnexpectedPersistenceAccess();
  });

  it('returns 401 without authentication before service execution', async () => {
    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl, null);

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    expect(authGetUserMock).not.toHaveBeenCalled();
    expect(getActorUserMock).not.toHaveBeenCalled();
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
    expect(generateAi).not.toHaveBeenCalled();
    expectNoUnexpectedPersistenceAccess();
  });

  it('returns 401 for an invalid token before service execution', async () => {
    const authError = { message: 'Invalid JWT' };
    authGetUserMock.mockResolvedValueOnce({
      data: { user: null },
      error: authError,
    });
    const consoleError = vi
      .spyOn(console, 'error')
      .mockImplementation(() => undefined);

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl, 'invalid-token');

      expect(response.status).toBe(401);
      await expect(response.json()).resolves.toEqual({ error: 'Unauthorized' });
    });

    expect(authGetUserMock).toHaveBeenCalledWith('invalid-token');
    expect(consoleError).toHaveBeenCalledWith('API Auth Error:', authError);
    expect(getActorUserMock).not.toHaveBeenCalled();
    expect(requireProjectMember).not.toHaveBeenCalled();
    expect(loadForSprint).not.toHaveBeenCalled();
    expect(generateAi).not.toHaveBeenCalled();
    expectNoUnexpectedPersistenceAccess();
  });

  it('returns 403 for inaccessible projects before history or AI access', async () => {
    getActorUserMock.mockResolvedValue({
      id: ACTOR_ID,
      role: UserRoleEnum.manager,
      email: 'manager@alice.dev',
    });
    requireProjectMember.mockRejectedValue(new SprintAccessError());

    await withMountedRouter('/api/v1/sprints', router, async (baseUrl) => {
      const response = await postEstimate(baseUrl);

      expect(response.status).toBe(403);
      await expect(response.json()).resolves.toEqual({
        data: null,
        error: 'Forbidden',
      });
    });

    expect(authGetUserMock).toHaveBeenCalledWith('valid-token');
    expect(getActorUserMock).toHaveBeenCalledWith(ACTOR_ID);
    expect(requireProjectMember).toHaveBeenCalledWith(SPRINT_ID, ACTOR_ID);
    expect(loadForSprint).not.toHaveBeenCalled();
    expect(generateAi).not.toHaveBeenCalled();
    expectNoUnexpectedPersistenceAccess();
  });
});
