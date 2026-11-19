'use client';

import { Button } from '@repo/ui/components/ui/button';
import { Plus, StickyNote } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type NotesEmptyStateProps = {
  readonly onCreate: () => void;
  readonly className?: string;
  readonly iconClassName?: string;
};

export function NotesEmptyState({
  onCreate,
  className,
  iconClassName,
}: Readonly<NotesEmptyStateProps>) {
  return (
    <div
      className={cn(
        'text-muted-foreground flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-4 text-center',
        className
      )}
    >
      <StickyNote
        className={cn('size-10 opacity-60', iconClassName)}
        aria-hidden
      />
      <p className="text-sm">
        Capture personal notes with rich text. They stay in this browser.
      </p>
      <Button
        type="button"
        size="sm"
        className="cursor-pointer"
        onClick={onCreate}
      >
        <Plus data-icon="inline-start" />
        New note
      </Button>
    </div>
  );
}
