'use client';

import { formatDateTime } from '@/app/_shared/utility';
import type { WorkItemWorkLog } from '@repo/types';
import { formatDuration } from '@/app/work-items/_helpers/work-item-time-tracking';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@repo/ui/components/ui/table';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { UserAvatar } from '@/components/user-avatar';
import { useRealtime } from '@/components/realtime/realtime-provider';

type WorkItemWorkLogPanelProps = {
  workLogs: WorkItemWorkLog[];
  currentUserId?: string;
};

export function WorkItemWorkLogPanel({
  workLogs,
  currentUserId,
}: Readonly<WorkItemWorkLogPanelProps>) {
  const { isUserOnline } = useRealtime();

  return (
    <div className="space-y-4">
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
                        <UserAvatar
                          name={log.user?.name}
                          imageUrl={log.user?.profile_picture}
                          title={authorLabel}
                          isOnline={Boolean(
                            log.user?.id && isUserOnline(log.user.id)
                          )}
                        />
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
