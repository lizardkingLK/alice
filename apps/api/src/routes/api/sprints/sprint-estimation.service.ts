import {
  UserRoleEnum,
  estimateSprintWorkItem,
  sprintEstimationAiFailureReasonSchema,
  sprintEstimationInputSchema,
  sprintEstimationResponseSchema,
  type SprintEstimationAiFailureReason,
  type SprintEstimationInput,
  type SprintEstimationResponse,
  type SprintEstimationResult,
  type SprintWorkItemEstimate,
} from '@repo/types';
import {
  ActorUserNotFoundError,
  getActorUser,
} from '../../../lib/auth-helpers';
import {
  SprintAccessError,
  SprintEstimationCancelledError,
  SprintEstimationDataError,
  SprintEstimationForbiddenError,
  SprintEstimationLimitError,
  SprintEstimationNotFoundError,
  SprintEstimationUnauthenticatedError,
} from './sprints.errors';
import {
  SPRINT_ESTIMATION_AI_MAX_WORK_ITEMS,
  sprintEstimationAiResponseSchema,
  type SprintEstimationAiEstimate,
  type SprintEstimationAiService,
} from './sprint-estimation.ai.service';
import {
  type SprintEstimationRepository,
  type SprintEstimationRepositoryData,
} from './sprint-estimation.repository';
import { SPRINT_ESTIMATION_TARGET_LIMIT } from './sprint-estimation.constants';
import type { SprintsRepository } from './sprints.repository';

export const SPRINT_ESTIMATION_AI_BATCH_CONCURRENCY = 3;

type SprintAccessRepository = Pick<SprintsRepository, 'requireProjectMember'>;
type SprintHistoryRepository = Pick<
  SprintEstimationRepository,
  'loadForSprint'
>;
type SprintAiService = Pick<SprintEstimationAiService, 'generate'>;

export type SprintEstimationRoleAuthorizer = (actorId: string) => Promise<void>;

export type SprintEstimationServiceOptions = {
  readonly authorizeActor?: SprintEstimationRoleAuthorizer;
  readonly maxAiConcurrency?: number;
};

async function requireSprintEstimationManagerOrAdmin(
  actorId: string
): Promise<void> {
  let actor: Awaited<ReturnType<typeof getActorUser>>;
  try {
    actor = await getActorUser(actorId);
  } catch (error) {
    if (error instanceof ActorUserNotFoundError) {
      throw new SprintEstimationUnauthenticatedError();
    }
    throw new SprintEstimationDataError();
  }

  if (
    actor.role !== UserRoleEnum.admin &&
    actor.role !== UserRoleEnum.manager
  ) {
    throw new SprintEstimationForbiddenError();
  }
}

function throwIfCancelled(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw new SprintEstimationCancelledError();
  }
}

function validatedRepositoryInputs(
  data: SprintEstimationRepositoryData,
  sprintId: string,
  projectId: string
): SprintEstimationInput[] {
  if (data.estimationInputs.length > SPRINT_ESTIMATION_TARGET_LIMIT) {
    throw new SprintEstimationLimitError();
  }
  if (data.sprintId !== sprintId || data.projectId !== projectId) {
    throw new SprintEstimationDataError();
  }

  const result: SprintEstimationInput[] = [];
  const workItemIds = new Set<string>();
  for (const input of data.estimationInputs) {
    const parsed = sprintEstimationInputSchema.safeParse(input);
    if (
      !parsed.success ||
      parsed.data.workItem.projectId !== projectId ||
      workItemIds.has(parsed.data.workItem.id)
    ) {
      throw new SprintEstimationDataError();
    }
    workItemIds.add(parsed.data.workItem.id);
    result.push(parsed.data);
  }
  return result;
}

function deterministicResults(
  estimates: readonly SprintWorkItemEstimate[],
  reason: SprintEstimationAiFailureReason
): SprintEstimationResult[] {
  return estimates.map((estimate) => ({
    ...estimate,
    estimationMethod: 'deterministic',
    fallbackReason: reason,
  }));
}

