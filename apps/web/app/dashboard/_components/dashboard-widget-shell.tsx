'use client';

import type { ReactNode } from 'react';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { MoreHorizontal } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type DashboardWidgetShellProps = {
  title: string;
  description?: string;
  children: ReactNode;
  className?: string;
  contentClassName?: string;
};

export function DashboardWidgetShell({
  title,
  description,
  children,
  className,
  contentClassName,
}: Readonly<DashboardWidgetShellProps>) {
  return (
    <Card
      className={cn(
        'flex h-full min-h-0 flex-col overflow-hidden shadow-none',
        className
      )}
    >
      <CardHeader className="flex shrink-0 flex-row items-start justify-between gap-3 space-y-0 pb-3">
        <div className="min-w-0 space-y-1">
          <CardTitle className="truncate text-base">{title}</CardTitle>
          {description ? (
            <CardDescription className="line-clamp-1">
              {description}
            </CardDescription>
          ) : null}
        </div>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              aria-label={`Drag ${title}`}
              className="widget-drag-handle text-muted-foreground hover:text-foreground shrink-0 cursor-grab active:cursor-grabbing"
            >
              <MoreHorizontal className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">Hold to drag</TooltipContent>
        </Tooltip>
      </CardHeader>
      <CardContent
        className={cn(
          'flex min-h-0 flex-1 flex-col overflow-hidden pt-0',
          contentClassName
        )}
      >
        {children}
      </CardContent>
    </Card>
  );
}
