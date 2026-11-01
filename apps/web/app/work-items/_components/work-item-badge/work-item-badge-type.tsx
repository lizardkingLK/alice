import {
  workItemTypeBadgeStyle,
  workItemTypeIcon,
} from '@/app/work-items/_helpers/work-item-type';
import type { WorkItemType } from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

type WorkItemTypeBadgeProps = {
  readonly type: WorkItemType | undefined | null;
  readonly className?: string;
  /** Compact uppercase chip used in backlog surfaces. */
  readonly compact?: boolean;
};

export function WorkItemTypeBadge({
  type,
  className,
  compact = false,
}: WorkItemTypeBadgeProps) {
  const Icon = type ? workItemTypeIcon(type) : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        type && workItemTypeBadgeStyle(type),
        compact && 'h-4 border px-1.5 py-0 text-[9px] uppercase',
        className
      )}
    >
      {Icon && (
        <Icon className={cn('shrink-0', compact ? 'size-2.5' : 'size-3')} />
      )}
      {type || 'Unknown'}
    </Badge>
  );
}
