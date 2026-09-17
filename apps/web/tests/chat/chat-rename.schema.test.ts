import { describe, expect, it } from 'vitest';
import { renameChatConversationBodySchema } from '@repo/types/api/v1';

describe('renameChatConversationBodySchema', () => {
  it('accepts a trimmed non-empty title', () => {
    const parsed = renameChatConversationBodySchema.safeParse({
      title: '  Sprint planning  ',
    });
    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.title).toBe('Sprint planning');
    }
  });

  it('rejects empty and oversized titles', () => {
    expect(
      renameChatConversationBodySchema.safeParse({ title: '  ' }).success
    ).toBe(false);
    expect(
      renameChatConversationBodySchema.safeParse({ title: 'x'.repeat(121) })
        .success
    ).toBe(false);
  });
});
