import { describe, expect, it } from 'vitest';
import type { ChatViewContext } from '@repo/types/api/v1';
import { resolveChatProjectId } from '@/app/chat/_helpers/chat-project-context';

describe('resolveChatProjectId', () => {
  const projectId = '762fc810-b6bb-4e79-9824-cd0db0d4d7d2';

  it('prefers viewContext.projectId over the page pathname', () => {
    const viewContext = {
      projectId,
    } as ChatViewContext;

    expect(
      resolveChatProjectId({
        viewContext,
        pathname: '/projects/11111111-1111-4111-8111-111111111111',
      })
    ).toBe(projectId);
  });

  it('parses a project id from /projects/<uuid> pathnames', () => {
    expect(
      resolveChatProjectId({
        pathname: `/projects/${projectId}/work-items`,
      })
    ).toBe(projectId);
  });

  it('returns undefined on /chat and unrelated routes', () => {
    expect(resolveChatProjectId({ pathname: '/chat' })).toBeUndefined();
    expect(resolveChatProjectId({ pathname: '/settings' })).toBeUndefined();
    expect(resolveChatProjectId({})).toBeUndefined();
  });
});
