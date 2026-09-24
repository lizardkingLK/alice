import { describe, expect, it } from 'vitest';
import {
  buildDicebearAvatarUrl,
  isChatAgentAvatarStyle,
} from '@/app/chat/_helpers/chat-agent-avatar';

describe('chat-agent-avatar', () => {
  it('builds a DiceBear png URL', () => {
    expect(
      buildDicebearAvatarUrl({
        style: 'lorelei',
        seed: 'alice-project-manager',
        size: 128,
      })
    ).toBe(
      'https://api.dicebear.com/9.x/lorelei/png?seed=alice-project-manager&size=128'
    );
  });

  it('validates styles', () => {
    expect(isChatAgentAvatarStyle('lorelei')).toBe(true);
    expect(isChatAgentAvatarStyle('not-a-style')).toBe(false);
  });
});
