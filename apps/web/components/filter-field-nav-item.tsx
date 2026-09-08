'use client';

import { cn } from '@repo/ui/lib/utils';

type FilterFieldNavItemProps = {
  readonly label: string;
  readonly active: boolean;
  readonly onSelect: () => void;
};

/** Left-rail field picker used by work-items and charts quick filters. */
export function FilterFieldNavItem({
  label,
  active,
  onSelect,
}: Readonly<FilterFieldNavItemProps>) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        'relative flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors',
        active
          ? 'bg-primary/10 text-foreground font-medium'
          : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
      )}
    >
      {active ? (
        <span
          aria-hidden
          className="bg-primary absolute top-1 bottom-1 left-0 w-0.5 rounded-full"
        />
      ) : null}
      {label}
    </button>
  );
}
