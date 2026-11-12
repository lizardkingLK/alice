import { describe, expect, it } from 'vitest';
import {
  chatAssistantIdentityFromWire,
  preferredChatAssistantFromWire,
  shiftPreferredChatAssistant,
} from '@/app/chat/_helpers/chat-assistant-identity';
import type { ChatAgentSummaryWire } from '@repo/types/api/v1';

const sampleAgent: ChatAgentSummaryWire = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'alice-default',
  ownerId: null,
  name: 'Alice',
  title: 'Workspace assistant',
  description: 'Default',
  autonomy: 'suggest',
  status: 'active',
  version: 1,
  forkedFromId: null,
  isDefault: true,
  tagline: '',
  avatarStyle: 'lorelei',
  avatarSeed: 'alice-seed',
  kind: 'system',
  enabledSkillKeys: [],
  enabledToolKeys: [],
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('chatAssistantIdentityFromWire', () => {
  it('maps summary wire into a serializable identity', () => {
    expect(chatAssistantIdentityFromWire(sampleAgent)).toEqual({
      id: sampleAgent.id,
      name: 'Alice',
      title: 'Workspace assistant',
      kind: 'system',
      avatarStyle: 'lorelei',
      avatarSeed: 'alice-seed',
    });
  });

  it('cycles preferred agents for Overview chevrons', () => {
    const alice = preferredChatAssistantFromWire(sampleAgent);
    const coach = preferredChatAssistantFromWire({
      ...sampleAgent,
      id: '22222222-2222-4222-8222-222222222222',
      name: 'Coach',
      title: 'Delivery coach',
      isDefault: false,
    });
    expect(
      shiftPreferredChatAssistant([alice, coach], alice.agentId, 1)
    ).toEqual(coach);
    expect(
      shiftPreferredChatAssistant([alice, coach], coach.agentId, 1)
    ).toEqual(alice);
  });
});
