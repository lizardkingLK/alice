'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SprintEstimationAiFailureReason,
  SprintEstimationConfidence,
  SprintEstimationResponse,
  SprintEstimationResult,
  SprintEstimationSource,
} from '@repo/types/api/v1';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { AlertCircle, Loader2, Sparkles } from '@repo/ui/lib/icons';
import { PriorityBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-priority';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';
import { projectDisplayKey } from '@/app/backlog/_helpers/backlog-item-utils';
import type { DbWorkItem } from '@/app/work-items/_services/work-items.reads.server';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';
import { generateSprintEstimates } from '@/app/sprints/_services/sprint-estimation.mutations.client';
import { ApiError } from '@/lib/api/api-fetch.helper';
import {
  SESSION_EXPIRED_MESSAGE,
  isSessionExpiredError,
} from '@/lib/errors/session-expired';

type BacklogSprintEstimationDialogProps = {
  readonly sprint: Sprint | null;
  readonly workItems: readonly DbWorkItem[];
  // eslint-disable-next-line no-unused-vars -- controlled dialog callback
  readonly onOpenChange: (open: boolean) => void;
};

const SOURCE_LABELS: Record<SprintEstimationSource, string> = {
  assignee_history: 'Assignee history',
  similar_history: 'Similar history',
  experience_history: 'Experience history',
  project_history: 'Project history',
  rough_fallback: 'Rough fallback',
};

const FALLBACK_LABELS: Record<SprintEstimationAiFailureReason, string> = {
  cancelled: 'AI request was cancelled',
  configuration: 'AI is not configured',
  invalid_input: 'AI could not process the sprint data',
  invalid_response: 'AI returned an invalid response',
  provider_error: 'AI provider error',
  timeout: 'AI request timed out',
  unsupported_provider: 'Configured AI provider is unsupported',
};

const CONFIDENCE_LABELS: Record<SprintEstimationConfidence, string> = {
  low: 'Low confidence',
  medium: 'Medium confidence',
  high: 'High confidence',
};

function displayError(error: unknown): string {
  if (isSessionExpiredError(error)) {
    return SESSION_EXPIRED_MESSAGE;
  }
  if (error instanceof ApiError) {
    if (error.status === 401) return SESSION_EXPIRED_MESSAGE;
    if (error.status === 403) {
      return 'You do not have permission to estimate this sprint.';
    }
    if (error.status === 404) return 'This sprint is no longer available.';
    if (error.status === 422) {
      return 'A sprint can contain at most 200 estimable work items.';
    }
  }
  return 'Sprint estimates could not be generated. Please try again.';
}

function formatHours(value: number): string {
  return Number.isInteger(value) ? String(value) : value.toFixed(1);
}

function estimateSummary(result: SprintEstimationResponse): string {
  const aiCount = result.estimates.filter(
    (estimate) => estimate.estimationMethod === 'ai'
  ).length;
  const fallbackCount = result.estimates.length - aiCount;
  if (result.aiStatus === 'generated') {
    return `${aiCount} AI-generated ${aiCount === 1 ? 'estimate' : 'estimates'}.`;
  }
  if (result.aiStatus === 'partial_fallback') {
    return `${aiCount} AI-generated and ${fallbackCount} deterministic ${fallbackCount === 1 ? 'estimate' : 'estimates'}.`;
  }
  return `AI was unavailable. ${fallbackCount} deterministic ${fallbackCount === 1 ? 'estimate is' : 'estimates are'} shown.`;
}

function EstimateRow({
  estimate,
  item,
  projectKey,
}: Readonly<{
  estimate: SprintEstimationResult;
  item?: DbWorkItem;
  projectKey?: string;
}>) {
  const fallbackTitle = `Work item ${estimate.workItemId.slice(0, 8).toUpperCase()}`;
  return (
    <TableRow data-testid="sprint-estimate-row">
      <TableCell className="min-w-64 align-top whitespace-normal">
        <div className="space-y-2">
          <div>
            <p
              className="text-foreground font-medium [overflow-wrap:anywhere]"
              data-testid="estimate-work-item-title"
            >
              {item?.title ?? fallbackTitle}
            </p>
            <p className="text-muted-foreground mt-0.5 font-mono text-xs">
              {item
                ? projectDisplayKey(projectKey, item.id)
                : estimate.workItemId}
            </p>
          </div>
          {item ? (
            <div className="flex flex-wrap items-center gap-1.5">
              <WorkItemTypeBadge type={item.type} compact />
              <PriorityBadge priority={item.priority} />
              {item.story_points != null ? (
                <Badge variant="outline">{item.story_points} points</Badge>
              ) : null}
              {item.assignee?.name ? (
                <span className="text-muted-foreground text-xs">
                  {item.assignee.name}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="align-top whitespace-nowrap">
        <p className="text-foreground text-base font-semibold">
          {formatHours(estimate.suggestedHours)}h
        </p>
        <p className="text-muted-foreground text-xs">
          {formatHours(estimate.minimumHours)}–
          {formatHours(estimate.maximumHours)}h range
        </p>
      </TableCell>
      <TableCell className="align-top">
        <Badge variant="outline">
          {CONFIDENCE_LABELS[estimate.confidence]}
        </Badge>
      </TableCell>
      <TableCell className="min-w-48 align-top [overflow-wrap:anywhere] whitespace-normal">
        <div className="space-y-1.5">
          <Badge
            variant={
              estimate.estimationMethod === 'ai' ? 'default' : 'secondary'
            }
          >
            {estimate.estimationMethod === 'ai'
              ? 'AI-generated'
              : 'Deterministic fallback'}
          </Badge>
          <p className="text-muted-foreground text-xs">
            {SOURCE_LABELS[estimate.source]} · {estimate.evidenceCount}{' '}
            {estimate.evidenceCount === 1 ? 'sample' : 'samples'}
          </p>
          {estimate.roughEstimate ? (
            <Badge variant="outline">Rough estimate</Badge>
          ) : null}
          {estimate.fallbackReason ? (
            <p className="text-xs text-amber-700 dark:text-amber-400">
              {FALLBACK_LABELS[estimate.fallbackReason]}
            </p>
          ) : null}
        </div>
      </TableCell>
      <TableCell className="text-muted-foreground min-w-72 align-top text-sm [overflow-wrap:anywhere] whitespace-normal">
        {estimate.rationale}
      </TableCell>
    </TableRow>
  );
}

export function BacklogSprintEstimationDialog({
  sprint,
  workItems,
  onOpenChange,
}: Readonly<BacklogSprintEstimationDialogProps>) {
  const [result, setResult] = useState<SprintEstimationResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const controllerRef = useRef<AbortController | null>(null);
  const requestIdRef = useRef(0);

  const cancelActiveRequest = useCallback(() => {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
  }, []);

  const requestEstimates = useCallback((sprintId: string) => {
    if (controllerRef.current && !controllerRef.current.signal.aborted) {
      return;
    }

    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    controllerRef.current = controller;
    setResult(null);
    setError(null);
    setIsLoading(true);

    generateSprintEstimates(sprintId, controller.signal)
      .then((nextResult) => {
        if (requestIdRef.current === requestId && !controller.signal.aborted) {
          setResult(nextResult);
        }
      })
      .catch((requestError: unknown) => {
        if (requestIdRef.current === requestId && !controller.signal.aborted) {
          setError(displayError(requestError));
        }
      })
      .finally(() => {
        if (requestIdRef.current === requestId) {
          controllerRef.current = null;
          setIsLoading(false);
        }
      });
  }, []);

  const sprintId = sprint?.id;

  useEffect(() => {
    if (!sprintId) {
      cancelActiveRequest();
      setResult(null);
      setError(null);
      setIsLoading(false);
      return;
    }

    requestEstimates(sprintId);
    return cancelActiveRequest;
  }, [sprintId, cancelActiveRequest, requestEstimates]);

  const workItemsById = useMemo(
    () => new Map(workItems.map((item) => [item.id, item])),
    [workItems]
  );
  const visibleResult =
    sprint && result?.sprintId === sprint.id ? result : null;

  const handleOpenChange = (open: boolean) => {
    if (!open) cancelActiveRequest();
    onOpenChange(open);
  };

  return (
    <Dialog open={Boolean(sprint)} onOpenChange={handleOpenChange}>
      <DialogContent className="flex max-h-[calc(100dvh-2rem)] min-w-0 flex-col overflow-hidden sm:max-w-5xl">
        <DialogHeader className="min-w-0 shrink-0">
          <div className="flex min-w-0 items-center gap-2">
            <span className="bg-primary/10 text-primary shrink-0 rounded-md p-1.5">
              <Sparkles className="size-4" aria-hidden />
            </span>
            <DialogTitle className="min-w-0 [overflow-wrap:anywhere]">
              Estimate {sprint?.name ?? 'sprint'}
            </DialogTitle>
          </div>
          <DialogDescription className="[overflow-wrap:anywhere]">
            {sprint?.project?.name ? `${sprint.project.name} · ` : ''}
            Read-only planning estimates. No work-item values will be changed.
          </DialogDescription>
        </DialogHeader>

        {isLoading ? (
          <div
            role="status"
            aria-live="polite"
            className="text-muted-foreground flex min-h-64 flex-col items-center justify-center gap-3 text-center"
          >
            <Loader2 className="text-primary size-7 animate-spin" aria-hidden />
            <div>
              <p className="text-foreground font-medium">
                Generating estimates…
              </p>
              <p className="mt-1 text-xs">
                Alice is comparing this sprint with historical work.
              </p>
            </div>
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="space-y-4 py-8 text-center">
            <div
              role="alert"
              className="border-destructive/30 bg-destructive/10 text-destructive mx-auto flex max-w-xl items-start gap-2 rounded-lg border p-3 text-left text-sm"
            >
              <AlertCircle className="mt-0.5 size-4 shrink-0" aria-hidden />
              <span>{error}</span>
            </div>
            {sprint ? (
              <Button
                type="button"
                variant="outline"
                onClick={() => requestEstimates(sprint.id)}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && visibleResult?.aiStatus === 'empty' ? (
          <div className="text-muted-foreground flex min-h-52 flex-col items-center justify-center gap-2 rounded-lg border border-dashed text-center">
            <Sparkles className="size-7 opacity-50" aria-hidden />
            <p className="text-foreground font-medium">
              No estimable work items in this sprint.
            </p>
            <p className="text-xs">
              Add work items, then try estimation again.
            </p>
          </div>
        ) : null}

        {!isLoading && !error && visibleResult?.estimates.length ? (
          <div className="flex min-h-0 min-w-0 flex-col gap-3">
            <div
              role="status"
              aria-live="polite"
              className="border-border bg-muted/40 min-w-0 shrink-0 rounded-lg border px-3 py-2 text-sm [overflow-wrap:anywhere]"
            >
              {estimateSummary(visibleResult)}
            </div>
            <div
              className="max-h-[min(58dvh,34rem)] min-h-0 w-full max-w-full min-w-0 overflow-auto rounded-lg border"
              data-testid="sprint-estimate-table-scroll"
            >
              <div className="min-w-[64rem]">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Work item</TableHead>
                      <TableHead>Suggested hours</TableHead>
                      <TableHead>Confidence</TableHead>
                      <TableHead>Method and evidence</TableHead>
                      <TableHead>Explanation</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {visibleResult.estimates.map((estimate) => (
                      <EstimateRow
                        key={estimate.workItemId}
                        estimate={estimate}
                        item={workItemsById.get(estimate.workItemId)}
                        projectKey={sprint?.project?.key}
                      />
                    ))}
                  </TableBody>
                </Table>
              </div>
            </div>
          </div>
        ) : null}

        <DialogFooter className="shrink-0" data-testid="sprint-estimate-footer">
          <DialogClose asChild>
            <Button type="button" variant="outline">
              Close
            </Button>
          </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
