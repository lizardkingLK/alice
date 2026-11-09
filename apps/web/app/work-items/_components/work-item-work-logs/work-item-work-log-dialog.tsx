'use client';

import { type FormEvent } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { calculateWorkLogEntry } from '@/app/work-items/_helpers/work-item-work-log-time';
import { formatDuration } from '@/app/work-items/_helpers/work-item-time-tracking';

type WorkItemWorkLogDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onOpenChange: (open: boolean) => void;
  readonly startAtInput: string;
  readonly endAtInput: string;
  readonly workLogCommentInput: string;
  readonly isLoggingWork: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onStartAtChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onEndAtChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onWorkLogCommentChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onSubmit: (event: FormEvent) => void;
};

export function WorkItemWorkLogDialog({
  open,
  onOpenChange,
  startAtInput,
  endAtInput,
  workLogCommentInput,
  isLoggingWork,
  onStartAtChange,
  onEndAtChange,
  onWorkLogCommentChange,
  onSubmit,
}: Readonly<WorkItemWorkLogDialogProps>) {
  const calculation = calculateWorkLogEntry(startAtInput, endAtInput);
  const durationLabel =
    'loggedHours' in calculation
      ? formatDuration(calculation.loggedHours)
      : 'Choose start and end times';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Log work</DialogTitle>
          <DialogDescription>
            Record time spent on this work item.
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={onSubmit}
          className="space-y-5"
          aria-label="Work log form"
        >
          <div className="grid gap-5 sm:grid-cols-2">
            <div className="space-y-2.5">
              <Label htmlFor="worklog-start">Start date and time</Label>
              <Input
                id="worklog-start"
                type="datetime-local"
                value={startAtInput}
                onChange={(event) => onStartAtChange(event.target.value)}
                className="h-9"
                required
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="worklog-end">End date and time</Label>
              <Input
                id="worklog-end"
                type="datetime-local"
                value={endAtInput}
                onChange={(event) => onEndAtChange(event.target.value)}
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="bg-muted/50 rounded-lg border px-3 py-2.5">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground text-sm">
                Calculated duration
              </span>
              <span className="font-mono text-sm font-semibold tabular-nums">
                {durationLabel}
              </span>
            </div>
            <p className="text-muted-foreground mt-1.5 text-xs">
              Only the start date, calculated duration, and description are
              saved. Start and end times are not stored.
            </p>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="worklog-comment">Work description</Label>
            <Textarea
              id="worklog-comment"
              value={workLogCommentInput}
              onChange={(event) => onWorkLogCommentChange(event.target.value)}
              placeholder="What did you work on?"
              className="min-h-28 resize-none"
              maxLength={2000}
            />
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isLoggingWork}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isLoggingWork}>
              {isLoggingWork ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
