'use client';

import { Button } from '@repo/ui/components/ui/button';
import { LayoutDashboard, Plus } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type ChartsWorkspaceEmptyPanelProps = {
  readonly onCreate: () => void;
  readonly className?: string;
};

/** Centered empty board CTA when the user has no chart workspaces. */
export function ChartsWorkspaceEmptyPanel({
  onCreate,
  className,
}: Readonly<ChartsWorkspaceEmptyPanelProps>) {
  return (
    <div
      className={cn(
        'flex min-h-0 flex-1 flex-col items-center justify-center gap-4 px-6 py-12 text-center',
        className
      )}
    >
      <LayoutDashboard
        className="text-muted-foreground size-10 stroke-[1.5]"
        aria-hidden
      />
      <p className="text-muted-foreground max-w-sm text-sm leading-relaxed">
        To customize charts, create a new workspace.
      </p>
      <Button type="button" className="cursor-pointer gap-2" onClick={onCreate}>
        <Plus className="size-4" data-icon="inline-start" />
        Create Workspace
      </Button>
    </div>
  );
}
