import { describe, expect, it } from 'vitest';
import {
  catalogIdForChatProvider,
  projectAiProviderGroups,
} from '@/app/projects/_helpers/project-ai-catalog';

describe('projectAiProviderGroups', () => {
  it('lists configurable AI providers with catalog ids', () => {
    const groups = projectAiProviderGroups();
    expect(groups.map((group) => group.provider).sort()).toEqual([
      'anthropic',
      'gemini',
      'openai',
      'spacexai',
    ]);
    expect(catalogIdForChatProvider('anthropic')).toBe('anthropic');
    expect(catalogIdForChatProvider('gemini')).toBe('alice-gemini');
    expect(catalogIdForChatProvider('unknown')).toBeNull();
  });
});
