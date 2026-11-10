import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { WorkItemAiProposalSuggestion } from '@repo/types';
import { WorkItemAiProposalCard } from '@/app/work-items/_components/work-item-details/work-item-ai-proposal-card';

const applyWorkItemAiProposalMock = vi.fn();

vi.mock('@/app/work-items/_services/work-item-ai-proposals.client', () => ({
  applyWorkItemAiProposal: (...args: unknown[]) =>
    applyWorkItemAiProposalMock(...args),
}));

describe('WorkItemAiProposalCard', () => {
  const suggestions: WorkItemAiProposalSuggestion[] = [
    {
      id: '11111111-1111-4111-8111-111111111111',
      title: 'First suggested title',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'First description content' }],
          },
        ],
      },
      token: 'token-1',
    },
    {
      id: '22222222-2222-4222-8222-222222222222',
      title: 'Second suggested title',
      description: {
        type: 'doc',
        content: [
          {
            type: 'paragraph',
            content: [{ type: 'text', text: 'Second description content' }],
          },
        ],
      },
      token: 'token-2',
    },
  ];

  const defaultProps = {
    agentName: 'Alice',
    suggestions,
    workItemId: 'item-1',
    currentTitle: 'Original title',
    expectedUpdatedAt: '2026-11-10T09:00:00.000Z',
    onApplySuccess: vi.fn(),
    onReject: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders suggestions and defaults to first option', () => {
    render(<WorkItemAiProposalCard {...defaultProps} />);

    expect(screen.getByText('AI Suggestions from @Alice')).toBeInTheDocument();
    expect(screen.getByText('(2 options)')).toBeInTheDocument();
    expect(screen.getByText('First suggested title')).toBeInTheDocument();
    expect(screen.getByText('First description content')).toBeInTheDocument();
    expect(screen.getByText('Original:')).toBeInTheDocument();
  });

  it('switches preview when selecting a different option', () => {
    render(<WorkItemAiProposalCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Option 2' }));

    expect(screen.getByText('Second suggested title')).toBeInTheDocument();
    expect(screen.getByText('Second description content')).toBeInTheDocument();
  });

  it('handles reject button click', () => {
    render(<WorkItemAiProposalCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Reject' }));

    expect(defaultProps.onReject).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId('ai-proposal-rejected')).toBeInTheDocument();
  });

  it('calls apply API with selected suggestion data and calls onApplySuccess', async () => {
    const updatedWorkItem = {
      id: 'item-1',
      title: 'First suggested title',
      updated_at: '2026-11-10T09:05:00.000Z',
    };
    applyWorkItemAiProposalMock.mockResolvedValue(updatedWorkItem);

    render(<WorkItemAiProposalCard {...defaultProps} />);

    const applyBtn = screen.getByRole('button', { name: 'Apply' });
    fireEvent.click(applyBtn);

    await waitFor(() => {
      expect(applyWorkItemAiProposalMock).toHaveBeenCalledWith('item-1', {
        token: 'token-1',
        title: 'First suggested title',
        description: suggestions[0]?.description,
        expectedUpdatedAt: '2026-11-10T09:00:00.000Z',
      });
      expect(defaultProps.onApplySuccess).toHaveBeenCalledWith(updatedWorkItem);
    });

    expect(screen.getByTestId('ai-proposal-applied')).toBeInTheDocument();
  });

  it('applies selected second option when chosen', async () => {
    const updatedWorkItem = {
      id: 'item-1',
      title: 'Second suggested title',
      updated_at: '2026-11-10T09:05:00.000Z',
    };
    applyWorkItemAiProposalMock.mockResolvedValue(updatedWorkItem);

    render(<WorkItemAiProposalCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Option 2' }));
    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(applyWorkItemAiProposalMock).toHaveBeenCalledWith('item-1', {
        token: 'token-2',
        title: 'Second suggested title',
        description: suggestions[1]?.description,
        expectedUpdatedAt: '2026-11-10T09:00:00.000Z',
      });
    });
  });

  it('shows error message when apply fails and stays open', async () => {
    applyWorkItemAiProposalMock.mockRejectedValue(
      new Error(
        'The work item has been modified since this suggestion was generated.'
      )
    );

    render(<WorkItemAiProposalCard {...defaultProps} />);

    fireEvent.click(screen.getByRole('button', { name: 'Apply' }));

    await waitFor(() => {
      expect(
        screen.getByText(
          'The work item has been modified since this suggestion was generated.'
        )
      ).toBeInTheDocument();
    });

    expect(defaultProps.onApplySuccess).not.toHaveBeenCalled();
    expect(screen.queryByTestId('ai-proposal-applied')).not.toBeInTheDocument();
  });
});
