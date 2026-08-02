import { formatLabelWithSpace } from '@/app/_shared/utility';
import { WORK_ITEM_STATUS_ICONS } from '@/app/work-items/_components/work-item-status-icons';
import { WORK_ITEM_STATUS_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-status';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

type WorkItemStatus = DbWorkItem['status'];

type WorkItemStatusBadgeProps = {
  readonly status: WorkItemStatus;
  readonly className?: string;
};

export function WorkItemStatusBadge({
  status,
  className,
}: WorkItemStatusBadgeProps) {
  const Icon = WORK_ITEM_STATUS_ICONS[status];

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 capitalize',
        WORK_ITEM_STATUS_BADGE_STYLES[status],
        className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {formatLabelWithSpace(status)}
    </Badge>
  );
}
