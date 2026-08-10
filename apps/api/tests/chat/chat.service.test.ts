import { describe, it, expect, vi } from 'vitest';

const { mockClient } = vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
  const mockEq = () => Promise.resolve({ data: [], error: null });
  const mockSelect = () => ({ eq: mockEq });
  const mockFrom = () => ({ select: mockSelect });
  return {
    mockClient: {
      from: mockFrom,
    },
  };
});

vi.mock('@supabase/supabase-js', () => ({
  createClient: () => mockClient,
}));

import {
  chatHistoryToMarkdown,
  markdownToChatHistory,
} from '../../src/routes/api/chat/chat.service';
import type { StoredChatMessage } from '../../src/routes/api/chat/chat.route.types';

describe('Chat History Markdown Serialization', () => {
  it('should serialize and deserialize chat history losslessly', () => {
    const conversationId = 'test-conversation-id';
    const messages: StoredChatMessage[] = [
      {
        id: 'msg-1',
        role: 'user',
        content: 'Hello, bot!',
      },
      {
        id: 'msg-2',
        role: 'assistant',
        content: 'Hello user, how can I assist you?',
        actions: [
          {
            type: 'create_project',
            entity: { id: 'proj-1', name: 'Project One', key: 'PROJ1' },
          },
        ],
      },
    ];

    const md = chatHistoryToMarkdown(conversationId, messages);
    expect(md).toContain('# Chat History for Conversation: test-conversation-id');
    expect(md).toContain('<!-- JSON_HISTORY_DATA_START');
    expect(md).toContain('JSON_HISTORY_DATA_END -->');

    const parsed = markdownToChatHistory(md);
    expect(parsed).toEqual(messages);
    expect(parsed).toHaveLength(2);
    const secondMsg = parsed[1];
    expect(secondMsg).toBeDefined();
    expect(secondMsg?.actions).toBeDefined();
    expect(secondMsg?.actions?.[0]?.type).toBe('create_project');
  });

  it('should return empty array on invalid or missing metadata', () => {
    const invalidMd = '# Not a real chat history markdown';
    const parsed = markdownToChatHistory(invalidMd);
    expect(parsed).toEqual([]);
  });
});
