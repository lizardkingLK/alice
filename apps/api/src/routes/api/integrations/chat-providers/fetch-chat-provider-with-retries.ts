import { ChatProviderError } from './chat-provider.error';
import { logLlmProviderError } from './llm-error-log';

const RATE_LIMIT_MESSAGE =
  'Alice AI service is temporarily unavailable because the rate limit has been exceeded. Please try again in a few moments.';

const REMOTE_SERVER_MESSAGE =
  'Alice AI service is temporarily unavailable due to a remote server issue. Please try again in a few moments.';

const GENERIC_REQUEST_MESSAGE =
  'Alice AI service encountered an error while processing your request. Please try again in a few moments.';

function isTransientHttpStatus(status: number): boolean {
  return status === 429 || status === 503 || (status >= 500 && status <= 504);
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
  retries?: number;
  initialDelayMs?: number;
};

/**
 * Shared chat-provider fetch loop: transient retries, error logging, and
 * ChatProviderError mapping. Strategies supply fetchOnce + user-facing errors.
 */
export async function fetchChatProviderWithRetries(
  params: FetchChatProviderWithRetriesParams
): Promise<Response> {
  const retries = params.retries ?? 3;
  let delay = params.initialDelayMs ?? 2000;

  for (let i = 0; i < retries; i++) {
    const response = await params.fetchOnce();

    if (isTransientHttpStatus(response.status)) {
      const errorText = await response.text();
      logLlmProviderError(params.provider, {
        timestamp: new Date().toISOString(),
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        attempt: i + 1,
        messagesCount: params.messagesCount,
      });

      if (i < retries - 1) {
        console.warn(
          `${params.providerLabel} transient error ${response.status}. Retrying in ${delay}ms...`
        );
        await new Promise((resolve) => setTimeout(resolve, delay));
        delay *= 2;
        continue;
      }

      throw new Error(
        response.status === 429 ? RATE_LIMIT_MESSAGE : REMOTE_SERVER_MESSAGE
      );
    }

    if (!response.ok) {
      const errorText = await response.text();
      logLlmProviderError(params.provider, {
        timestamp: new Date().toISOString(),
        status: response.status,
        statusText: response.statusText,
        errorBody: errorText,
        attempt: i + 1,
        messagesCount: params.messagesCount,
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

    return response;
  }

  throw new Error(RATE_LIMIT_MESSAGE);
}
