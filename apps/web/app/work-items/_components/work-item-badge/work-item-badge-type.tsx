'use client';

import {
  workItemTypeBadgeStyle,
  workItemTypeCardToneStyle,
  workItemTypeIcon,
  workItemTypeIconFromDef,
} from '@/app/work-items/_helpers/work-item-type';
import { useResolvedWorkItemTypeDef } from '@/app/work-items/_hooks/use-resolved-work-item-type-def';
import {
  isUuidWorkItemTypeKey,
  workItemTypeDisplayName,
  type ProjectWorkItemTypeDef,
  type WorkItemType,
} from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

type WorkItemTypeBadgeProps = {
  readonly type: WorkItemType | undefined | null;
  /** Catalog def when known — drives label, icon, and accent color. */
  readonly typeDef?: Pick<
    ProjectWorkItemTypeDef,
    'key' | 'name' | 'icon' | 'color'
  > | null;
  /** Enables client catalog lookup when `typeDef` is not provided. */
  readonly projectId?: string | null;
  readonly className?: string;
  /** Compact uppercase chip used in backlog surfaces. */
  readonly compact?: boolean;
};

type BadgeTypeDef = Pick<
  ProjectWorkItemTypeDef,
  'key' | 'name' | 'icon' | 'color'
>;

function resolveBadgeIcon(
  resolved: BadgeTypeDef | null,
  type: WorkItemType | undefined | null
) {
  if (resolved) {
    return workItemTypeIconFromDef(resolved);
  }
  if (type) {
    return workItemTypeIcon(type);
  }
  return null;
}

export function WorkItemTypeBadge({
  type,
  typeDef = null,
  projectId = null,
  className,
  compact = false,
}: WorkItemTypeBadgeProps) {
  const resolved = useResolvedWorkItemTypeDef({
    projectId,
    type,
    typeDef,
  });
  const label = resolved?.name.trim() || workItemTypeDisplayName(type);
  const Icon = resolveBadgeIcon(resolved, type);
  const customTone =
    resolved && (resolved.color || isUuidWorkItemTypeKey(resolved.key))
      ? workItemTypeCardToneStyle(resolved)
      : null;

  return (
    <Badge
      variant="outline"
      className={cn(
        'gap-1 font-medium',
        type && !customTone && workItemTypeBadgeStyle(type),
        compact && 'h-4 border px-1.5 py-0 text-[9px] uppercase',
        className
      )}
      style={customTone ?? undefined}
    >
      {Icon && (
        <Icon className={cn('shrink-0', compact ? 'size-2.5' : 'size-3')} />
      )}
      {label}
    </Badge>
  );
}
