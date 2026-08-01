'use client';

import {
  SearchableSelect,
  type SearchableSelectOption,
} from '@/components/searchable-select';
import { cn } from '@repo/ui/lib/utils';

export type ListFilterOption = SearchableSelectOption;

type ListFilterSelectProps = {
  readonly value: string;
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  readonly onValueChange: (value: string) => void;
  readonly allValue: string;
  readonly allLabel: string;
  readonly ariaLabel: string;
  readonly placeholder: string;
  readonly options: readonly ListFilterOption[];
  readonly triggerClassName?: string;
  /** When false, omit the "All …" option (e.g. role-locked board filters). */
  readonly showAllOption?: boolean;
};

/**
 * URL-driven list toolbar filter. Callers own navigation via `onValueChange`
 * (typically `useQueryFilter().setFilter`). Searchable for long option lists.
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
  showAllOption = true,
}: ListFilterSelectProps) {
  const items: SearchableSelectOption[] = showAllOption
    ? [{ value: allValue, label: allLabel }, ...options]
    : [...options];

  return (
    <SearchableSelect
      value={value}
      onValueChange={onValueChange}
      options={items}
      ariaLabel={ariaLabel}
      placeholder={placeholder}
      className={cn(
        'bg-background/50 border-border/80 h-9 w-full',
        triggerClassName
      )}
      showClear={false}
    />
  );
}
