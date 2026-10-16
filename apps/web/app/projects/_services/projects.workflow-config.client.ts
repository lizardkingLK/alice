import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import type {
  WorkflowConfigEnvelope,
  WorkflowStateRemap,
} from '@repo/types/api/v1';

export type ProjectWorkflowConfigResponse = {
  readonly config: WorkflowConfigEnvelope;
  readonly usedFallback: boolean;
  readonly updatedAt: string;
};

export type ProjectWorkflowManageResponse = {
  readonly config: WorkflowConfigEnvelope;
  readonly updatedAt: string;
};

export type ProjectWorkflowForkResponse = ProjectWorkflowManageResponse & {
  readonly forkedWorkflowId: string;
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
  expectedUpdatedAt: string,
  stateRemaps?: readonly WorkflowStateRemap[]
): Promise<ProjectWorkflowConfigResponse> {
  return apiFetch<ProjectWorkflowConfigResponse>(
    `/api/projects/${projectId}/workflow-config`,
    {
      method: 'PUT',
      body: JSON.stringify({
        config,
        expectedUpdatedAt,
        ...(stateRemaps && stateRemaps.length > 0 ? { stateRemaps } : {}),
      }),
    }
  );
}

export async function forkProjectWorkflow(
  projectId: string,
  expectedUpdatedAt: string,
  input?: {
    readonly sourceWorkflowId?: string;
    readonly title?: string;
    readonly description?: string;
  }
): Promise<ProjectWorkflowForkResponse> {
  return apiFetch<ProjectWorkflowForkResponse>(
    `/api/projects/${projectId}/workflow-config/fork`,
    {
      method: 'POST',
      body: JSON.stringify({
        expectedUpdatedAt,
        ...input,
      }),
    }
  );
}

export async function setDefaultProjectWorkflow(
  projectId: string,
  workflowId: string,
  expectedUpdatedAt: string
): Promise<ProjectWorkflowManageResponse> {
  return apiFetch<ProjectWorkflowManageResponse>(
    `/api/projects/${projectId}/workflow-config/${workflowId}/default`,
    {
      method: 'POST',
      body: JSON.stringify({ expectedUpdatedAt }),
    }
  );
}

export async function deleteProjectWorkflow(
  projectId: string,
  workflowId: string,
  expectedUpdatedAt: string
): Promise<ProjectWorkflowManageResponse> {
  return apiFetch<ProjectWorkflowManageResponse>(
    `/api/projects/${projectId}/workflow-config/${workflowId}`,
    {
      method: 'DELETE',
      body: JSON.stringify({ expectedUpdatedAt }),
    }
  );
}
