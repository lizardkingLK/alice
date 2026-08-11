'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { usePathname, useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Layers, Star } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { useFavorites } from '@/lib/favorites/use-favorites';
import { SaveViewDialog } from '@/app/views/_components/save-view-dialog';

type HeaderIconActionProps = {
  readonly label: string;
  readonly disabled?: boolean;
  readonly pressed?: boolean;
  readonly onClick: () => void;
  readonly children: ReactNode;
};

function HeaderIconAction({
  label,
  disabled = false,
  pressed,
  onClick,
  children,
}: Readonly<HeaderIconActionProps>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon"
          className="size-7"
          aria-label={label}
          aria-pressed={pressed}
          disabled={disabled}
          onClick={onClick}
        >
          {children}
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  );
}

type DashboardPageActionsProps = {
  readonly userId: string | null;
  readonly favoriteLabel?: string;
  readonly projectId?: string | null;
  /** Fallback label from breadcrumb last segment when favoriteLabel is omitted. */
  readonly breadcrumbLabel: string;
};

export function DashboardPageActions({
  userId,
  favoriteLabel,
  projectId = null,
  breadcrumbLabel,
}: Readonly<DashboardPageActionsProps>) {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { isFavorited, toggle } = useFavorites(userId);
  const [saveOpen, setSaveOpen] = useState(false);

  const favorited = isFavorited(pathname);
  const label = favoriteLabel?.trim() || breadcrumbLabel.trim() || pathname;
  const search = useMemo(() => searchParams.toString(), [searchParams]);
  const resolvedProjectId = useMemo(() => {
    if (projectId) {
      return projectId;
    }
    const fromQuery = searchParams.get('project');
    if (fromQuery && fromQuery !== 'all') {
      return fromQuery;
    }
    const projectMatch = pathname.match(/^\/projects\/([^/]+)/);
    return projectMatch?.[1] ?? null;
  }, [pathname, projectId, searchParams]);

  const favoriteActionLabel = favorited ? 'Remove favorite' : 'Add favorite';

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <HeaderIconAction
        label={favoriteActionLabel}
        pressed={favorited}
        disabled={!userId}
        onClick={() => toggle(pathname, label)}
      >
        <Star
          className={cn(
            'size-4',
            favorited
              ? 'fill-amber-500 text-amber-500 dark:fill-amber-400 dark:text-amber-400'
              : 'text-amber-500 dark:text-amber-400'
          )}
        />
      </HeaderIconAction>

      <HeaderIconAction
        label="Save view"
        disabled={!userId}
        onClick={() => setSaveOpen(true)}
      >
        <Layers className="size-4" />
      </HeaderIconAction>

      <SaveViewDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        pathname={pathname}
        search={search}
        projectId={resolvedProjectId}
        defaultTitle={label}
      />
    </div>
  );
}
