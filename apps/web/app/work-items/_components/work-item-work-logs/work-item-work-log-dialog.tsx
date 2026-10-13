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

type WorkItemWorkLogDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onOpenChange: (open: boolean) => void;
  readonly loggedHoursInput: string;
  readonly loggedAtInput: string;
  readonly workLogCommentInput: string;
  readonly isLoggingWork: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onLoggedHoursChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onLoggedAtChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onWorkLogCommentChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onSubmit: (event: FormEvent) => void;
};

export function WorkItemWorkLogDialog({
  open,
  onOpenChange,
  loggedHoursInput,
  loggedAtInput,
  workLogCommentInput,
  isLoggingWork,
  onLoggedHoursChange,
  onLoggedAtChange,
  onWorkLogCommentChange,
  onSubmit,
}: Readonly<WorkItemWorkLogDialogProps>) {
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
              <Label htmlFor="worklog-hours">Log time (hrs)</Label>
              <Input
                id="worklog-hours"
                type="number"
                step="0.25"
                min={0}
                value={loggedHoursInput}
                onChange={(event) => onLoggedHoursChange(event.target.value)}
                placeholder="e.g. 2.5"
                className="h-9"
                required
              />
            </div>

            <div className="space-y-2.5">
              <Label htmlFor="worklog-date">Date started</Label>
              <Input
                id="worklog-date"
                type="date"
                value={loggedAtInput}
                onChange={(event) => onLoggedAtChange(event.target.value)}
                className="h-9"
                required
              />
            </div>
          </div>

          <div className="space-y-2.5">
            <Label htmlFor="worklog-comment">Work description</Label>
            <Textarea
              id="worklog-comment"
              value={workLogCommentInput}
              onChange={(event) => onWorkLogCommentChange(event.target.value)}
              placeholder="What did you work on?"
              className="min-h-28 resize-none"
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
