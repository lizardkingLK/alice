import type {
  ChatModelGenerateInput,
  ChatModelProvider,
  LlmResponse,
} from './chat-provider.types';
import { ChatProviderError } from './chat-provider.error';
import { resolveGeminiUserFacingError } from './gemini-api-errors';
import { logLlmProviderError } from './llm-error-log';

function buildGeminiUrl(baseUrl: string, apiKey: string): string {
  return baseUrl.includes('key=')
    ? `${baseUrl}${apiKey}`
    : `${baseUrl}?key=${apiKey}`;
}

export class GeminiChatProvider implements ChatModelProvider {
  readonly provider = 'gemini';

  async generateWithTools(input: ChatModelGenerateInput): Promise<LlmResponse> {
    const url = buildGeminiUrl(input.apiUrl, input.apiKey);
    const retries = 3;
    let delay = 2000;

    for (let i = 0; i < retries; i++) {
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: input.contents,
          systemInstruction: {
            parts: [{ text: input.systemInstruction }],
          },
          tools: input.tools,
        }),
      });

      if (
        response.status === 429 ||
        response.status === 503 ||
        (response.status >= 500 && response.status <= 504)
      ) {
        const errorText = await response.text();
        logLlmProviderError(this.provider, {
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          attempt: i + 1,
          messagesCount: input.contents.length,
        });

        if (i < retries - 1) {
          console.warn(
            `Gemini transient error ${response.status}. Retrying in ${delay}ms...`
          );
          await new Promise((resolve) => setTimeout(resolve, delay));
          delay *= 2;
          continue;
        }
        if (response.status === 429) {
          throw new Error(
            'Alice AI service is temporarily unavailable because the rate limit has been exceeded. Please try again in a few moments.'
          );
        }
        throw new Error(
          'Alice AI service is temporarily unavailable due to a remote server issue. Please try again in a few moments.'
        );
      }

      if (!response.ok) {
        const errorText = await response.text();
        logLlmProviderError(this.provider, {
          timestamp: new Date().toISOString(),
          status: response.status,
          statusText: response.statusText,
          errorBody: errorText,
          attempt: i + 1,
          messagesCount: input.contents.length,
        });

        const userMessage = resolveGeminiUserFacingError({
          status: response.status,
          errorBody: errorText,
          modelId: input.model,
        });
        if (userMessage) {
          throw new ChatProviderError(userMessage, 400);
        }

        throw new Error(
          'Alice AI service encountered an error while processing your request. Please try again in a few moments.'
        );
      }

      return response.json() as Promise<LlmResponse>;
    }

    throw new Error(
      'Alice AI service is temporarily unavailable because the API rate limit has been exceeded. Please try again in a few moments.'
    );
  }
}
