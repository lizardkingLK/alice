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
    expect(buildChatWithAgentHref('11111111-1111-4111-8111-111111111111')).toBe(
      '/chat?agentId=11111111-1111-4111-8111-111111111111'
    );
    expect(
      buildChatHref({
        conversationId: 'c1',
        agentId: 'a1',
      })
    ).toBe('/chat?conversationId=c1&agentId=a1');
  });
});
