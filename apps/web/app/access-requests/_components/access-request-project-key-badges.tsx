import type { ReactNode } from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';

export function AccessRequestProjectKeyBadges({
  keys,
  empty = null,
  className,
}: Readonly<{
  keys: readonly string[];
  empty?: ReactNode;
  className?: string;
}>) {
  if (keys.length === 0) {
    return empty;
  }
  return (
    <div className={cn('flex flex-wrap gap-1', className)}>
      {keys.map((key) => (
        <Badge key={key} variant="outline" className="font-mono text-[11px]">
          {key}
        </Badge>
      ))}
    </div>
  );
}
