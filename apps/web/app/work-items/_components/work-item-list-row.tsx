import Link from 'next/link';
import { FileText } from '@repo/ui/lib/icons';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { cn } from '@repo/ui/lib/utils';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import type { Tables } from '@repo/types';

type WorkItemListRowProps = {
  readonly href: string;
  readonly title: string;
  readonly status: Tables<'work_items'>['status'];
  readonly projectKey?: string | null;
  readonly meta?: string | null;
  readonly className?: string;
};

/**
 * Inbox-style work-item row: icon tile, title, and meta line underneath.
 */
export function WorkItemListRow({
  href,
  title,
  status,
  projectKey,
  meta,
  className,
}: Readonly<WorkItemListRowProps>) {
  return (
    <Link
      href={href}
      className={cn(
        'hover:bg-muted/50 flex items-start gap-3 rounded-md px-1.5 py-2.5 transition-colors',
        className
      )}
    >
      <div
        className={cn(
          'bg-muted text-muted-foreground border-border flex size-8 shrink-0',
          'items-center justify-center rounded-lg border'
        )}
      >
        <FileText className="size-4" />
      </div>
      <div className="min-w-0 flex-1 space-y-1">
        <TruncatedText className="text-foreground text-xs font-medium">
          {title}
        </TruncatedText>
        <div className="text-muted-foreground flex flex-wrap items-center gap-2 text-[10px]">
          {projectKey ? (
            <span className="font-mono font-semibold tracking-tight">
              {projectKey}
            </span>
          ) : null}
          <WorkItemStatusBadge status={status} />
          {meta ? <span>{meta}</span> : null}
        </div>
      </div>
    </Link>
  );
}
