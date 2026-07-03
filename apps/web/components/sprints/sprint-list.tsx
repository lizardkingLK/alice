'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { cn } from '@repo/ui/lib/utils';
import { updateSprintStatus, type Sprint } from '@/lib/api-client';

type SprintListProps = {
  sprints: Sprint[];
  isLoading?: boolean;
  error?: string | null;
  onRetry?: () => void;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
};

const STATUS_STYLES = {
  'Not Started':
    'bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-200 border-zinc-200 dark:border-zinc-700',
  Ongoing:
    'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-300 border-blue-200 dark:border-blue-800',
  Completed:
    'bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800',
  Archived:
    'bg-amber-50 text-amber-700 dark:bg-amber-900/20 dark:text-amber-300 border-amber-200 dark:border-amber-800',
} as const;

const STATUSES = ['Not Started', 'Ongoing', 'Completed', 'Archived'] as const;

type SprintStatusDropdownProps = {
  sprint: Sprint;
  // eslint-disable-next-line no-unused-vars
  onSprintUpdated?: (sprint: Sprint) => void;
};

export function SprintStatusDropdown({
  sprint,
  onSprintUpdated,
}: Readonly<SprintStatusDropdownProps>) {
  const [isUpdating, setIsUpdating] = useState(false);

  const handleStatusChange = async (nextStatus: Sprint['status']) => {
    if (nextStatus === sprint.status) return;
    setIsUpdating(true);
    try {
      const updated = await updateSprintStatus(sprint.id, nextStatus);
      onSprintUpdated?.(updated);
    } catch (error) {
      console.error('Failed to update status:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          disabled={isUpdating}
          className={cn(
            'inline-flex cursor-pointer items-center gap-1 rounded-full border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none disabled:opacity-50',
            STATUS_STYLES[sprint.status]
          )}
        >
          {sprint.status}
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {STATUSES.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusChange(status)}
            className="flex cursor-pointer items-center justify-between"
          >
            {status}
            {status === sprint.status && (
              <span className="h-1.5 w-1.5 rounded-full bg-current" />
            )}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function formatDate(value: string): string {
  const [year, month, day] = value.split('-');

  if (!year || !month || !day) {
    return value;
  }

  return new Date(
    Number(year),
    Number(month) - 1,
    Number(day)
  ).toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

export function SprintList({
  sprints,
  isLoading = false,
  error = null,
  onRetry,
  onSprintUpdated,
}: Readonly<SprintListProps>) {
  return (
    <Card className="h-full">
      <CardHeader>
        <CardTitle>Sprints</CardTitle>
        <CardDescription>
          Active and upcoming sprints for your workspace.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="text-muted-foreground flex min-h-64 items-center justify-center text-sm">
            Loading sprints…
          </div>
        ) : null}

        {!isLoading && error ? (
          <div className="flex min-h-64 flex-col items-center justify-center gap-3 text-center">
            <p className="text-destructive text-sm">{error}</p>
            {onRetry ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRetry}
              >
                Try again
              </Button>
            ) : null}
          </div>
        ) : null}

        {!isLoading && !error && sprints.length === 0 ? (
          <div className="text-muted-foreground bg-muted/30 flex min-h-64 items-center justify-center rounded-lg border border-dashed text-sm">
            No sprints yet. Create your first sprint to get started.
          </div>
        ) : null}

        {!isLoading && !error && sprints.length > 0 ? (
          <ul className="divide-border divide-y rounded-lg border">
            {sprints.map((sprint) => (
              <li key={sprint.id} className="space-y-2 p-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <h3 className="font-medium">{sprint.name}</h3>
                    {sprint.project ? (
                      <span className="bg-secondary text-secondary-foreground ring-secondary/20 inline-flex items-center rounded-md px-1.5 py-0.5 font-mono text-xs font-medium ring-1 ring-inset">
                        {sprint.project.key}
                      </span>
                    ) : null}
                    <SprintStatusDropdown
                      sprint={sprint}
                      onSprintUpdated={onSprintUpdated}
                    />
                  </div>
                  <p className="text-muted-foreground text-sm">
                    {formatDate(sprint.startDate)} –{' '}
                    {formatDate(sprint.endDate)}
                  </p>
                </div>
                {sprint.project ? (
                  <p className="text-muted-foreground text-xs">
                    Project:{' '}
                    <span className="font-medium">{sprint.project.name}</span>
                  </p>
                ) : null}
                {sprint.goal ? (
                  <p className="text-muted-foreground text-sm">{sprint.goal}</p>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}
      </CardContent>
    </Card>
  );
}
