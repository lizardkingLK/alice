import { describe, expect, it } from 'vitest';
import {
  buildChatAgentCustomizeHref,
  buildChatAgentsGalleryHref,
  buildChatHref,
  buildChatWithAgentHref,
} from '@/app/chat/_helpers/chat-url';
import { parseChatPageTab } from '@/lib/search-params';

describe('parseChatPageTab', () => {
  it('defaults to conversation', () => {
    expect(parseChatPageTab(undefined)).toBe('conversation');
    expect(parseChatPageTab(null)).toBe('conversation');
    expect(parseChatPageTab('other')).toBe('conversation');
  });

  it('parses agents', () => {
    expect(parseChatPageTab('agents')).toBe('agents');
  });
});

describe('buildChatHref', () => {
  it('omits default conversation tab', () => {
    expect(buildChatHref()).toBe('/chat');
  });

  it('builds agents gallery and conversation with agent', () => {
    expect(buildChatAgentsGalleryHref()).toBe('/chat?tab=agents');
    expect(buildChatWithAgentHref('system-project-manager')).toBe(
      '/chat?agentId=system-project-manager'
    );
    expect(
      buildChatHref({
        conversationId: 'c1',
        agentId: 'a1',
      })
    ).toBe('/chat?conversationId=c1&agentId=a1');
  });

  it('builds customize page path', () => {
    expect(buildChatAgentCustomizeHref('system-project-manager')).toBe(
      '/chat/agents/system-project-manager'
    );
  });
});
