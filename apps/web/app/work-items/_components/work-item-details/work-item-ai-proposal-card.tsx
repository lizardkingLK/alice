'use client';

import { useState } from 'react';
import type { WorkItemAiProposalSuggestion } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Bot, Check, Loader2, X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import { DescriptionView } from '@/app/work-items/_components/work-item-description/work-item-description-view';
import { applyWorkItemAiProposal } from '@/app/work-items/_services/work-item-ai-proposals.client';

export type WorkItemAiProposalCardProps = {
  readonly agentName: string;
  readonly suggestions: readonly WorkItemAiProposalSuggestion[];
  readonly workItemId: string;
  readonly currentTitle?: string;
  readonly expectedUpdatedAt: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onApplySuccess: (updatedWorkItem: DbWorkItem) => void;
  readonly onReject: () => void;
};

export function WorkItemAiProposalCard({
  agentName,
  suggestions,
  workItemId,
  currentTitle,
  expectedUpdatedAt,
  onApplySuccess,
  onReject,
}: Readonly<WorkItemAiProposalCardProps>) {
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [status, setStatus] = useState<
    'idle' | 'applying' | 'applied' | 'rejected' | 'error'
  >('idle');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const selectedSuggestion = suggestions[selectedIndex] ?? suggestions[0];

  const handleReject = () => {
    setStatus('rejected');
    setErrorMessage(null);
    onReject();
  };

  const handleApply = async () => {
    if (status === 'applying' || status === 'applied') return;
    if (!selectedSuggestion) return;

    setStatus('applying');
    setErrorMessage(null);

    try {
      const updated = await applyWorkItemAiProposal(workItemId, {
        token: selectedSuggestion.token,
        title: selectedSuggestion.title,
        description: selectedSuggestion.description,
        expectedUpdatedAt,
      });
      setStatus('applied');
      onApplySuccess(updated);
    } catch (err: unknown) {
      const detail =
        err instanceof Error ? err.message : 'Failed to apply suggestion.';
      setErrorMessage(detail);
      setStatus('error');
    }
  };

  if (status === 'rejected') {
    return (
      <div
        className="border-border bg-muted/30 text-muted-foreground rounded-lg border p-3 text-xs"
        data-testid="ai-proposal-rejected"
      >
        AI suggestions dismissed.
      </div>
    );
  }

  if (status === 'applied') {
    return (
      <div
        className="rounded-lg border border-emerald-500/20 bg-emerald-500/5 p-3 text-xs text-emerald-950 dark:text-emerald-300"
        data-testid="ai-proposal-applied"
      >
        <div className="flex items-center gap-1.5 font-medium">
          <Check className="size-4 text-emerald-600 dark:text-emerald-400" />
          AI suggestions applied to work item.
        </div>
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-lg border p-4 shadow-xs',
        'border-emerald-500/30 bg-emerald-500/5 dark:bg-emerald-950/20'
      )}
      data-testid="work-item-ai-proposal-card"
    >
      <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-2">
        <div className="flex items-center gap-2">
          <div className="flex size-6 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
            <Bot className="size-3.5" aria-hidden />
          </div>
          <div>
            <span className="text-foreground text-xs font-semibold">
              AI Suggestions from @{agentName}
            </span>
            <span className="text-muted-foreground ml-1.5 text-[11px]">
              ({suggestions.length} options)
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          disabled={status === 'applying'}
          aria-label="Dismiss suggestions"
          title="Dismiss suggestions"
          onClick={handleReject}
        >
          <X className="size-3.5" />
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-1.5">
        {suggestions.map((suggestion, index) => {
          const isSelected = index === selectedIndex;
          return (
            <Button
              key={suggestion.id}
              type="button"
              variant={isSelected ? 'default' : 'outline'}
              size="xs"
              disabled={status === 'applying'}
              className={cn(
                'text-xs',
                isSelected && 'bg-emerald-600 text-white hover:bg-emerald-700'
              )}
              onClick={() => {
                setSelectedIndex(index);
                setErrorMessage(null);
              }}
            >
              Option {index + 1}
            </Button>
          );
        })}
      </div>

      {selectedSuggestion ? (
        <div className="bg-background/80 space-y-3 rounded-md border p-3 text-xs">
          <div className="space-y-1">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Proposed Title
            </span>
            <p className="text-foreground text-sm font-semibold">
              {selectedSuggestion.title}
            </p>
            {currentTitle && currentTitle !== selectedSuggestion.title ? (
              <p className="text-muted-foreground text-[11px]">
                Original: <span className="line-through">{currentTitle}</span>
              </p>
            ) : null}
          </div>

          <div className="space-y-1 border-t pt-2">
            <span className="text-muted-foreground text-[11px] font-medium tracking-wider uppercase">
              Proposed Description
            </span>
            <div className="bg-muted/20 max-h-60 overflow-y-auto rounded border p-2">
              <DescriptionView
                description={selectedSuggestion.description}
                className="text-xs"
              />
            </div>
          </div>
        </div>
      ) : null}

      {errorMessage ? (
        <p className="text-destructive text-xs" role="alert">
          {errorMessage}
        </p>
      ) : null}

      <div className="flex items-center justify-end gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={status === 'applying'}
          onClick={handleReject}
        >
          Reject
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={status === 'applying' || !selectedSuggestion}
          className="gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700"
          onClick={() => {
            void handleApply();
          }}
        >
          {status === 'applying' ? (
            <>
              <Loader2 className="size-3.5 animate-spin" />
              Applying…
            </>
          ) : (
            <>
              <Check className="size-3.5" />
              Apply
            </>
          )}
        </Button>
      </div>
    </div>
  );
}
