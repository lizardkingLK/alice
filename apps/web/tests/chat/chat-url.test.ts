import { describe, expect, it } from 'vitest';
import {
  buildChatAgentsGalleryHref,
  buildChatHref,
  buildChatWithAgentHref,
} from '@/app/chat/_helpers/chat-url';

describe('buildChatHref', () => {
  it('omits empty query', () => {
    expect(buildChatHref()).toBe('/chat');
  });

  it('builds conversation with agent', () => {
    expect(buildChatAgentsGalleryHref()).toBe('/chat');
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
});
