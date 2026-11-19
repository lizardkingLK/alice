import {
  projectAiModelsResponseSchema,
  projectIntegrationBindingsResponseSchema,
  putProjectIntegrationBindingsBodySchema,
  type ProjectAiModelOption,
  type ProjectIntegrationBindingItem,
  type ProjectIntegrationBindingWire,
} from '@repo/types/api/v1';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { formatZodError } from '@/lib/zod/format-zod-error';

const projectBindingsPath = (projectId: string) =>
  `/api/v1/integrations/project-bindings/${projectId}`;

const projectAiModelsPath = (projectId: string) =>
  `/api/v1/integrations/project-ai-models/${projectId}`;

export async function listProjectAiModels(
  projectId: string
): Promise<ProjectAiModelOption[]> {
  const data = await apiFetch<unknown>(projectAiModelsPath(projectId));
  const parsed = projectAiModelsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data.models;
}

export async function listProjectIntegrationBindings(
  projectId: string
): Promise<ProjectIntegrationBindingWire[]> {
  const data = await apiFetch<unknown>(projectBindingsPath(projectId));
  const parsed = projectIntegrationBindingsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data.bindings;
}

export async function putProjectIntegrationBindings(
  projectId: string,
  bindings: readonly ProjectIntegrationBindingItem[]
): Promise<ProjectIntegrationBindingWire[]> {
  const body = putProjectIntegrationBindingsBodySchema.safeParse({ bindings });
  if (!body.success) {
    throw new Error(formatZodError(body.error));
  }

  const data = await apiFetch<unknown>(projectBindingsPath(projectId), {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body.data),
  });
  const parsed = projectIntegrationBindingsResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data.bindings;
}
