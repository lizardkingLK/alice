'use client';

import { formatDateTime, getInitials } from '@/app/_shared/utility';
import type { WorkItemWorkLog } from '@repo/types';
import { formatDuration } from '@/app/work-items/_helpers/work-item-time-tracking';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { type FormEvent } from 'react';

type WorkItemWorkLogPanelProps = {
  workLogs: WorkItemWorkLog[];
  currentUserId?: string;
  loggedHoursInput: string;
  loggedAtInput: string;
  workLogCommentInput: string;
  isLoggingWork: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onLoggedHoursChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onLoggedAtChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onWorkLogCommentChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onSubmit: (event: FormEvent) => void;
  readOnly?: boolean;
};

export function WorkItemWorkLogPanel({
  workLogs,
  currentUserId,
  loggedHoursInput,
  loggedAtInput,
  workLogCommentInput,
  isLoggingWork,
  onLoggedHoursChange,
  onLoggedAtChange,
  onWorkLogCommentChange,
  onSubmit,
  readOnly = false,
}: Readonly<WorkItemWorkLogPanelProps>) {
  return (
    <div className="space-y-6">
      {readOnly ? null : (
        <form
          onSubmit={onSubmit}
          className="space-y-3 rounded-lg border px-4 pt-4 pb-6"
          aria-label="Work log form"
        >
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1">
              <Label htmlFor="worklog-hours">Log time</Label>
              <Input
                id="worklog-hours"
                type="number"
                step="0.25"
                min={0}
                value={loggedHoursInput}
                onChange={(event) => onLoggedHoursChange(event.target.value)}
                placeholder="e.g. 2.5"
                className="bg-background/80"
                required
              />
            </div>

            <div className="space-y-1">
              <Label htmlFor="worklog-date">Date started</Label>
              <Input
                id="worklog-date"
                type="date"
                value={loggedAtInput}
                onChange={(event) => onLoggedAtChange(event.target.value)}
                className="bg-background/80"
                required
              />
            </div>
          </div>

          <div className="space-y-1">
            <Label htmlFor="worklog-comment">Work description</Label>
            <Textarea
              id="worklog-comment"
              value={workLogCommentInput}
              onChange={(event) => onWorkLogCommentChange(event.target.value)}
              placeholder="What did you work on?"
              className="bg-background/80 min-h-24 resize-none"
            />
          </div>

          <div className="flex items-center justify-end">
            <Button type="submit" disabled={isLoggingWork}>
              {isLoggingWork ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </form>
      )}

      {workLogs.length === 0 ? (
        <p className="text-muted-foreground text-sm">No work logged yet.</p>
      ) : (
        <div className="rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-44">Author</TableHead>
                <TableHead className="w-48">Date</TableHead>
                <TableHead>Comment</TableHead>
                <TableHead className="w-28 text-right">Time spent</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {workLogs.map((log) => {
                const isSelf = log.user?.id === currentUserId;
                const authorLabel = isSelf
                  ? 'You'
                  : (log.user?.name ?? 'Unknown');

                return (
                  <TableRow key={log.id}>
                    <TableCell>
                      <div className="flex items-center gap-2">
                        <Avatar size="sm">
                          {log.user?.profile_picture ? (
                            <AvatarImage
                              src={log.user.profile_picture}
                              alt={authorLabel}
                            />
                          ) : null}
                          <AvatarFallback>
                            {getInitials(log.user?.name)}
                          </AvatarFallback>
                        </Avatar>
                        <span className="text-sm font-medium">
                          {authorLabel}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-muted-foreground text-sm">
                      {formatDateTime(log.logged_at)}
                    </TableCell>
                    <TableCell className="max-w-0">
                      {log.comment ? (
                        <TruncatedText className="text-muted-foreground text-sm">
                          {log.comment}
                        </TruncatedText>
                      ) : (
                        <span className="text-muted-foreground text-sm italic">
                          {'<No comment>'}
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="text-right font-semibold tabular-nums">
                      {formatDuration(log.logged_hours)}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
