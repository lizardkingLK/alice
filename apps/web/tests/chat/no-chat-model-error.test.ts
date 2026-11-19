import { describe, expect, it } from 'vitest';
import {
  isNoChatModelConfiguredError,
  NO_CHAT_MODEL_ERROR,
  normalizeChatErrorMessage,
} from '@/app/chat/_components/chat-client-support';

describe('no chat model configured error', () => {
  it('detects API and client wording', () => {
    expect(isNoChatModelConfiguredError('No chat model configured')).toBe(true);
    expect(isNoChatModelConfiguredError(NO_CHAT_MODEL_ERROR)).toBe(true);
    expect(isNoChatModelConfiguredError('Something else')).toBe(false);
  });

  it('normalizes backend text to the friendly client message', () => {
    expect(normalizeChatErrorMessage('No chat model configured')).toBe(
      NO_CHAT_MODEL_ERROR
    );
    expect(normalizeChatErrorMessage('Rate limited')).toBe('Rate limited');
  });
});
