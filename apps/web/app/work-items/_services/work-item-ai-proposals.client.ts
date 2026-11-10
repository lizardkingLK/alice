import {
  applyWorkItemAiProposalBodySchema,
  generateWorkItemAiProposalsBodySchema,
  type ApplyWorkItemAiProposalBody,
  type GenerateWorkItemAiProposalsBody,
  type WorkItemAiProposalResponse,
} from '@repo/types';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { formatZodError } from '@/lib/zod/format-zod-error';

const workItemsBasePath = '/api/v1/work-items';

export async function generateWorkItemAiProposals(
  workItemId: string,
  body: GenerateWorkItemAiProposalsBody
): Promise<WorkItemAiProposalResponse> {
  const parsed = generateWorkItemAiProposalsBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  const response = await apiFetch<{
    data: WorkItemAiProposalResponse;
    error: null;
  }>(`${workItemsBasePath}/${workItemId}/ai-proposals`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsed.data),
  });

  return response.data;
}

export async function applyWorkItemAiProposal(
  workItemId: string,
  body: ApplyWorkItemAiProposalBody
): Promise<DbWorkItem> {
  const parsed = applyWorkItemAiProposalBodySchema.safeParse(body);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }

  const response = await apiFetch<{
    data: DbWorkItem;
    error: null;
  }>(`${workItemsBasePath}/${workItemId}/ai-proposals/apply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(parsed.data),
  });

  return response.data;
}
