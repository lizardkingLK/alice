import { describe, expect, it } from 'vitest';
import {
  defaultChatModelForProvider,
  resolveConfiguredChatModelStatus,
} from '@repo/types';

describe('resolveConfiguredChatModelStatus', () => {
  it('marks curated suggestion ids as suggested', () => {
    const recommended = defaultChatModelForProvider('anthropic');
    const result = resolveConfiguredChatModelStatus(
      'anthropic',
      recommended.value
    );
    expect(result.status).toBe('suggested');
    expect(result.warning).toBeNull();
  });

  it('flags known retired anthropic ids with a recommended switch', () => {
    const result = resolveConfiguredChatModelStatus(
      'anthropic',
      'claude-3-5-haiku-latest'
    );
    expect(result.status).toBe('retired');
    expect(result.warning).toContain('retired');
    expect(result.recommended.value).toBe('claude-sonnet-4-5-20250929');
  });

  it('treats unknown pins as custom with a soft warning', () => {
    const result = resolveConfiguredChatModelStatus(
      'anthropic',
      'claude-custom-pin-20260101'
    );
    expect(result.status).toBe('custom');
    expect(result.warning).toContain('not in Alice');
  });
});
