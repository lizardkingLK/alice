'use client';

import { AlertTriangle } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';

interface DismissibleErrorProps {
  readonly message: string | null;
  readonly onDismiss: () => void;
}

/**
 * Inline, dismissible error banner shared by the feature list workspaces.
 * Renders nothing when there is no message.
 */
export function DismissibleError({
  message,
  onDismiss,
}: Readonly<DismissibleErrorProps>) {
  if (!message) {
    return null;
  }

  return (
    <div className="text-destructive bg-destructive/10 border-destructive/20 flex items-center gap-2 rounded-lg border p-3 text-sm">
      <AlertTriangle className="size-4 shrink-0" />
      <span>{message}</span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onDismiss}
        className="ml-auto"
      >
        Dismiss
      </Button>
    </div>
  );
}
