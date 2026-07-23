'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { cn } from '@repo/ui/lib/utils';

export type ListFilterOption = {
  readonly value: string;
  readonly label: string;
};

type ListFilterSelectProps = {
  readonly value: string;
  // eslint-disable-next-line no-unused-vars
  readonly onValueChange: (value: string) => void;
  readonly allValue: string;
  readonly allLabel: string;
  readonly ariaLabel: string;
  readonly placeholder: string;
  readonly options: readonly ListFilterOption[];
  readonly triggerClassName?: string;
};

/**
 * URL-driven list toolbar filter. Callers own navigation via `onValueChange`
 * (typically `useQueryFilter().setFilter`).
 */
export function ListFilterSelect({
  value,
  onValueChange,
  allValue,
  allLabel,
  ariaLabel,
  placeholder,
  options,
  triggerClassName,
}: ListFilterSelectProps) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn(
          'bg-background/50 border-border/80 h-9 w-full',
          triggerClassName
        )}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={allValue}>{allLabel}</SelectItem>
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
