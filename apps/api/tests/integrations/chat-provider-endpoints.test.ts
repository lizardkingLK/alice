import { describe, expect, it } from 'vitest';
import { resolveApprovedChatProviderApiUrl } from '../../src/routes/api/integrations/chat-providers/chat-provider-endpoints';

describe('resolveApprovedChatProviderApiUrl', () => {
  it.each([
    [
      'gemini',
      'gemini-3.6-flash',
      'https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent',
    ],
    ['spacexai', 'grok-4.3', 'https://api.x.ai/v1/chat/completions'],
    ['openai', 'gpt-4o', 'https://api.openai.com/v1/chat/completions'],
    [
      'anthropic',
      'claude-sonnet-4-20250514',
      'https://api.anthropic.com/v1/messages',
    ],
  ])('returns the official %s default', (provider, model, expected) => {
    expect(resolveApprovedChatProviderApiUrl({ provider, model })).toBe(
      expected
    );
  });

  it('preserves official Gemini model endpoints and its empty key placeholder', () => {
    expect(
      resolveApprovedChatProviderApiUrl({
        provider: 'gemini',
        model: 'gemini-3.6-flash',
        configuredApiUrl:
          'https://generativelanguage.googleapis.com/v1/models/gemini-3.6-flash:generateContent?key=',
      })
    ).toBe(
      'https://generativelanguage.googleapis.com/v1/models/gemini-3.6-flash:generateContent?key='
    );
  });

  it.each([
    ['openai', 'http' + '://api.openai.com/v1/chat/completions'],
    ['openai', 'https://evil.example/v1/chat/completions'],
    ['openai', 'https://api.openai.com/v1/files'],
    ['openai', 'https://api.openai.com/v1/chat/completions?key=secret'],
    ['anthropic', 'https://api.anthropic.com/v1/complete'],
    ['anthropic', 'https://user:secret@api.anthropic.com/v1/messages'],
    ['spacexai', 'https://api.x.ai/v1/chat/completions#secret'],
  ])('rejects an unapproved %s endpoint', (provider, configuredApiUrl) => {
    expect(() =>
      resolveApprovedChatProviderApiUrl({
        provider,
        model: 'test-model',
        configuredApiUrl,
      })
    ).toThrow(
      'Invalid integration configuration. The chat provider endpoint is not approved.'
    );
  });

  it('does not echo a rejected URL in the error', () => {
    const secretUrl =
      'https://evil.example/v1/chat/completions?api_key=sk-sensitive';

    try {
      resolveApprovedChatProviderApiUrl({
        provider: 'openai',
        model: 'gpt-4o',
        configuredApiUrl: secretUrl,
      });
      throw new Error('Expected endpoint validation to fail');
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      expect(message).not.toContain(secretUrl);
      expect(message).not.toContain('sk-sensitive');
    }
  });
});
