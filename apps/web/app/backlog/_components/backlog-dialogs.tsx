'use client';

import { AlertCircle } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { WorkItemForm } from '@/app/work-items/_components/workItem-form';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import type { Project as DbProject } from '@/app/projects/_services/projects.service';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import type { User as DbUser } from '@/app/users/_services/users.service';

const ERROR_ALERT_CLASS =
  'bg-destructive/15 border-destructive/20 text-destructive flex items-center gap-2 rounded-lg border px-4 py-3 text-sm';

type SprintConfirmActionsProps = {
  readonly actionError: string | null;
  readonly isPending: boolean;
  readonly showConfirm: boolean;
  readonly confirmLabel: string;
  readonly pendingLabel: string;
  readonly confirmClassName: string;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
};

function SprintConfirmActions({
  actionError,
  isPending,
  showConfirm,
  confirmLabel,
  pendingLabel,
  confirmClassName,
  onCancel,
  onConfirm,
}: Readonly<SprintConfirmActionsProps>) {
  return (
    <>
      {actionError && (
        <div className={ERROR_ALERT_CLASS}>
          <AlertCircle className="h-5 w-5 shrink-0" />
          <span>{actionError}</span>
        </div>
      )}

      <div className="flex justify-end gap-2 pt-2">
        <Button
          variant="outline"
          size="sm"
          onClick={onCancel}
          disabled={isPending}
        >
          Cancel
        </Button>
        {showConfirm && (
          <Button
            size="sm"
            className={confirmClassName}
            onClick={onConfirm}
            disabled={isPending}
          >
            {isPending ? pendingLabel : confirmLabel}
          </Button>
        )}
      </div>
    </>
  );
}

/* eslint-disable no-unused-vars */
type CreateSprintDialogProps = {
  readonly open: boolean;
  readonly projects: DbProject[];
  readonly currentUserId?: string | null;
  readonly onClose: () => void;
  readonly onCreated: (sprint: Sprint) => void;
};
/* eslint-enable no-unused-vars */

export function BacklogCreateSprintDialog({
  open,
  projects,
  currentUserId,
  onClose,
  onCreated,
}: Readonly<CreateSprintDialogProps>) {
  if (!open) {
    return null;
  }

  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
        <SprintForm
          projects={projects}
          onSprintUpdated={onCreated}
          onClose={onClose}
          onSuccess={onClose}
          currentUserId={currentUserId}
        />
      </div>
    </div>
  );
}

/* eslint-disable no-unused-vars */
type CreateIssueDialogProps = {
  readonly open: boolean;
  readonly projects: DbProject[];
  readonly projectMembers: DbUser[];
  readonly onOpenChange: (open: boolean) => void;
  readonly onClose: () => void;
  readonly onCreated: (workItem: DbWorkItem) => void;
};
/* eslint-enable no-unused-vars */

export function BacklogCreateIssueDialog({
  open,
  projects,
  projectMembers,
  onOpenChange,
  onClose,
  onCreated,
}: Readonly<CreateIssueDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="bg-card border-border/80 backdrop-blur-md sm:max-w-2xl"
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Create Work Item
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Add a new work item and assign it to a team member.
          </DialogDescription>
        </DialogHeader>
        <WorkItemForm
          projects={projects}
          projectMembers={projectMembers}
          onClose={onClose}
          onSuccess={onCreated}
        />
      </DialogContent>
    </Dialog>
  );
}

/* eslint-disable no-unused-vars */
type StartSprintDialogProps = {
  readonly sprint: Sprint | null;
  readonly itemCount: number;
  readonly actionError: string | null;
  readonly isPending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (sprintId: string) => void;
};
/* eslint-enable no-unused-vars */

