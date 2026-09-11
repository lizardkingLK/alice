'use client';

import type { ComponentType, SVGProps } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';

type TabIcon = ComponentType<SVGProps<SVGSVGElement>>;

export type RegistryTabOption<T extends string> = {
  readonly id: T;
  readonly label: string;
  readonly icon?: TabIcon;
};

/* eslint-disable no-unused-vars -- generic callback prop types */
interface RegistryTabSwitcherProps<T extends string> {
  readonly tabs: readonly RegistryTabOption<T>[];
  readonly value: T;
  readonly onChange: (nextTab: T) => void;
  readonly 'aria-label'?: string;
}
/* eslint-enable no-unused-vars */

/**
 * Shared icon tab switcher for registry list toolbars (active / archived / …).
 * Matches Flat/Hierarchy: bordered fieldset + secondary/ghost segment buttons.
 */
export function RegistryTabSwitcher<T extends string>({
  tabs,
  value,
  onChange,
  'aria-label': ariaLabel = 'List filter',
}: Readonly<RegistryTabSwitcherProps<T>>) {
  return (
    <fieldset
      className="border-border m-0 flex h-9 min-w-0 items-center rounded-lg border p-0.5"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const isActive = value === tab.id;
        const Icon = tab.icon;
        return (
          <Button
            key={tab.id}
            type="button"
            variant={isActive ? 'secondary' : 'ghost'}
            size="sm"
            className={cn(
              'h-8 cursor-pointer gap-1.5 px-2.5 text-xs',
              isActive && 'font-semibold'
            )}
            aria-pressed={isActive}
            onClick={() => onChange(tab.id)}
          >
            {Icon ? <Icon className="size-3.5 shrink-0" /> : null}
            {tab.label}
          </Button>
        );
      })}
    </fieldset>
  );
}
