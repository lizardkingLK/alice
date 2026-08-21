import { formatLabelWithSpace } from '@/app/_shared/utility';
import { WORK_ITEM_STATUS_ICONS } from '@/app/work-items/_components/work-item-status-icons';
import { WORK_ITEM_STATUS_BADGE_STYLES } from '@/app/work-items/_helpers/work-item-status';
import { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

type WorkItemStatus = DbWorkItem['status'];

type WorkItemStatusBadgeProps = {
  readonly status: WorkItemStatus | undefined | null;
  readonly className?: string;
};

export function WorkItemStatusBadge({
  status,
  className,
}: WorkItemStatusBadgeProps) {
  const Icon = status ? WORK_ITEM_STATUS_ICONS[status] : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 capitalize',
        status && WORK_ITEM_STATUS_BADGE_STYLES[status],
        className
      )}
    >
      {Icon && <Icon className="size-3 shrink-0" aria-hidden />}
      {status ? formatLabelWithSpace(status) : 'Unknown'}
    </Badge>
  );
}
