import type { FigmaConnectionStatusDto } from '@repo/types/api/v1';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';

export type { FigmaConnectionStatusDto };

export async function getFigmaConnection(
  projectId: string
): Promise<FigmaConnectionStatusDto> {
  const data = await apiFetch<{ connection: FigmaConnectionStatusDto }>(
    `/api/figma/projects/${projectId}/connection`
  );
  return data.connection;
}

export async function startFigmaOAuth(projectId: string): Promise<string> {
  const data = await apiFetch<{ url: string }>(
    `/api/figma/projects/${projectId}/oauth/start`,
    { method: 'POST' }
  );
  return data.url;
}

export async function verifyFigmaDesign(
  projectId: string
): Promise<FigmaConnectionStatusDto> {
  const data = await apiFetch<{ connection: FigmaConnectionStatusDto }>(
    `/api/figma/projects/${projectId}/verify`,
    { method: 'POST' }
  );
  return data.connection;
}

export async function disconnectFigma(projectId: string): Promise<void> {
  await apiFetch(`/api/figma/projects/${projectId}/connection`, {
    method: 'DELETE',
  });
}
