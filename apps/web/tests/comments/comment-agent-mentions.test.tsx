import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { agentIdFromMentionId } from '@repo/types';
import {
  agentsToMentionItems,
  atMentionItems,
  type CommentMentionAgent,
} from '@/app/comments/_components/comment-mention-list';
import { CommentContentView } from '@/app/comments/_components/comment-content-view';

const DEFAULT_AGENT_ID = '11111111-1111-4111-8111-111111111111';
const PERSONAL_AGENT_ID = '22222222-2222-4222-8222-222222222222';

function agent(
  overrides: Partial<CommentMentionAgent> = {}
): CommentMentionAgent {
  return {
    id: DEFAULT_AGENT_ID,
    name: 'Alice',
    title: 'Workspace assistant',
    kind: 'system',
    status: 'active',
    isDefault: true,
    ...overrides,
  };
}

describe('comment agent mentions', () => {
  it('offers only the active workspace default and active visible personal forks', () => {
    const items = agentsToMentionItems([
      agent(),
      agent({
        id: '33333333-3333-4333-8333-333333333333',
        name: 'Other workspace agent',
        isDefault: false,
      }),
      agent({
        id: PERSONAL_AGENT_ID,
        name: 'My Planner',
        title: 'Personal planning agent',
        kind: 'personal',
        isDefault: false,
      }),
      agent({
        id: '44444444-4444-4444-8444-444444444444',
        name: 'Archived fork',
        kind: 'personal',
        status: 'archived',
        isDefault: false,
      }),
    ]);

    expect(items).toEqual([
      expect.objectContaining({
        id: `agent:${DEFAULT_AGENT_ID}`,
        label: 'Alice',
        kind: 'agent',
      }),
      expect.objectContaining({
        id: `agent:${PERSONAL_AGENT_ID}`,
        label: 'My Planner',
        kind: 'agent',
      }),
    ]);
    expect(agentIdFromMentionId(items[0]?.id ?? '')).toBe(DEFAULT_AGENT_ID);
    expect(agentIdFromMentionId('user-1')).toBeNull();
  });

  it('searches agents alongside existing user mentions', () => {
    const users = [
      {
        id: 'user-1',
        name: 'Bob Builder',
        email: 'bob@example.com',
      },
    ];
    const agents = [agent({ name: 'Alice Planner' })];

    expect(atMentionItems(users, agents, 'planner')).toEqual([
      expect.objectContaining({ kind: 'agent', label: 'Alice Planner' }),
    ]);
    expect(atMentionItems(users, agents, 'bob')).toEqual([
      expect.objectContaining({ kind: 'user', id: 'user-1' }),
    ]);
  });

  it('renders agent mentions distinctly and never invokes the user reply flow', () => {
    const onUserMentionClick = vi.fn();
    const { container } = render(
      <CommentContentView
        content={{
          type: 'doc',
          content: [
            {
              type: 'paragraph',
              content: [
                {
                  type: 'mention',
                  attrs: {
                    id: `agent:${DEFAULT_AGENT_ID}`,
                    label: 'Alice Planner',
                    mentionType: 'agent',
                    mentionSuggestionChar: '@',
                  },
                },
              ],
            },
          ],
        }}
        onUserMentionClick={onUserMentionClick}
      />
    );

    const badge = container.querySelector('[data-mention-type="agent"]');
    expect(badge).toHaveTextContent('@Alice Planner');
    expect(badge?.tagName).not.toBe('BUTTON');
    fireEvent.click(screen.getByText('@Alice Planner'));
    expect(onUserMentionClick).not.toHaveBeenCalled();
  });
});
