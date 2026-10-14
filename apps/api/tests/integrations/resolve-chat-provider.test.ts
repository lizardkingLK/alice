import { describe, expect, it } from 'vitest';
import { resolveChatProvider } from '../../src/routes/api/integrations/chat-providers/resolve-chat-provider';

describe('resolveChatProvider', () => {
  it('returns the gemini provider', () => {
    expect(resolveChatProvider('gemini').provider).toBe('gemini');
  });

  it('returns the spacexai provider', () => {
    expect(resolveChatProvider('spacexai').provider).toBe('spacexai');
  });

  it('returns the OpenAI provider', () => {
    expect(resolveChatProvider('openai').provider).toBe('openai');
  });

  it('returns the Anthropic provider', () => {
    expect(resolveChatProvider('anthropic').provider).toBe('anthropic');
  });

  it('throws for unknown providers', () => {
    expect(() => resolveChatProvider('unknown')).toThrow(
      'Unsupported chat provider: unknown'
    );
  });
});
