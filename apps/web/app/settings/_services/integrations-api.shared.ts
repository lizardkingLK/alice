/* eslint-disable no-unused-vars */
import type {
  CreateIntegrationBody,
  IntegrationDetailWire,
  IntegrationWire,
  PatchIntegrationBody,
} from '@repo/types';

export const INTEGRATIONS_API_PATH = '/api/integrations';

export type IntegrationsListResponse = {
  integrations: IntegrationWire[];
};

export type IntegrationDetailResponse = {
  integration: IntegrationDetailWire;
};

export type { CreateIntegrationBody, PatchIntegrationBody };

export function createIntegrationsService(
  apiFetch: <T>(path: string, init?: RequestInit) => Promise<T>
) {
  async function listIntegrations(): Promise<IntegrationWire[]> {
    const data = await apiFetch<IntegrationsListResponse>(
      INTEGRATIONS_API_PATH
    );
    return data.integrations;
  }

  async function createIntegration(
    body: CreateIntegrationBody
  ): Promise<IntegrationDetailWire> {
    const data = await apiFetch<IntegrationDetailResponse>(
      INTEGRATIONS_API_PATH,
      {
        method: 'POST',
        body: JSON.stringify(body),
      }
    );
    return data.integration;
  }

  async function patchIntegration(
    id: string,
    body: PatchIntegrationBody
  ): Promise<IntegrationDetailWire> {
    const data = await apiFetch<IntegrationDetailResponse>(
      `${INTEGRATIONS_API_PATH}/${id}`,
      {
        method: 'PATCH',
        body: JSON.stringify(body),
      }
    );
    return data.integration;
  }

  async function deleteIntegration(id: string): Promise<void> {
    await apiFetch<{ success: boolean }>(`${INTEGRATIONS_API_PATH}/${id}`, {
      method: 'DELETE',
    });
  }

  return {
    listIntegrations,
    createIntegration,
    patchIntegration,
    deleteIntegration,
  };
}
