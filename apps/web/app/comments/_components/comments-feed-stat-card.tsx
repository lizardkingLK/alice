'use client';

import type { ReactNode } from 'react';
import { Card, CardContent } from '@repo/ui/components/ui/card';
import { cn } from '@repo/ui/lib/utils';

type CommentsFeedStatCardProps = {
  label: string;
  value: number;
  icon: ReactNode;
  iconClassName: string;
};

export function CommentsFeedStatCard({
  label,
  value,
  icon,
  iconClassName,
}: Readonly<CommentsFeedStatCardProps>) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4">
        <div
          className={cn(
            'flex size-10 shrink-0 items-center justify-center rounded-lg',
            iconClassName
          )}
        >
          {icon}
        </div>
        <div>
          <p className="text-muted-foreground text-xs font-medium">{label}</p>
          <p className="text-foreground text-xl font-bold">{value}</p>
        </div>
      </CardContent>
    </Card>
  );
}
