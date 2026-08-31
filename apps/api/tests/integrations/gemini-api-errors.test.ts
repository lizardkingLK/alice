import { describe, expect, it } from 'vitest';
import {
  parseGeminiApiErrorMessage,
  resolveGeminiUserFacingError,
} from '../../src/routes/api/integrations/chat-providers/gemini-api-errors';

const UNAVAILABLE_MODEL_BODY = JSON.stringify({
  error: {
    code: 404,
    message:
      'This model models/gemini-2.5-flash-lite is no longer available to new users. Please update your code to use models/gemini-3.5-flash-lite for the latest features and improvements.',
    status: 'NOT_FOUND',
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
