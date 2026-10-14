import { describe, expect, it } from 'vitest';
import {
  GEMINI_API_KEY_REJECTED_MESSAGE,
  parseGeminiApiErrorMessage,
  resolveGeminiUserFacingError,
} from '../../src/routes/api/integrations/chat-providers/gemini/alice-chatbot-errors';

const UNAVAILABLE_MODEL_BODY = JSON.stringify({
  error: {
    code: 404,
    message:
      'This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements.',
    status: 'NOT_FOUND',
  },
});

const INVALID_API_KEY_BODY = JSON.stringify({
  error: {
    code: 400,
    message: 'API key not valid. Please pass a valid API key.',
    status: 'INVALID_ARGUMENT',
    details: [
      {
        '@type': 'type.googleapis.com/google.rpc.ErrorInfo',
        reason: 'API_KEY_INVALID',
      },
    ],
  },
});

const EXPIRED_API_KEY_BODY = JSON.stringify({
  error: {
    code: 403,
    message: 'API key expired. Please renew the API key.',
    status: 'PERMISSION_DENIED',
  },
});

describe('parseGeminiApiErrorMessage', () => {
  it('extracts the message from a Gemini error payload', () => {
    expect(parseGeminiApiErrorMessage(UNAVAILABLE_MODEL_BODY)).toContain(
      'no longer available'
    );
  });

  it('returns undefined for invalid JSON', () => {
    expect(parseGeminiApiErrorMessage('not json')).toBeUndefined();
  });
});

describe('resolveGeminiUserFacingError', () => {
  it('returns guidance when Google reports a retired model', () => {
    const message = resolveGeminiUserFacingError({
      status: 404,
      errorBody: UNAVAILABLE_MODEL_BODY,
      modelId: 'gemini-2.5-flash-lite',
    });

    expect(message).toContain('gemini-2.5-flash-lite');
    expect(message).toContain('Settings → Integrations');
    expect(message).toContain('gemini-3.5-flash-lite');
  });

  it('returns API key guidance for 401 auth failures', () => {
    expect(
      resolveGeminiUserFacingError({
        status: 401,
        errorBody: '{}',
        modelId: 'gemini-2.5-flash-lite',
      })
    ).toBe(GEMINI_API_KEY_REJECTED_MESSAGE);
  });

  it('returns API key guidance when Google reports an invalid key', () => {
    expect(
      resolveGeminiUserFacingError({
        status: 400,
        errorBody: INVALID_API_KEY_BODY,
        modelId: 'gemini-2.5-flash-lite',
      })
    ).toBe(GEMINI_API_KEY_REJECTED_MESSAGE);
  });

  it('returns API key guidance when Google reports an expired key', () => {
    expect(
      resolveGeminiUserFacingError({
        status: 403,
        errorBody: EXPIRED_API_KEY_BODY,
        modelId: 'gemini-2.5-flash-lite',
      })
    ).toBe(GEMINI_API_KEY_REJECTED_MESSAGE);
  });

  it('returns undefined for unrecognized errors', () => {
    expect(
      resolveGeminiUserFacingError({
        status: 500,
        errorBody: JSON.stringify({
          error: { message: 'Internal error', status: 'INTERNAL' },
        }),
        modelId: 'gemini-2.5-flash-lite',
      })
    ).toBeUndefined();
  });
});
