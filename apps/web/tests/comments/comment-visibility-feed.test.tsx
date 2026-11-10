import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import type { JSONContent } from '@tiptap/react';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { CommentsFeed } from '@/app/comments/_components/comments-feed';
import { commentFactory } from '../factories/comment.factory';
import {
  hiddenCommentsStorageKey,
  writeHiddenCommentIds,
} from '@/app/comments/_helpers/comment-visibility-storage';

const generateWorkItemAiProposalsMock = vi.fn();

vi.mock('@/app/work-items/_services/work-item-ai-proposals.client', () => ({
  generateWorkItemAiProposals: (...args: unknown[]) =>
    generateWorkItemAiProposalsMock(...args),
  applyWorkItemAiProposal: vi.fn(),
}));

vi.mock('@/components/realtime/realtime-provider', () => ({
  useRealtime: () => ({ isUserOnline: () => false }),
}));

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    refresh: vi.fn(),
    push: vi.fn(),
  }),
}));

vi.mock('@/app/chat/_services/chat-agents.reads.client', () => ({
  listChatAgentsClient: vi.fn().mockResolvedValue([
    {
      id: '33333333-3333-4333-8333-333333333333',
      name: 'DevBot',
      slug: 'devbot',
      description: 'AI Coding Assistant',
      status: 'active',
    },
  ]),
}));

vi.mock('@/lib/supabase/client', () => {
  const mockQueryBuilder = {
    eq: vi.fn().mockImplementation(() => mockQueryBuilder),
    in: vi.fn().mockImplementation(() => mockQueryBuilder),
    order: vi
      .fn()
      .mockImplementation(() => Promise.resolve({ data: [], error: null })),
    maybeSingle: vi
      .fn()
      .mockImplementation(() => Promise.resolve({ data: null, error: null })),
    then: (resolve: () => void) => resolve(),
  };

  const mockSelect = vi.fn().mockImplementation(() => mockQueryBuilder);
  const mockFrom = vi.fn().mockImplementation(() => ({ select: mockSelect }));

  return {
    createClient: vi.fn(() => ({
      from: mockFrom,
      auth: {
        getUser: vi
          .fn()
          .mockResolvedValue({ data: { user: null }, error: null }),
      },
      channel: vi.fn(() => ({
        on: vi.fn().mockReturnThis(),
        subscribe: vi.fn(),
      })),
      removeChannel: vi.fn(),
    })),
  };
});

vi.mock(
  '@repo/ui/components/ui/dropdown-menu',
  () => import('../mocks/dropdown-menu')
);

vi.mock('@/app/comments/_components/actions', () => ({
  createCommentAction: vi.fn(),
}));

