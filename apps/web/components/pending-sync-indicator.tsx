'use client';

import { Loader2 } from '@repo/ui/lib/icons';

type PendingSyncIndicatorProps = {
  readonly active: boolean;
  readonly label?: string;
};

/**
 * Toolbar chrome for in-flight DnD / workspace sync (charts Saving… pattern).
 */
export function PendingSyncIndicator({
  active,
  label = 'Saving…',
}: Readonly<PendingSyncIndicatorProps>) {
  if (!active) {
    return null;
  }

  return (
    <div
      className="text-muted-foreground flex items-center gap-2 text-sm"
      role="status"
      aria-live="polite"
    >
      <Loader2 className="size-4 animate-spin" aria-hidden />
      <span>{label}</span>
    </div>
  );
}
