'use client';

import { useEffect, useRef, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { GitBranch, Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import type { ChatToolActionWire } from '@repo/types/api/v1';
import { applyWorkflowPatch } from '@/app/chat/_services/chat.mutations.client';
import { useWorkflowAliceBridge } from '@/app/projects/_components/project-details/workflow-alice-bridge';
import { useWorkflowProposalDismiss } from '@/app/chat/_components/workflow-proposal-dismiss-context';

type ProposeAction = Extract<
  ChatToolActionWire,
  { type: 'propose_workflow_patch' }
>;

type ChatProposeWorkflowPatchCardProps = {
  readonly action: ProposeAction;
};

export function ChatProposeWorkflowPatchCard({
  action,
}: Readonly<ChatProposeWorkflowPatchCardProps>) {
  const bridge = useWorkflowAliceBridge();
  const { versions } = useWorkflowProposalDismiss();
  const dismissVersion = versions[action.entity.projectId] ?? 0;
  const seenDismissVersion = useRef(dismissVersion);
  const [status, setStatus] = useState<
    'pending' | 'applying' | 'applied' | 'rejected' | 'error'
  >('pending');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (dismissVersion <= seenDismissVersion.current) return;
    seenDismissVersion.current = dismissVersion;
    if (status === 'pending' || status === 'error') {
      setStatus('rejected');
      setError(null);
    }
  }, [dismissVersion, status]);

  const handleReject = () => {
    setStatus('rejected');
    setError(null);
  };

  const handleApply = async () => {
    if (status === 'applying' || status === 'applied') return;
    if (!bridge) {
      setStatus('error');
      setError(
        'Open this project’s Workflow designer so Alice can Apply against the live canvas.'
      );
      return;
    }

    setStatus('applying');
    setError(null);

    try {
      const saved = await bridge.saveIfDirty();
      if (!saved.ok) {
        setStatus('error');
        setError('Could not save unsaved designer changes before Apply.');
        return;
      }

      const result = await applyWorkflowPatch({
        projectId: action.entity.projectId,
        confirmationToken: action.entity.confirmationToken,
        proposedConfig: action.entity.proposedConfig,
        expectedUpdatedAt: saved.expectedUpdatedAt,
      });

      bridge.applyEnvelope(result.config, result.updatedAt);
      setStatus('applied');
    } catch (err: unknown) {
      const detail =
        err instanceof Error ? err.message : 'Failed to apply workflow patch.';
      setError(detail);
      setStatus('error');
    }
  };

  if (status === 'rejected') {
    return (
      <div className="border-border bg-muted/30 text-muted-foreground rounded border p-2.5 text-xs">
        Workflow proposal rejected.
      </div>
    );
  }

  if (status === 'applied') {
    return (
      <div className="dark:text-emerald-350 rounded border border-emerald-500/20 bg-emerald-500/5 p-2.5 text-xs text-emerald-950">
        Workflow proposal applied to{' '}
        <strong>{action.entity.projectName}</strong>.
      </div>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-2 rounded border p-2.5',
        'dark:text-indigo-350 border-indigo-500/20 bg-indigo-500/5 text-indigo-950'
      )}
      data-testid="propose-workflow-patch-card"
    >
      <div className="flex items-start gap-2">
        <GitBranch className="mt-0.5 size-4 shrink-0 text-indigo-500" />
        <div className="min-w-0 flex-1 space-y-1">
          <p className="text-xs">
            Workflow proposal for <strong>{action.entity.projectName}</strong>
            {': '}
            {action.entity.summary}
          </p>
          {action.entity.changeSummary &&
          action.entity.changeSummary.length > 0 ? (
            <ul className="text-muted-foreground list-inside list-disc text-[11px]">
              {action.entity.changeSummary.slice(0, 6).map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
          ) : null}
          {error ? (
            <p className="text-destructive text-[11px]" role="alert">
              {error}
            </p>
          ) : null}
        </div>
      </div>
      <div className="flex items-center justify-end gap-2">
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
          disabled={status === 'applying'}
          onClick={() => {
            void handleApply();
          }}
        >
          {status === 'applying' ? (
            <>
              <Loader2
                data-icon="inline-start"
                className="size-3.5 animate-spin"
              />
              Applying…
            </>
          ) : (
            'Apply'
          )}
        </Button>
      </div>
    </div>
  );
}
