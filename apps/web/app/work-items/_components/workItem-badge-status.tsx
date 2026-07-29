import { formatLabelWithSpace } from '@/app/_shared/utility';
import { RendererProps } from '@/app/work-items/_components/workItems-table';
import { WORK_ITEM_STATUS_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-status';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

type WorkItemStatus = DbWorkItem['status'];

export const WorkItemStatusBadge = ({ status }: { status: WorkItemStatus }) => {
  return (
    <Badge
      variant="outline"
      className={cn('capitalize', WORK_ITEM_STATUS_BADGE_STYLES[status])}
    >
      {formatLabelWithSpace(status)}
    </Badge>
  );
};

export default function statusRenderer({ row }: RendererProps) {
  return <WorkItemStatusBadge status={row.original.status} />;
}
