import { z } from 'zod';

const FIGMA_TOKEN_URL = 'https://api.figma.com/v1/oauth/token';
const DEFAULT_TOKEN_TIMEOUT_MS = 10_000;
const MAX_TOKEN_RESPONSE_BYTES = 64 * 1024;

const baseTokenSchema = z.object({
  access_token: z.string().min(1).max(16_384),
  token_type: z.string().transform((value) => value.toLowerCase()),
  expires_in: z.number().int().positive().max(31_536_000),
  refresh_token: z.string().min(1).max(16_384).optional(),
});

const authorizationTokenSchema = baseTokenSchema.extend({
  refresh_token: z.string().min(1).max(16_384),
  user_id_string: z.string().min(1).max(256),
});

export type FigmaAuthorizationTokenResponse = z.infer<
  typeof authorizationTokenSchema
>;
export type FigmaRefreshTokenResponse = z.infer<typeof baseTokenSchema>;

export class FigmaTokenProviderRejectedError extends Error {
  constructor(
    readonly httpStatus: number,
    readonly failureCode: string
  ) {
    super(
      'Figma rejected the OAuth token request. Reconnect Figma and try again.'
    );
    this.name = 'FigmaTokenProviderRejectedError';
  }
}

export class FigmaTokenOutcomeUnknownError extends Error {
  constructor() {
    super(
      'The Figma OAuth token request had an uncertain outcome. Automatic token operations are paused for safety.'
    );
    this.name = 'FigmaTokenOutcomeUnknownError';
  }
}

export class FigmaTokenInvalidResponseError extends Error {
  constructor() {
    super(
      'Figma returned an invalid OAuth token response. Token operations are paused for safety.'
    );
    this.name = 'FigmaTokenInvalidResponseError';
  }
}

type FigmaTokenClientConfig = {
  clientId: string;
  clientSecret: string;
  redirectUri: string;
};

type FigmaTokenClientOptions = {
  fetch?: typeof fetch;
  timeoutMs?: number;
};

function safeFailureCode(value: unknown): string {
  if (typeof value !== 'string') return 'provider_rejected';
  const normalized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]/g, '_');
  return normalized.slice(0, 64) || 'provider_rejected';
}

function responseOutcomeIsAmbiguous(status: number): boolean {
  return status >= 500 || status === 408;
}

function parseTokenResponse(response: Response, responseText: string): unknown {
  try {
    if (Buffer.byteLength(responseText, 'utf8') > MAX_TOKEN_RESPONSE_BYTES) {
      throw new Error('Figma token response exceeded the size limit.');
    }
    return JSON.parse(responseText);
  } catch {
    if (response.ok || responseOutcomeIsAmbiguous(response.status)) {
      throw new FigmaTokenOutcomeUnknownError();
    }
    throw new FigmaTokenProviderRejectedError(
      response.status,
      'provider_rejected'
    );
  }
}

function throwForRejectedResponse(response: Response, body: unknown): void {
  if (response.ok) return;
  if (responseOutcomeIsAmbiguous(response.status)) {
    throw new FigmaTokenOutcomeUnknownError();
  }
  const record =
    body && typeof body === 'object' ? (body as Record<string, unknown>) : {};
  throw new FigmaTokenProviderRejectedError(
    response.status,
    safeFailureCode(record.error ?? record.code)
  );
}

function combinedSignal(
  timeoutMs: number,
  parent?: AbortSignal
): {
  signal: AbortSignal;
  dispose: () => void;
} {
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(new Error('Figma token request timed out.')),
    timeoutMs
  );
  const onAbort = () => controller.abort(parent?.reason);
  parent?.addEventListener('abort', onAbort, { once: true });
  return {
    signal: controller.signal,
    dispose: () => {
      clearTimeout(timer);
      parent?.removeEventListener('abort', onAbort);
    },
  };
}

export class FigmaTokenClient {
  private readonly fetchImpl: typeof fetch;
  private readonly timeoutMs: number;

  constructor(
    private readonly config: FigmaTokenClientConfig,
    options: FigmaTokenClientOptions = {}
  ) {
    this.fetchImpl = options.fetch ?? ((input, init) => fetch(input, init));
    this.timeoutMs = options.timeoutMs ?? DEFAULT_TOKEN_TIMEOUT_MS;
    if (!Number.isFinite(this.timeoutMs) || this.timeoutMs <= 0) {
      throw new RangeError('Figma token request timeout must be positive.');
    }
  }

  exchangeAuthorizationCode(
    code: string,
    codeVerifier: string,
    signal?: AbortSignal
  ): Promise<FigmaAuthorizationTokenResponse> {
    return this.request(
      {
        redirect_uri: this.config.redirectUri,
        code,
        grant_type: 'authorization_code',
        code_verifier: codeVerifier,
      },
      authorizationTokenSchema,
      signal
    );
  }

  refresh(
    refreshToken: string,
    signal?: AbortSignal
  ): Promise<FigmaRefreshTokenResponse> {
    return this.request(
      { grant_type: 'refresh_token', refresh_token: refreshToken },
      baseTokenSchema,
      signal
    );
  }

  private async request<T extends { token_type: string }>(
    fields: Record<string, string>,
    schema: z.ZodType<T>,
    parentSignal?: AbortSignal
  ): Promise<T> {
    const requestSignal = combinedSignal(this.timeoutMs, parentSignal);
    let response: Response;
    let responseText: string;
    try {
      response = await this.fetchImpl(FIGMA_TOKEN_URL, {
        method: 'POST',
        headers: {
          Authorization: `Basic ${Buffer.from(
            `${this.config.clientId}:${this.config.clientSecret}`
          ).toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
          Accept: 'application/json',
        },
        body: new URLSearchParams(fields),
        signal: requestSignal.signal,
        redirect: 'error',
      });
      responseText = await response.text();
    } catch {
      throw new FigmaTokenOutcomeUnknownError();
    } finally {
      requestSignal.dispose();
    }

    const body = parseTokenResponse(response, responseText);
    throwForRejectedResponse(response, body);

    if (
      body &&
      typeof body === 'object' &&
      typeof (body as Record<string, unknown>).error === 'string'
    ) {
      throw new FigmaTokenProviderRejectedError(
        response.status,
        safeFailureCode((body as Record<string, unknown>).error)
      );
    }

    const parsed = schema.safeParse(body);
    if (!parsed.success || parsed.data.token_type !== 'bearer') {
      throw new FigmaTokenInvalidResponseError();
    }
    return parsed.data;
  }
}
