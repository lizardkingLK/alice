'use client';

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type WheelEvent,
} from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Calendar,
  Flag,
  FolderDot,
  Search,
  Tag,
  UserRound,
  X,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

/**
 * Canonical filter-dialog fields (project…labels) plus board extras
 * (search / priority). Matches WorkItemsFilterFieldId where overlapping.
 */
export type AppliedFilterFieldId =
  | 'project'
  | 'sprint'
  | 'parent'
  | 'assignee'
  | 'status'
  | 'type'
  | 'labels'
  | 'search'
  | 'priority';

export type AppliedFilterBadgeItem = {
  readonly id: string;
  readonly fieldId: AppliedFilterFieldId;
  readonly label: string;
};

type AppliedFilterBadgesProps = {
  readonly items: readonly AppliedFilterBadgeItem[];
  /**
   * Called once after the user pauses removing chips (debounced). May include
   * several ids so parents can apply one URL / fetch update.
   */
  // eslint-disable-next-line no-unused-vars -- chip dismiss batch
  readonly onRemove: (ids: readonly string[]) => void;
  readonly onClearAll: () => void;
  readonly className?: string;
};

/**
 * After the last chip dismiss, wait this long then flush all pending removals
 * in one `onRemove` call (fast burst → 1 request; pauses → another).
 */
export const FILTER_BADGE_REMOVE_DEBOUNCE_MS = 500;

const FIELD_ICONS: Partial<Record<AppliedFilterFieldId, ReactNode>> = {
  search: <Search data-icon="inline-start" />,
  project: <FolderDot data-icon="inline-start" />,
  sprint: <Calendar data-icon="inline-start" />,
  assignee: <UserRound data-icon="inline-start" />,
  priority: <Flag data-icon="inline-start" />,
  labels: <Tag data-icon="inline-start" />,
  type: <Tag data-icon="inline-start" />,
};

const FIELD_BADGE_VARIANT: Partial<
  Record<AppliedFilterFieldId, 'default' | 'secondary' | 'outline'>
> = {
  search: 'outline',
  project: 'secondary',
  sprint: 'secondary',
  assignee: 'secondary',
  priority: 'outline',
  labels: 'secondary',
  type: 'outline',
  parent: 'outline',
  status: 'outline',
};

/** Encode a single label chip id so dismiss can target one label. */
export function appliedFilterLabelChipId(label: string): string {
  return `labels:${label}`;
}

/** Parse a label chip id; returns null when not a labels chip. */
export function parseAppliedFilterLabelChipId(id: string): string | null {
  if (!id.startsWith('labels:')) {
    return null;
  }
  const label = id.slice('labels:'.length);
  return label.length > 0 ? label : null;
}

/**
 * Map vertical mouse-wheel deltas onto horizontal scroll for chip strips
 * (trackpads already send deltaX). Skip when the user is already scrolling
 * horizontally or holding Shift (browser default).
 */
function redirectWheelToHorizontal(event: WheelEvent<HTMLDivElement>) {
  if (event.shiftKey || event.deltaY === 0 || Math.abs(event.deltaX) > 0) {
    return;
  }
  const viewport = event.currentTarget.querySelector(
    '[data-slot="scroll-area-viewport"]'
  );
  if (!(viewport instanceof HTMLElement)) {
    return;
  }
  if (viewport.scrollWidth <= viewport.clientWidth + 1) {
    return;
  }
  event.preventDefault();
  viewport.scrollLeft += event.deltaY;
}

/**
 * Applied-filter badges with per-chip dismiss and clear-all. Sits inline in the
 * toolbar; overflowing chips scroll inside a horizontal ScrollArea (scrollbar
 * hidden). Chip dismiss is optimistic + debounced: rapid X clicks update the
 * strip immediately and flush as one `onRemove(ids)` after a short pause.
 * Prefer the filter dialog for structured bulk edits.
 *
 * Render only when `items` is non-empty.
 */
