import type { IntegrationWire } from '@repo/types';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.server';
import { getDbUser } from '@/lib/auth';
import { isAdmin } from '@/lib/rbac';
import { createIntegrationsService } from './integrations-api.shared';

const service = createIntegrationsService(apiFetch);

export async function listWorkspaceIntegrations(): Promise<IntegrationWire[]> {
  const dbUser = await getDbUser();
  if (!isAdmin(dbUser?.role)) {
    return [];
  }

  try {
    return await service.listIntegrations();
  } catch (error) {
    console.error('error. failed to list workspace integrations:', error);
    return [];
  }
}
