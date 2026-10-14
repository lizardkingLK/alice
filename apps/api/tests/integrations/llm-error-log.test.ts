import { beforeEach, describe, expect, it, vi } from 'vitest';

const { appendFileSyncMock } = vi.hoisted(() => ({
  appendFileSyncMock: vi.fn(),
}));

vi.mock('node:fs', () => ({
  appendFileSync: appendFileSyncMock,
}));

import { logLlmProviderError } from '../../src/routes/api/integrations/chat-providers/llm-error-log';

describe('logLlmProviderError', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
  });

  it('logs only metadata and never accepts a provider response body', () => {
    logLlmProviderError('openai\nforged-entry', {
      timestamp: '2026-10-13T00:00:00.000Z',
      status: 401,
      attempt: 1,
      messagesCount: 2,
      responseBodyBytes: 84,
    });

    expect(appendFileSyncMock).toHaveBeenCalledOnce();
    const logged = String(appendFileSyncMock.mock.calls[0]?.[1]);
    expect(logged).toContain('Provider response body omitted; bytes: 84');
    expect(logged).toContain('openai_forged-entry');
    expect(logged).not.toContain('Authorization');
    expect(logged).not.toContain('api_key');
    expect(logged).not.toContain('Body:');
  });
});
