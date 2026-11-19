import { ChatProviderError } from './chat-provider.error';
import { logLlmProviderError } from './llm-error-log';

const RATE_LIMIT_MESSAGE =
  'Alice AI service is temporarily unavailable because the rate limit has been exceeded. Please try again in a few moments.';

const REMOTE_SERVER_MESSAGE =
  'Alice AI service is temporarily unavailable due to a remote server issue. Please try again in a few moments.';

const GENERIC_REQUEST_MESSAGE =
  'Alice AI service encountered an error while processing your request. Please try again in a few moments.';

function isTransientHttpStatus(status: number): boolean {
  return (
    status === 429 ||
    status === 529 ||
    status === 503 ||
    (status >= 500 && status <= 504)
  );
}

export type ResolveChatProviderUserFacingError = (params: {
  status: number;
  errorBody: string;
  modelId: string;
}) => string | null | undefined;

export type FetchChatProviderWithRetriesParams = {
  /** Registry slug used in error logs (e.g. `gemini`, `spacexai`). */
  provider: string;
  /** Human label for retry warnings (e.g. `Gemini`, `SpaceXAI`). */
  providerLabel: string;
  modelId: string;
  messagesCount: number;
  fetchOnce: () => Promise<Response>;
  resolveUserFacingError: ResolveChatProviderUserFacingError;
  signal?: AbortSignal;
  retries?: number;
  initialDelayMs?: number;
};

function throwIfAborted(signal: AbortSignal | undefined): void {
  signal?.throwIfAborted();
}

function abortReason(signal: AbortSignal): unknown {
  try {
    signal.throwIfAborted();
  } catch (error: unknown) {
    return error;
  }

  return new DOMException('The operation was aborted.', 'AbortError');
}

async function waitForRetry(
  delay: number,
  signal: AbortSignal | undefined
): Promise<void> {
  if (!signal) {
    await new Promise<void>((resolve) => setTimeout(resolve, delay));
    return;
  }

  throwIfAborted(signal);
  await new Promise<void>((resolve, reject) => {
    let settled = false;
    const cleanup = () => signal.removeEventListener('abort', onAbort);
    const timeout = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve();
    }, delay);
    const onAbort = () => {
      if (settled) return;
      settled = true;
      clearTimeout(timeout);
      cleanup();
      reject(abortReason(signal));
    };

    signal.addEventListener('abort', onAbort, { once: true });
    if (signal.aborted) onAbort();
  });
}

async function handleNetworkError(
  params: FetchChatProviderWithRetriesParams,
  _networkErr: unknown,
  attempt: number,
  isLastAttempt: boolean,
  delay: number
): Promise<void> {
  logLlmProviderError(params.provider, {
    timestamp: new Date().toISOString(),
    status: 0,
    attempt,
    messagesCount: params.messagesCount,
    responseBodyBytes: 0,
  });

  if (isLastAttempt) {
    throw new Error(
      'Alice AI service is temporarily unavailable due to a network connection issue. Please try again in a few moments.'
    );
  }

  console.warn(
    `${params.providerLabel} network error. Retrying in ${delay}ms...`
  );
  await waitForRetry(delay, params.signal);
}

async function handleTransientError(
  params: FetchChatProviderWithRetriesParams,
  response: Response,
  attempt: number,
  isLastAttempt: boolean,
  delay: number
): Promise<void> {
  const errorText = await response.text();
  throwIfAborted(params.signal);
  logLlmProviderError(params.provider, {
    timestamp: new Date().toISOString(),
    status: response.status,
    attempt,
    messagesCount: params.messagesCount,
    responseBodyBytes: Buffer.byteLength(errorText, 'utf8'),
  });

  if (isLastAttempt) {
    throw new Error(
      response.status === 429 ? RATE_LIMIT_MESSAGE : REMOTE_SERVER_MESSAGE
    );
  }

  console.warn(
    `${params.providerLabel} transient error ${response.status}. Retrying in ${delay}ms...`
  );
  await waitForRetry(delay, params.signal);
}

async function handleNonOkResponse(
  params: FetchChatProviderWithRetriesParams,
  response: Response,
  attempt: number
): Promise<never> {
  const errorText = await response.text();
  throwIfAborted(params.signal);
  logLlmProviderError(params.provider, {
    timestamp: new Date().toISOString(),
    status: response.status,
    attempt,
    messagesCount: params.messagesCount,
    responseBodyBytes: Buffer.byteLength(errorText, 'utf8'),
  });

  const userMessage = params.resolveUserFacingError({
    status: response.status,
    errorBody: errorText,
    modelId: params.modelId,
  });
  if (userMessage) {
    throw new ChatProviderError(userMessage, 400);
  }

  throw new Error(GENERIC_REQUEST_MESSAGE);
}

/**
 * Shared chat-provider fetch loop: transient retries, error logging, and
 * ChatProviderError mapping. Strategies supply fetchOnce + user-facing errors.
 */
export async function fetchChatProviderWithRetries(
  params: FetchChatProviderWithRetriesParams
): Promise<Response> {
  const retries = params.retries ?? 3;
  let delay = params.initialDelayMs ?? 2000;

  throwIfAborted(params.signal);
  for (let i = 0; i < retries; i++) {
    throwIfAborted(params.signal);
    const isLastAttempt = i === retries - 1;
    let response: Response;
    try {
      response = await params.fetchOnce();
    } catch (networkErr: unknown) {
      throwIfAborted(params.signal);
      await handleNetworkError(params, networkErr, i + 1, isLastAttempt, delay);
      delay *= 2;
      continue;
    }
    throwIfAborted(params.signal);

    if (isTransientHttpStatus(response.status)) {
      await handleTransientError(params, response, i + 1, isLastAttempt, delay);
      delay *= 2;
      continue;
    }

    if (!response.ok) {
      await handleNonOkResponse(params, response, i + 1);
    }

    return response;
  }

  throw new Error(RATE_LIMIT_MESSAGE);
}
