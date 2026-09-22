import { describe, expect, it } from 'vitest';
import { selectChatBootstrapConversation } from '@/app/chat/_helpers/select-chat-bootstrap-conversation';
import type { ChatConversation } from '@/app/chat/_components/chat-client.types';

function conversation(id: string, title = id): ChatConversation {
  return {
    id,
    title,
    created_at: '2026-01-01T00:00:00.000Z',
    updated_at: '2026-01-01T00:00:00.000Z',
    is_processing: false,
  };
}

describe('selectChatBootstrapConversation', () => {
  const list = [
    conversation('latest', 'Latest'),
    conversation('older', 'Older'),
  ];

  it('opens the latest conversation when no id is provided', () => {
    expect(selectChatBootstrapConversation(list)).toEqual({
      kind: 'selected',
      conversation: list[0],
    });
  });

  it('returns empty when there are no conversations and no id', () => {
    expect(selectChatBootstrapConversation([])).toEqual({ kind: 'empty' });
  });

  it('selects the matching conversation when id is present', () => {
    expect(selectChatBootstrapConversation(list, 'older')).toEqual({
      kind: 'selected',
      conversation: list[1],
    });
  });

  it('returns not_found for an unknown conversation id (no silent fallback)', () => {
    expect(selectChatBootstrapConversation(list, 'missing')).toEqual({
      kind: 'not_found',
    });
    expect(selectChatBootstrapConversation([], 'missing')).toEqual({
      kind: 'not_found',
    });
  });
});
