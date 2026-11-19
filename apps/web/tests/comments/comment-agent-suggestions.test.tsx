import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { JSONContent } from '@tiptap/react';
import { extractAgentMentionsFromDoc } from '@/app/comments/_helpers/comment-agent-mentions';
import { CommentListItem } from '@/app/comments/_components/comment-list-item';
import { commentFactory } from '../factories/comment.factory';

vi.mock('@/components/realtime/realtime-provider', () => ({
  useRealtime: () => ({
    isUserOnline: () => false,
  }),
}));

describe('Comment Agent Suggestions Integration', () => {
  const agentCommentDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {
            type: 'mention',
            attrs: {
              id: 'agent:33333333-3333-4333-8333-333333333333',
              label: 'DevBot',
              mentionType: 'agent',
            },
          },
          {
            type: 'text',
            text: ' can you suggest a clearer description for this task?',
          },
        ],
      },
    ],
  };

  it('extracts agent mentions from TipTap document correctly', () => {
    const mentions = extractAgentMentionsFromDoc(agentCommentDoc);
    expect(mentions).toHaveLength(1);
    expect(mentions[0]).toEqual({
      id: 'agent:33333333-3333-4333-8333-333333333333',
      agentId: '33333333-3333-4333-8333-333333333333',
      label: 'DevBot',
    });
  });

  it('renders suggest button in comment item when agent is mentioned', () => {
    const onRequestAiSuggestions = vi.fn();
    const comment = commentFactory.build({
      id: 'comment-1',
      work_item_id: 'item-1',
      content: agentCommentDoc,
    });

    render(
      <CommentListItem
        comment={comment}
        activeUserId="user-2"
        isEditing={false}
        isReplying={false}
        users={[]}
        agents={[]}
        workItems={[]}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartReply={vi.fn()}
        onCancelReply={vi.fn()}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onPurge={vi.fn()}
        onRequestAiSuggestions={onRequestAiSuggestions}
      />
    );

    const suggestBtn = screen.getByTestId('request-ai-suggestions-btn');
    expect(suggestBtn).toBeInTheDocument();
    expect(suggestBtn).toHaveTextContent('Suggest with @DevBot');

    fireEvent.click(suggestBtn);
    expect(onRequestAiSuggestions).toHaveBeenCalledWith(
      '33333333-3333-4333-8333-333333333333',
      'DevBot',
      'comment-1'
    );
  });

  it('does not render suggest button if comment has no agent mentions', () => {
    const plainCommentDoc: JSONContent = {
      type: 'doc',
      content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Just a regular comment' }],
        },
      ],
    };

    const comment = commentFactory.build({
      id: 'comment-2',
      work_item_id: 'item-1',
      content: plainCommentDoc,
    });

    render(
      <CommentListItem
        comment={comment}
        activeUserId="user-2"
        isEditing={false}
        isReplying={false}
        users={[]}
        agents={[]}
        workItems={[]}
        onStartEdit={vi.fn()}
        onCancelEdit={vi.fn()}
        onSaveEdit={vi.fn()}
        onStartReply={vi.fn()}
        onCancelReply={vi.fn()}
        onArchive={vi.fn()}
        onRestore={vi.fn()}
        onPurge={vi.fn()}
        onRequestAiSuggestions={vi.fn()}
      />
    );

    expect(
      screen.queryByTestId('request-ai-suggestions-btn')
    ).not.toBeInTheDocument();
  });
});
