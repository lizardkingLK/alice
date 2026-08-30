import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { createIntegrationsService } from './integrations-api.shared';

const service = createIntegrationsService(apiFetch);

export const createWorkspaceIntegration = service.createIntegration;
export const patchWorkspaceIntegration = service.patchIntegration;
export const deleteWorkspaceIntegration = service.deleteIntegration;

export type {
  CreateIntegrationBody,
  PatchIntegrationBody,
} from './integrations-api.shared';
