import {
  projectIntegrationsSummaryResponseSchema,
  type ProjectIntegrationsSummary,
} from '@repo/types/api/v1';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { formatZodError } from '@/lib/zod/format-zod-error';

export async function getProjectIntegrationsSummary(
  projectId: string
): Promise<ProjectIntegrationsSummary> {
  const data = await apiFetch<unknown>(
    `/api/projects/${projectId}/integrations-summary`
  );
  const parsed = projectIntegrationsSummaryResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data.summary;
}
