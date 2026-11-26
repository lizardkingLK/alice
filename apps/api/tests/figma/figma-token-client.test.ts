import { describe, expect, it, vi } from 'vitest';
import {
  FigmaTokenClient,
  FigmaTokenInvalidResponseError,
  FigmaTokenOutcomeUnknownError,
  FigmaTokenProviderRejectedError,
} from '../../src/routes/api/figma/figma-token-client';

const config = {
  clientId: 'client-id',
  clientSecret: 'client-secret',
  redirectUri: 'https://alice.example/api/figma/oauth/callback',
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

describe('FigmaTokenClient', () => {
  it('uses the official unified token endpoint and validates code exchanges', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        user_id_string: '90071992547409931234',
        access_token: 'access-token',
        refresh_token: 'refresh-token',
        token_type: 'Bearer',
        expires_in: 3600,
      })
    );
    const client = new FigmaTokenClient(config, { fetch: fetchMock });

    await expect(
      client.exchangeAuthorizationCode('authorization-code', 'pkce-verifier')
    ).resolves.toMatchObject({
      user_id_string: '90071992547409931234',
      token_type: 'bearer',
    });

    const [url, init] = fetchMock.mock.calls[0]!;
    expect(url).toBe('https://api.figma.com/v1/oauth/token');
    expect(init.headers).toMatchObject({
      Authorization: `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    });
    expect(String(init.body)).toContain('grant_type=authorization_code');
    expect(String(init.body)).toContain('code_verifier=pkce-verifier');
  });

  it('refreshes through the unified endpoint with the refresh grant', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      jsonResponse({
        access_token: 'new-access-token',
        token_type: 'bearer',
        expires_in: 3600,
      })
    );
    const client = new FigmaTokenClient(config, { fetch: fetchMock });

    await client.refresh('reusable-refresh-token');

    expect(fetchMock.mock.calls[0]?.[0]).toBe(
      'https://api.figma.com/v1/oauth/token'
    );
    expect(String(fetchMock.mock.calls[0]?.[1].body)).toBe(
      'grant_type=refresh_token&refresh_token=reusable-refresh-token'
    );
  });

  it('returns a safe provider rejection without exposing the response body', async () => {
    const fetchMock = vi
      .fn()
      .mockResolvedValue(
        jsonResponse(
          { error: 'invalid_grant', message: 'secret provider diagnostic' },
          400
        )
      );
    const client = new FigmaTokenClient(config, { fetch: fetchMock });

    const error = await client.refresh('refresh-token').catch((value) => value);

    expect(error).toBeInstanceOf(FigmaTokenProviderRejectedError);
    expect(error.failureCode).toBe('invalid_grant');
    expect(error.message).not.toContain('secret provider diagnostic');
    expect(error.message).not.toContain('refresh-token');
  });

  it('treats malformed successful responses as ambiguous', async () => {
    const client = new FigmaTokenClient(config, {
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ access_token: 'token', token_type: 'bearer' })
        ),
    });

    await expect(client.refresh('refresh-token')).rejects.toBeInstanceOf(
      FigmaTokenInvalidResponseError
    );
  });

  it('treats a provider 5xx as ambiguous even when it has an error body', async () => {
    const client = new FigmaTokenClient(config, {
      fetch: vi
        .fn()
        .mockResolvedValue(
          jsonResponse({ error: 'internal_error', message: 'diagnostic' }, 502)
        ),
    });

    await expect(client.refresh('refresh-token')).rejects.toBeInstanceOf(
      FigmaTokenOutcomeUnknownError
    );
  });

  it('aborts timed-out requests and reports an ambiguous outcome', async () => {
    vi.useFakeTimers();
    const fetchMock = vi.fn(
      (_url, init: RequestInit) =>
        new Promise<Response>((_resolve, reject) => {
          init.signal?.addEventListener('abort', () =>
            reject(init.signal?.reason)
          );
        })
    );
    const client = new FigmaTokenClient(config, {
      fetch: fetchMock as typeof fetch,
      timeoutMs: 25,
    });

    const pending = client.refresh('refresh-token');
    const assertion = expect(pending).rejects.toBeInstanceOf(
      FigmaTokenOutcomeUnknownError
    );
    await vi.advanceTimersByTimeAsync(25);

    await assertion;
    vi.useRealTimers();
  });
});
