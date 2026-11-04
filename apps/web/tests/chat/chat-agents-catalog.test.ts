import { describe, expect, it } from 'vitest';
import {
  chatAgentDetailToRecord,
  chatAgentSummaryToRecord,
  draftToPatchBody,
  partitionGalleryAgents,
  type ChatAgentRecord,
} from '@/app/chat/_helpers/chat-agents-catalog';
import type {
  ChatAgentDetailWire,
  ChatAgentSummaryWire,
} from '@repo/types/api/v1';

const summaryWire: ChatAgentSummaryWire = {
  id: '11111111-1111-4111-8111-111111111111',
  key: 'alice-default',
  ownerId: null,
  name: 'Alice',
  title: 'Assistant',
  description: 'Default assistant',
  autonomy: 'suggest',
  status: 'active',
  version: 1,
  forkedFromId: null,
  isDefault: true,
  tagline: 'Helpful',
  avatarStyle: 'lorelei',
  avatarSeed: 'alice-v1',
  kind: 'system',
  enabledToolKeys: ['list_projects', 'create_project'],
  enabledSkillKeys: ['planning'],
  createdBy: null,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedBy: null,
  updatedAt: '2026-01-01T00:00:00.000Z',
};

describe('chat-agents-catalog helpers', () => {
  it('maps summary wire into a gallery record', () => {
    const record = chatAgentSummaryToRecord(summaryWire);
    expect(record.name).toBe('Alice');
    expect(record.authorName).toBe('Alice');
    expect(record.enabledToolKeys).toEqual(['list_projects', 'create_project']);
    expect(record.enabledSkillKeys).toEqual(['planning']);
    expect(record.instructions).toBe('');
    expect(record.isDefault).toBe(true);
  });

  it('maps detail wire instructions', () => {
    const detail: ChatAgentDetailWire = {
      ...summaryWire,
      instructions: 'Be concise.',
    };
    expect(chatAgentDetailToRecord(detail).instructions).toBe('Be concise.');
  });

  it('partitions mine vs archived', () => {
    const mine = chatAgentSummaryToRecord(summaryWire);
    const archived: ChatAgentRecord = {
      ...mine,
      id: '22222222-2222-4222-8222-222222222222',
      status: 'archived',
      isDefault: false,
      kind: 'personal',
      authorName: 'You',
    };
    const parts = partitionGalleryAgents([mine, archived]);
    expect(parts.mine).toHaveLength(1);
    expect(parts.archived).toHaveLength(1);
    expect(parts.shared).toHaveLength(0);
  });

  it('builds patch toggles from enabled key arrays', () => {
    const body = draftToPatchBody(
      {
        name: 'Alice',
        enabledToolKeys: ['list_projects'],
        enabledSkillKeys: [],
      },
      {
        toolKeys: ['list_projects', 'create_project'],
        skillKeys: ['planning'],
      }
    );
    expect(body.enabledTools).toEqual([
      { key: 'list_projects', enabled: true },
      { key: 'create_project', enabled: false },
    ]);
    expect(body.enabledSkills).toEqual([{ key: 'planning', enabled: false }]);
  });
});
