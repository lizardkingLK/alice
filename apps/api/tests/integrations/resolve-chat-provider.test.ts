import { describe, expect, it } from 'vitest';
import { resolveChatProvider } from '../../src/routes/api/integrations/chat-providers/resolve-chat-provider';

describe('resolveChatProvider', () => {
  it('returns the gemini provider', () => {
    expect(resolveChatProvider('gemini').provider).toBe('gemini');
  });

  it('throws for unknown providers', () => {
    expect(() => resolveChatProvider('unknown')).toThrow(
      'Unsupported chat provider: unknown'
    );
  });
});
