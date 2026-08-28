import {
  PRIORITY_BADGE_STYLES,
  PRIORITY_LABELS,
  type WorkItemPriority,
} from '@/app/work-items/_helpers/work-item-priority-ui';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  SignalHigh,
  SignalLow,
  SignalMedium,
  type LucideIcon,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

/**
 * 3-bar representation:
 * - lowest/low => 1 bar
 * - medium => 2 bars
 * - high/highest => 3 bars
 */
function prioritySignalIcon(priority: WorkItemPriority): LucideIcon {
  if (priority === 'medium') {
    return SignalMedium;
  }
  if (priority === 'high' || priority === 'highest') {
    return SignalHigh;
  }
  return SignalLow;
}

export const PriorityBadge = ({ priority }: { priority: WorkItemPriority }) => {
  const Icon = prioritySignalIcon(priority);

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium capitalize',
        PRIORITY_BADGE_STYLES[priority]
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden />
      {PRIORITY_LABELS[priority]}
    </Badge>
  );
};
