import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type { WorkflowConfigEnvelope } from '@repo/types/api/v1';

export type ProjectWorkflowConfigResponse = {
  readonly config: WorkflowConfigEnvelope;
  readonly usedFallback: boolean;
  readonly updatedAt: string;
};

export async function getProjectWorkflowConfig(
  projectId: string
): Promise<ProjectWorkflowConfigResponse> {
  return apiFetch<ProjectWorkflowConfigResponse>(
    `/api/projects/${projectId}/workflow-config`
  );
}

export async function putProjectWorkflowConfig(
  projectId: string,
  config: WorkflowConfigEnvelope,
  expectedUpdatedAt: string
): Promise<ProjectWorkflowConfigResponse> {
  return apiFetch<ProjectWorkflowConfigResponse>(
    `/api/projects/${projectId}/workflow-config`,
    {
      method: 'PUT',
      body: JSON.stringify({ config, expectedUpdatedAt }),
    }
  );
}