describe('CommentsFeed AI Discussion Private Hiding', () => {
  const AUTHOR_ID = '11111111-1111-4111-8111-111111111111';
  const OTHER_USER_ID = '22222222-2222-4222-8222-222222222222';
  const WORK_ITEM_ID = '99999999-9999-4999-8999-999999999999';

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
            text: ' can you suggest a title for this feature?',
          },
        ],
      },
    ],
  };

  const plainCommentDoc: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Regular human discussion comment' }],
      },
    ],
  };

  beforeEach(() => {
    window.localStorage.clear();
    vi.clearAllMocks();
  });

  function renderFeed(ui: React.ReactElement) {
    return render(<TooltipProvider>{ui}</TooltipProvider>);
  }

  it('renders "Hide thread from my view" for the author of an AI discussion parent comment', () => {
    const parent = commentFactory.build({
      id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    renderFeed(
      <CommentsFeed
        initialComments={[parent]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    const hideBtn = screen.getByTestId('hide-comment-btn');
    expect(hideBtn).toBeInTheDocument();
    expect(hideBtn).toHaveTextContent('Hide thread from my view');
  });

  it('does NOT render hide option for a non-author viewing the AI discussion comment', () => {
    const parent = commentFactory.build({
      id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    renderFeed(
      <CommentsFeed
        initialComments={[parent]}
        workItems={[]}
        currentUserId={OTHER_USER_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    expect(screen.queryByTestId('hide-comment-btn')).not.toBeInTheDocument();
  });

  it('does NOT render hide option for normal comments without AI agent mentions', () => {
    const plainComment = commentFactory.build({
      id: 'comment-plain-1',
      author_id: AUTHOR_ID,
      content: plainCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    renderFeed(
      <CommentsFeed
        initialComments={[plainComment]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    expect(screen.queryByTestId('hide-comment-btn')).not.toBeInTheDocument();
  });

  it('hides parent comment AND its replies from the feed when parent is hidden, displaying toggle', () => {
    const parent = commentFactory.build({
      id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });
    const reply = commentFactory.build({
      id: 'reply-1',
      parent_id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: plainCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    renderFeed(
      <CommentsFeed
        initialComments={[parent, reply]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    // Initial state: both comments exist
    expect(screen.getByText(/suggest a title/i)).toBeInTheDocument();
    expect(
      screen.getByText(/Regular human discussion comment/i)
    ).toBeInTheDocument();

    // Click hide on parent
    const hideBtn = screen.getAllByTestId('hide-comment-btn')[0]!;
    fireEvent.click(hideBtn);

    // Parent AND reply are hidden
    expect(screen.queryByText(/suggest a title/i)).not.toBeInTheDocument();
    expect(
      screen.queryByText(/Regular human discussion comment/i)
    ).not.toBeInTheDocument();

    // Toggle button is displayed with count
    const toggleBtn = screen.getByTestId('toggle-hidden-comments-btn');
    expect(toggleBtn).toBeInTheDocument();
    expect(toggleBtn).toHaveTextContent('1 item hidden for you');

    // Storage key contains parent id
    const stored = window.localStorage.getItem(
      hiddenCommentsStorageKey(AUTHOR_ID)
    );
    expect(stored).toContain('parent-ai-1');
  });

  it('hides only the specific reply when a reply is hidden, keeping parent in view', () => {
    const parent = commentFactory.build({
      id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });
    const replyA = commentFactory.build({
      id: 'reply-a',
      parent_id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Reply A text' }],
          },
        ],
      },
      work_item_id: WORK_ITEM_ID,
    });
    const replyB = commentFactory.build({
      id: 'reply-b',
      parent_id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Reply B text' }],
          },
        ],
      },
      work_item_id: WORK_ITEM_ID,
    });

    renderFeed(
      <CommentsFeed
        initialComments={[parent, replyA, replyB]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    // Find all hide buttons (parent, replyA, replyB)
    const hideButtons = screen.getAllByTestId('hide-comment-btn');
    expect(hideButtons).toHaveLength(3);

    // Click hide on replyA (second button)
    fireEvent.click(hideButtons[1]!);

    // Parent is still visible
    expect(screen.getByText(/suggest a title/i)).toBeInTheDocument();
    // Reply B is still visible
    expect(screen.getByText('Reply B text')).toBeInTheDocument();
    // Reply A is hidden
    expect(screen.queryByText('Reply A text')).not.toBeInTheDocument();
  });

  it('reveals hidden items with badge and Unhide button when clicking toggle, and unhiding restores it', () => {
    const parent = commentFactory.build({
      id: 'parent-ai-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    // Seed localStorage as already hidden
    writeHiddenCommentIds(AUTHOR_ID, ['parent-ai-1']);

    renderFeed(
      <CommentsFeed
        initialComments={[parent]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    // Initially hidden
    expect(screen.queryByText(/suggest a title/i)).not.toBeInTheDocument();
    const toggleBtn = screen.getByTestId('toggle-hidden-comments-btn');
    expect(toggleBtn).toHaveTextContent('1 item hidden for you');

    // Click toggle to reveal hidden items
    fireEvent.click(toggleBtn);

    // Now parent is displayed with hidden badge
    expect(screen.getByText(/suggest a title/i)).toBeInTheDocument();
    expect(screen.getByTestId('hidden-comment-badge')).toHaveTextContent(
      'Hidden from your view'
    );

    // Click Unhide
    const unhideBtn = screen.getByTestId('unhide-comment-btn');
    expect(unhideBtn).toBeInTheDocument();
    fireEvent.click(unhideBtn);

    // Badge is gone, toggle button is gone, comment remains visible
    expect(
      screen.queryByTestId('hidden-comment-badge')
    ).not.toBeInTheDocument();
    expect(
      screen.queryByTestId('toggle-hidden-comments-btn')
    ).not.toBeInTheDocument();
    expect(screen.getByText(/suggest a title/i)).toBeInTheDocument();
  });

  it('restores hidden comment state from localStorage on initial render (reload persistence)', () => {
    const parent = commentFactory.build({
      id: 'parent-persisted-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    // Write to localStorage prior to render
    writeHiddenCommentIds(AUTHOR_ID, ['parent-persisted-1']);

    renderFeed(
      <CommentsFeed
        initialComments={[parent]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    // Should already be hidden without any user click
    expect(screen.queryByText(/suggest a title/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('toggle-hidden-comments-btn')).toHaveTextContent(
      '1 item hidden for you'
    );
  });

  it('verifies the full flow: mention -> generate -> preview -> hide thread privately', async () => {
    const parent = commentFactory.build({
      id: 'parent-flow-1',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    generateWorkItemAiProposalsMock.mockResolvedValueOnce({
      suggestions: [
        {
          id: 'sug-1',
          title: 'Refined Title 1',
          description: plainCommentDoc,
          token: 'test-token-1',
        },
      ],
    });

    renderFeed(
      <CommentsFeed
        initialComments={[parent]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
        currentWorkItemTitle="Original Title"
        currentWorkItemUpdatedAt="2026-11-10T10:00:00.000Z"
      />
    );

    // 1. Suggest button from agent mention
    const suggestBtn = screen.getByTestId('request-ai-suggestions-btn');
    expect(suggestBtn).toHaveTextContent('Suggest with @DevBot');

    // 2. Request proposals
    fireEvent.click(suggestBtn);
    expect(generateWorkItemAiProposalsMock).toHaveBeenCalledWith(WORK_ITEM_ID, {
      agentId: '33333333-3333-4333-8333-333333333333',
      commentIds: ['parent-flow-1'],
    });

    // 3. Proposal card appears
    const proposalCard = await screen.findByTestId(
      'work-item-ai-proposal-card'
    );
    expect(proposalCard).toBeInTheDocument();
    expect(screen.getByText('Refined Title 1')).toBeInTheDocument();

    // 4. Hide the AI discussion thread privately
    const hideBtn = screen.getByTestId('hide-comment-btn');
    fireEvent.click(hideBtn);

    // Proposal card dismissed and thread hidden
    expect(
      screen.queryByTestId('work-item-ai-proposal-card')
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/suggest a title/i)).not.toBeInTheDocument();
    expect(screen.getByTestId('toggle-hidden-comments-btn')).toHaveTextContent(
      '1 item hidden for you'
    );
  });

  it('switches hidden state and resets active proposal card when currentUserId changes (user switch / logout)', async () => {
    writeHiddenCommentIds(AUTHOR_ID, ['comment-author-hidden']);
    writeHiddenCommentIds(OTHER_USER_ID, ['comment-other-hidden']);

    const commentA = commentFactory.build({
      id: 'comment-author-hidden',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });
    const commentB = commentFactory.build({
      id: 'comment-other-hidden',
      author_id: OTHER_USER_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    const { rerender } = render(
      <TooltipProvider>
        <CommentsFeed
          initialComments={[commentA, commentB]}
          workItems={[]}
          currentUserId={AUTHOR_ID}
          workItemId={WORK_ITEM_ID}
        />
      </TooltipProvider>
    );

    // For AUTHOR_ID: commentA is hidden, commentB is visible
    expect(screen.queryByText(/suggest a title/i)).toBeInTheDocument();
    expect(screen.getByTestId('toggle-hidden-comments-btn')).toHaveTextContent(
      '1 item hidden for you'
    );

    // Switch user to OTHER_USER_ID
    rerender(
      <TooltipProvider>
        <CommentsFeed
          initialComments={[commentA, commentB]}
          workItems={[]}
          currentUserId={OTHER_USER_ID}
          workItemId={WORK_ITEM_ID}
        />
      </TooltipProvider>
    );

    // For OTHER_USER_ID: commentB is hidden, commentA is visible
    expect(screen.getByTestId('toggle-hidden-comments-btn')).toHaveTextContent(
      '1 item hidden for you'
    );

    // Switch user to undefined (logged out)
    rerender(
      <TooltipProvider>
        <CommentsFeed
          initialComments={[commentA, commentB]}
          workItems={[]}
          currentUserId={undefined}
          workItemId={WORK_ITEM_ID}
        />
      </TooltipProvider>
    );

    // For logged out user: no items hidden
    expect(
      screen.queryByTestId('toggle-hidden-comments-btn')
    ).not.toBeInTheDocument();
  });

  it('dismisses active proposal card when hiding parent thread even if proposal was requested from a reply', async () => {
    const parent = commentFactory.build({
      id: 'parent-thread-rep',
      author_id: AUTHOR_ID,
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });
    const reply = commentFactory.build({
      id: 'reply-rep-1',
      author_id: AUTHOR_ID,
      parent_id: 'parent-thread-rep',
      content: agentCommentDoc,
      work_item_id: WORK_ITEM_ID,
    });

    generateWorkItemAiProposalsMock.mockResolvedValueOnce({
      suggestions: [
        {
          id: 'sug-from-reply',
          title: 'Reply Suggestion',
          description: plainCommentDoc,
          token: 'token-reply',
        },
      ],
    });

    renderFeed(
      <CommentsFeed
        initialComments={[parent, reply]}
        workItems={[]}
        currentUserId={AUTHOR_ID}
        workItemId={WORK_ITEM_ID}
      />
    );

    // Find the reply's suggestion button and trigger generation
    const suggestButtons = screen.getAllByTestId('request-ai-suggestions-btn');
    expect(suggestButtons).toHaveLength(2);
    fireEvent.click(suggestButtons[1]!); // Reply button

    const proposalCard = await screen.findByTestId(
      'work-item-ai-proposal-card'
    );
    expect(proposalCard).toBeInTheDocument();
    expect(screen.getByText('Reply Suggestion')).toBeInTheDocument();

    // Now hide the parent thread
    const hideButtons = screen.getAllByTestId('hide-comment-btn');
    fireEvent.click(hideButtons[0]!); // Parent hide button

    // Proposal card should be dismissed because parent thread was hidden
    expect(
      screen.queryByTestId('work-item-ai-proposal-card')
    ).not.toBeInTheDocument();
  });
});
