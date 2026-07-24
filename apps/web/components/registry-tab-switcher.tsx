'use client';

import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';

export type RegistryTabOption<T extends string> = {
  readonly id: T;
  readonly label: string;
};

/* eslint-disable no-unused-vars -- generic callback prop types */
interface RegistryTabSwitcherProps<T extends string> {
  readonly tabs: readonly RegistryTabOption<T>[];
  readonly value: T;
  readonly onChange: (nextTab: T) => void;
}
/* eslint-enable no-unused-vars */

function tabButtonClass(active: boolean) {
  return cn(
    'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
    active
      ? 'bg-background text-foreground hover:bg-background shadow-sm'
      : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
  );
}

/**
 * Shared pill tab switcher for registry list toolbars (active / archived / …).
 */
export function RegistryTabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
}: Readonly<RegistryTabSwitcherProps<T>>) {
  return (
    <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
      {tabs.map((tab) => (
        <Button
          key={tab.id}
          variant="ghost"
          onClick={() => onChange(tab.id)}
          className={tabButtonClass(value === tab.id)}
        >
          {tab.label}
        </Button>
      ))}
    </div>
  );
}
