import { apiFetch } from '@/lib/api/api-client.server';
import { Tables } from '@repo/types';

// type DbAttributes = Tables<'attributes'>;

export type AttributeListRow = Tables<'attributes'>;

const attributesPath = '/api/attributes';

export async function getAttributes(): Promise<AttributeListRow[]> {
  const data = await apiFetch<{ attributes: AttributeListRow[] }>(
    attributesPath
  );
  return data.attributes;
}