export function BacklogStartSprintDialog({
  sprint,
  itemCount,
  actionError,
  isPending,
  onOpenChange,
  onConfirm,
}: Readonly<StartSprintDialogProps>) {
  const isEmpty = itemCount === 0;

  return (
    <Dialog open={!!sprint} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 backdrop-blur-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Start Sprint: {sprint?.name}?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Review the sprint details before starting.
          </DialogDescription>
        </DialogHeader>

        {sprint && (
          <div className="space-y-4 py-2">
            {isEmpty ? (
              <div className={ERROR_ALERT_CLASS}>
                <AlertCircle className="h-5 w-5 shrink-0" />
                <span>
                  {"If sprint haven't any work items cannot start the sprint."}
                </span>
              </div>
            ) : (
              <p className="text-foreground text-sm">
                This sprint contains{' '}
                <span className="font-semibold">{itemCount}</span> work items.
                Starting it will change its status to{' '}
                <span className="text-primary font-semibold">Ongoing</span>
                {'.'}
              </p>
            )}

            <SprintConfirmActions
              actionError={actionError}
              isPending={isPending}
              showConfirm={!isEmpty}
              confirmLabel="Start Sprint"
              pendingLabel="Starting..."
              confirmClassName="bg-emerald-600 font-semibold text-white hover:bg-emerald-700"
              onCancel={() => onOpenChange(false)}
              onConfirm={() => onConfirm(sprint.id)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* eslint-disable no-unused-vars */
type CompleteSprintDialogProps = {
  readonly sprint: Sprint | null;
  readonly itemCount: number;
  readonly incompleteCount: number;
  readonly actionError: string | null;
  readonly isPending: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onConfirm: (sprintId: string) => void;
};
/* eslint-enable no-unused-vars */

function CompleteSprintStatus({
  isEmpty,
  hasIncomplete,
  itemCount,
}: Readonly<{
  isEmpty: boolean;
  hasIncomplete: boolean;
  itemCount: number;
}>) {
  if (isEmpty) {
    return (
      <div className={ERROR_ALERT_CLASS}>
        <AlertCircle className="h-5 w-5 shrink-0" />
        <span>
          {"If sprint haven't any work items cannot complete the sprint."}
        </span>
      </div>
    );
  }

  if (hasIncomplete) {
    return (
      <div className="flex items-start gap-2 rounded-lg border border-amber-500/20 bg-amber-500/15 px-4 py-3 text-sm text-amber-600 dark:text-amber-400">
        <AlertCircle className="mt-0.5 h-5 w-5 shrink-0" />
        <div>
          <p className="mb-1 font-semibold">Cannot Complete Sprint</p>
          <p className="text-xs">
            {"Can't complete the sprint all the work items are not done."}
          </p>
        </div>
      </div>
    );
  }

  return (
    <p className="text-foreground text-sm">
      Excellent! All <span className="font-semibold">{itemCount}</span> work
      items in this sprint are completed. Ready to close?
    </p>
  );
}

export function BacklogCompleteSprintDialog({
  sprint,
  itemCount,
  incompleteCount,
  actionError,
  isPending,
  onOpenChange,
  onConfirm,
}: Readonly<CompleteSprintDialogProps>) {
  const isEmpty = itemCount === 0;
  const hasIncomplete = incompleteCount > 0;

  return (
    <Dialog open={!!sprint} onOpenChange={onOpenChange}>
      <DialogContent className="bg-card border-border/80 backdrop-blur-md sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-lg font-bold">
            Complete Sprint: {sprint?.name}?
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            Review incomplete items before completing.
          </DialogDescription>
        </DialogHeader>

        {sprint && (
          <div className="space-y-4 py-2">
            <CompleteSprintStatus
              isEmpty={isEmpty}
              hasIncomplete={hasIncomplete}
              itemCount={itemCount}
            />

            <SprintConfirmActions
              actionError={actionError}
              isPending={isPending}
              showConfirm={!isEmpty && !hasIncomplete}
              confirmLabel="Complete Sprint"
              pendingLabel="Completing..."
              confirmClassName="bg-sky-600 font-semibold text-white hover:bg-sky-700"
              onCancel={() => onOpenChange(false)}
              onConfirm={() => onConfirm(sprint.id)}
            />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

/* eslint-disable no-unused-vars */
type MismatchDialogProps = {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly onAcknowledge: () => void;
};
/* eslint-enable no-unused-vars */

export function BacklogMismatchDialog({
  open,
  onOpenChange,
  onAcknowledge,
}: Readonly<MismatchDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border-border/80 backdrop-blur-md sm:max-w-md"
      >
        <DialogHeader className="flex flex-col items-center pb-2 text-center">
          <div className="bg-destructive/15 mb-2 rounded-full p-3">
            <AlertCircle className="text-destructive h-6 w-6 animate-bounce" />
          </div>
          <DialogTitle className="text-lg font-bold">
            Project Mismatch
          </DialogTitle>
          <DialogDescription className="text-muted-foreground text-xs">
            This task cannot be assigned to this sprint because they belong to
            different projects.
          </DialogDescription>
        </DialogHeader>

        <div className="flex justify-end pt-2">
          <Button
            size="sm"
            className="cursor-pointer"
            onClick={(e) => {
              e.stopPropagation();
              onAcknowledge();
            }}
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
