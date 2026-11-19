'use client';

import { Button } from '@repo/ui/components/ui/button';
import { RefreshCw } from '@repo/ui/lib/icons';
import {
  SOFT_INVALIDATE_MESSAGES,
  type SoftInvalidateReason,
} from '@/lib/soft-invalidate/soft-invalidate-messages';

type SoftInvalidateBannerProps = {
  readonly reason: SoftInvalidateReason;
  readonly onRefresh: () => void;
  readonly onDismiss: () => void;
};

export function SoftInvalidateBanner({
  reason,
  onRefresh,
  onDismiss,
}: SoftInvalidateBannerProps) {
  return (
    <output
      data-soft-invalidate-banner={reason}
      className="border-border bg-muted/80 text-foreground flex flex-wrap items-center justify-between gap-3 border-b px-4 py-2 text-sm backdrop-blur-sm"
    >
      <span className="min-w-0 flex-1 leading-snug">
        {SOFT_INVALIDATE_MESSAGES[reason]}
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <Button
          type="button"
          size="sm"
          className="h-8 gap-1.5 text-xs font-semibold"
          onClick={onRefresh}
        >
          <RefreshCw data-icon="inline-start" className="size-3.5" />
          Refresh
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          className="h-8 text-xs"
          onClick={onDismiss}
        >
          Dismiss
        </Button>
      </span>
    </output>
  );
}
