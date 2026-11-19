import {
  memberChatModelPreferenceResponseSchema,
  putMemberChatModelPreferenceBodySchema,
  type MemberChatModelPreferenceWire,
} from '@repo/types/api/v1';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { formatZodError } from '@/lib/zod/format-zod-error';

const PREFERENCE_PATH = '/api/v1/integrations/member-chat-model-preference';

export async function getMemberChatModelPreference(): Promise<MemberChatModelPreferenceWire> {
  const data = await apiFetch<unknown>(PREFERENCE_PATH);
  const parsed = memberChatModelPreferenceResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data.preference;
}

export async function putMemberChatModelPreference(
  defaultIntegrationId: string | null
): Promise<MemberChatModelPreferenceWire> {
  const body = putMemberChatModelPreferenceBodySchema.safeParse({
    default_integration_id: defaultIntegrationId,
  });
  if (!body.success) {
    throw new Error(formatZodError(body.error));
  }

  const data = await apiFetch<unknown>(PREFERENCE_PATH, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body.data),
  });
  const parsed = memberChatModelPreferenceResponseSchema.safeParse(data);
  if (!parsed.success) {
    throw new Error(formatZodError(parsed.error));
  }
  return parsed.data.preference;
}
