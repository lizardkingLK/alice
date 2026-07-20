import { formatLabelWithSpace } from '@/app/_shared/utility';
import { RendererProps } from '@/app/work-items/_components/workItems-table';
import { DbWorkItem } from '@/app/work-items/_services/workItem.server.service';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

type WorkItemStatus = DbWorkItem['status'];

const STATUS_STYLES: Record<WorkItemStatus, string> = {
  Draft: 'border-muted-foreground/20 bg-muted text-muted-foreground',
  New: 'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400',
  ToDo: 'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400',
  InProgress:
    'border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400',
  Testing: 'border-cyan-500/20 bg-cyan-500/10 text-cyan-600 dark:text-cyan-400',
  Done: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
};

export const WorkItemStatusBadge = ({ status }: { status: WorkItemStatus }) => {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', STATUS_STYLES[status])}
    >
      {formatLabelWithSpace(status)}
    </Badge>
  );
};

export default function statusRenderer({ row }: RendererProps) {
  return <WorkItemStatusBadge status={row.original.status} />;
}
