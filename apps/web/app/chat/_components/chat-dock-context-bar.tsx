'use client';

import { MapPin, Workflow, X, type LucideIcon } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { Button } from '@repo/ui/components/ui/button';
import type { ChatViewContext } from '@repo/types/api/v1';
import {
  DEFAULT_FAVORITE_NAV_ICON,
  resolveDashboardNavItem,
  resolveDashboardNavLabel,
} from '@/lib/dashboard/nav-registry';

export type ChatDockPageContext = {
  readonly pathname: string;
  readonly label: string;
  readonly Icon: LucideIcon;
};

export function captureChatDockPageContext(
  pathname: string
): ChatDockPageContext {
  const match = resolveDashboardNavItem(pathname);
  return {
    pathname,
    label: match?.label ?? resolveDashboardNavLabel(pathname),
    Icon: match?.icon ?? DEFAULT_FAVORITE_NAV_ICON,
  };
}

type ChatDockContextBarProps = {
  readonly pageContext: ChatDockPageContext | null;
  readonly viewContext: ChatViewContext | null;
  readonly className?: string;
  readonly onDismiss?: () => void;
};

/**
 * Jira-Rovo-style context chip strip above the composer: page Alice was opened
 * on, plus richer feature context when a surface bridge is registered.
 */
export function ChatDockContextBar({
  pageContext,
  viewContext,
  className,
  onDismiss,
}: Readonly<ChatDockContextBarProps>) {
  if (!pageContext && !viewContext) {
    return null;
  }

  const PageIcon = pageContext?.Icon ?? DEFAULT_FAVORITE_NAV_ICON;
  const isWorkflow = viewContext?.surface === 'workflow_designer';

  return (
    <div
      className={cn(
        'bg-muted/60 text-muted-foreground flex shrink-0 items-center gap-2 rounded-lg px-2.5 py-1.5 text-xs',
        className
      )}
      data-testid="alice-dock-context"
    >
      <MapPin className="size-3.5 shrink-0" aria-hidden />
      <span className="text-foreground/80 shrink-0 font-medium">Context:</span>
      <div className="flex min-w-0 flex-1 flex-wrap items-center gap-1.5">
        {pageContext ? (
          <span className="bg-background text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5">
            <PageIcon className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">{pageContext.label}</span>
          </span>
        ) : null}
        {isWorkflow ? (
          <span className="bg-background text-foreground inline-flex max-w-full items-center gap-1.5 rounded-full border px-2 py-0.5">
            <Workflow className="size-3.5 shrink-0" aria-hidden />
            <span className="truncate">Workflow designer</span>
          </span>
        ) : null}
      </div>
      {onDismiss ? (
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          className="size-6 shrink-0"
          aria-label="Dismiss context"
          onClick={onDismiss}
        >
          <X className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}