export function AppliedFilterBadges({
  items,
  onRemove,
  onClearAll,
  className,
}: Readonly<AppliedFilterBadgesProps>) {
  const [pendingRemoveIds, setPendingRemoveIds] = useState(
    () => new Set<string>()
  );
  /** Optimistic hide until props refresh. */
  const uiPendingRef = useRef(new Set<string>());
  /** Ids not yet flushed to `onRemove` (debounced batch). */
  const flushQueueRef = useRef<string[]>([]);
  const debounceTimeoutRef = useRef<number | null>(null);
  const onRemoveRef = useRef(onRemove);
  onRemoveRef.current = onRemove;

  const itemsKey = items.map((item) => item.id).join('|');

  // Drop optimistic ids that are already gone from props (committed refresh).
  useEffect(() => {
    const liveIds = new Set(items.map((item) => item.id));
    const next = new Set(
      [...uiPendingRef.current].filter((id) => liveIds.has(id))
    );
    uiPendingRef.current = next;
    setPendingRemoveIds(next);
  }, [itemsKey, items]);

  useEffect(() => {
    return () => {
      if (debounceTimeoutRef.current != null) {
        window.clearTimeout(debounceTimeoutRef.current);
      }
    };
  }, []);

  const visibleItems = useMemo(
    () => items.filter((item) => !pendingRemoveIds.has(item.id)),
    [items, pendingRemoveIds]
  );

  const flushPendingRemovals = () => {
    if (debounceTimeoutRef.current != null) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    const ids = flushQueueRef.current;
    flushQueueRef.current = [];
    if (ids.length === 0) {
      return;
    }
    onRemoveRef.current(ids);
  };

  const scheduleFlush = () => {
    if (debounceTimeoutRef.current != null) {
      window.clearTimeout(debounceTimeoutRef.current);
    }
    debounceTimeoutRef.current = window.setTimeout(() => {
      debounceTimeoutRef.current = null;
      flushPendingRemovals();
    }, FILTER_BADGE_REMOVE_DEBOUNCE_MS);
  };

  const handleRemove = (id: string) => {
    if (uiPendingRef.current.has(id)) {
      return;
    }
    uiPendingRef.current.add(id);
    flushQueueRef.current.push(id);
    setPendingRemoveIds(new Set(uiPendingRef.current));
    scheduleFlush();
  };

  const handleClearAll = () => {
    if (debounceTimeoutRef.current != null) {
      window.clearTimeout(debounceTimeoutRef.current);
      debounceTimeoutRef.current = null;
    }
    uiPendingRef.current = new Set();
    flushQueueRef.current = [];
    setPendingRemoveIds(new Set());
    onClearAll();
  };

  if (items.length === 0) {
    return null;
  }

  const isFlushPending = pendingRemoveIds.size > 0;

  return (
    <fieldset
      className={cn(
        'm-0 flex max-w-full min-w-0 flex-1 items-center gap-2 overflow-hidden border-0 p-0 py-1',
        isFlushPending && 'opacity-80',
        className
      )}
      aria-label="Applied filters"
      aria-busy={isFlushPending || undefined}
    >
      <ScrollArea
        className={cn(
          'w-full max-w-full min-w-0 whitespace-nowrap',
          '**:data-[slot=scroll-area-scrollbar]:data-[orientation=horizontal]:hidden'
        )}
        type="hover"
        onWheel={redirectWheelToHorizontal}
      >
        <div
          data-slot="applied-filter-badges-strip"
          className="flex w-max items-center gap-1.5 pr-1"
        >
          {visibleItems.map((item) => {
            const variant = FIELD_BADGE_VARIANT[item.fieldId] ?? 'secondary';
            const icon = FIELD_ICONS[item.fieldId];
            return (
              <Badge
                key={item.id}
                variant={variant}
                className="flex max-w-48 shrink-0 items-center gap-1 pr-1"
              >
                {icon}
                <TruncatedText className="max-w-36 text-xs">
                  {item.label}
                </TruncatedText>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  className="size-4 shrink-0 cursor-pointer p-0 hover:bg-transparent"
                  aria-label={`Remove filter ${item.label}`}
                  onClick={() => handleRemove(item.id)}
                >
                  <X className="size-3" />
                </Button>
              </Badge>
            );
          })}
        </div>
      </ScrollArea>

      <TooltipProvider delayDuration={300}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="text-muted-foreground hover:text-foreground size-8 shrink-0 cursor-pointer"
              aria-label="Clear filters"
              onClick={handleClearAll}
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            {isFlushPending ? 'Updating filters…' : 'Clear filters'}
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </fieldset>
  );
}