function validatedAiEstimates(
  value: unknown,
  expectedIds: readonly string[]
): SprintEstimationAiEstimate[] | null {
  const parsed = sprintEstimationAiResponseSchema.safeParse({
    estimates: value,
  });
  if (!parsed.success || parsed.data.estimates.length !== expectedIds.length) {
    return null;
  }

  const byId = new Map<string, SprintEstimationAiEstimate>();
  const expected = new Set(expectedIds);
  for (const estimate of parsed.data.estimates) {
    if (!expected.has(estimate.workItemId) || byId.has(estimate.workItemId)) {
      return null;
    }
    byId.set(estimate.workItemId, estimate);
  }

  const ordered = expectedIds.map((id) => byId.get(id));
  return ordered.every(
    (estimate): estimate is SprintEstimationAiEstimate => estimate !== undefined
  )
    ? ordered
    : null;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function aiResults(
  estimates: readonly SprintEstimationAiEstimate[],
  baselines: readonly SprintWorkItemEstimate[]
): SprintEstimationResult[] {
  return estimates.map((estimate, index) => {
    const baseline = baselines[index]!;
    return {
      ...baseline,
      suggestedHours: estimate.suggestedHours,
      minimumHours: estimate.minimumHours,
      maximumHours: estimate.maximumHours,
      confidence: estimate.confidence,
      rationale: estimate.explanation,
      estimationMethod: 'ai',
      fallbackReason: null,
    };
  });
}

function responseStatus(
  estimates: readonly SprintEstimationResult[]
): SprintEstimationResponse['aiStatus'] {
  if (estimates.length === 0) return 'empty';
  const aiCount = estimates.filter(
    (estimate) => estimate.estimationMethod === 'ai'
  ).length;
  if (aiCount === estimates.length) return 'generated';
  if (aiCount === 0) return 'fallback';
  return 'partial_fallback';
}

export class SprintEstimationService {
  private readonly authorizeActor: SprintEstimationRoleAuthorizer;
  private readonly maxAiConcurrency: number;

  constructor(
    private readonly accessRepository: SprintAccessRepository,
    private readonly historyRepository: SprintHistoryRepository,
    private readonly aiService: SprintAiService,
    options: SprintEstimationServiceOptions = {}
  ) {
    this.authorizeActor =
      options.authorizeActor ?? requireSprintEstimationManagerOrAdmin;
    this.maxAiConcurrency = Math.max(
      1,
      Math.floor(
        options.maxAiConcurrency ?? SPRINT_ESTIMATION_AI_BATCH_CONCURRENCY
      )
    );
  }

  async generate(
    actorId: string,
    sprintId: string,
    callerSignal?: AbortSignal
  ): Promise<SprintEstimationResponse> {
    throwIfCancelled(callerSignal);
    await this.authorizeActor(actorId);
    throwIfCancelled(callerSignal);
    const { projectId } = await this.authorizeProject(actorId, sprintId);
    throwIfCancelled(callerSignal);

    let data: SprintEstimationRepositoryData | null;
    try {
      data = await this.historyRepository.loadForSprint(sprintId);
    } catch {
      throw new SprintEstimationDataError();
    }
    if (!data) {
      throw new SprintEstimationNotFoundError();
    }
    throwIfCancelled(callerSignal);

    const inputs = validatedRepositoryInputs(data, sprintId, projectId);
    if (inputs.length === 0) {
      return { sprintId, aiStatus: 'empty', estimates: [] };
    }

    const batches: SprintEstimationInput[][] = [];
    for (
      let index = 0;
      index < inputs.length;
      index += SPRINT_ESTIMATION_AI_MAX_WORK_ITEMS
    ) {
      batches.push(
        inputs.slice(index, index + SPRINT_ESTIMATION_AI_MAX_WORK_ITEMS)
      );
    }

    const batchResults: SprintEstimationResult[][] = new Array(batches.length);
    for (
      let index = 0;
      index < batches.length;
      index += this.maxAiConcurrency
    ) {
      throwIfCancelled(callerSignal);
      const wave = batches.slice(index, index + this.maxAiConcurrency);
      const waveResults = await Promise.all(
        wave.map((batch) => this.generateBatch(batch, callerSignal))
      );
      throwIfCancelled(callerSignal);
      waveResults.forEach((result, waveIndex) => {
        batchResults[index + waveIndex] = result;
      });
    }

    const estimates = batchResults.flat();
    return sprintEstimationResponseSchema.parse({
      sprintId,
      aiStatus: responseStatus(estimates),
      estimates,
    });
  }

  private async authorizeProject(actorId: string, sprintId: string) {
    try {
      return await this.accessRepository.requireProjectMember(
        sprintId,
        actorId
      );
    } catch (error) {
      if (error instanceof SprintAccessError) {
        throw new SprintEstimationForbiddenError();
      }
      if (error instanceof Error && error.message === 'Sprint not found') {
        throw new SprintEstimationNotFoundError();
      }
      throw new SprintEstimationDataError();
    }
  }

  private async generateBatch(
    inputs: readonly SprintEstimationInput[],
    callerSignal?: AbortSignal
  ): Promise<SprintEstimationResult[]> {
    const baselines = inputs.map(estimateSprintWorkItem);
    let result: unknown;
    try {
      result = await this.aiService.generate(inputs, callerSignal);
    } catch {
      return deterministicResults(baselines, 'provider_error');
    }

    if (!isRecord(result)) {
      return deterministicResults(baselines, 'invalid_response');
    }
    if (result.status === 'unavailable') {
      const reason = sprintEstimationAiFailureReasonSchema.safeParse(
        result.reason
      );
      return deterministicResults(
        baselines,
        reason.success ? reason.data : 'invalid_response'
      );
    }
    if (result.status !== 'success') {
      return deterministicResults(baselines, 'invalid_response');
    }

    const estimates = validatedAiEstimates(
      result.estimates,
      inputs.map((input) => input.workItem.id)
    );
    return estimates
      ? aiResults(estimates, baselines)
      : deterministicResults(baselines, 'invalid_response');
  }
}
