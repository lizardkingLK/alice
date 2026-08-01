'use client';

import { useEffect, useState } from 'react';
import {
  Combobox,
  ComboboxContent,
  ComboboxEmpty,
  ComboboxInput,
  ComboboxItem,
  ComboboxList,
} from '@repo/ui/components/ui/combobox';
import { cn } from '@repo/ui/lib/utils';

export type SearchableSelectOption = {
  readonly value: string;
  readonly label: string;
};

type SearchableSelectProps = {
  readonly options: readonly SearchableSelectOption[];
  readonly value?: string;
  // eslint-disable-next-line no-unused-vars -- callback param for consumers
  readonly onValueChange?: (value: string) => void;
  readonly placeholder?: string;
  readonly ariaLabel?: string;
  readonly name?: string;
  readonly required?: boolean;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly emptyText?: string;
  readonly id?: string;
  readonly showClear?: boolean;
};

/**
 * Searchable single-select for long entity lists (users, projects, work items).
 * Prefer plain Select for tiny enums (status, priority, type).
 *
 * Controlled when `value` is passed; otherwise keeps internal selection so
 * `name`/form usage works (e.g. project members allocate form).
 */
export function SearchableSelect({
  options,
  value,
  onValueChange,
  placeholder = 'Search…',
  ariaLabel,
  name,
  required,
  disabled,
  className,
  emptyText = 'No results found.',
  id,
  showClear = false,
}: SearchableSelectProps) {
  const isControlled = value !== undefined;
  const [uncontrolledValue, setUncontrolledValue] = useState(value ?? '');
  const resolvedValue = isControlled ? (value ?? '') : uncontrolledValue;

  useEffect(() => {
    if (isControlled) {
      return;
    }
    // Drop stale selection when options shrink (e.g. after allocating a member).
    if (
      uncontrolledValue &&
      !options.some((option) => option.value === uncontrolledValue)
    ) {
      setUncontrolledValue('');
    }
  }, [isControlled, options, uncontrolledValue]);

  const selected =
    resolvedValue === ''
      ? null
      : (options.find((option) => option.value === resolvedValue) ?? null);

  return (
    <Combobox
      items={[...options]}
      value={selected}
      onValueChange={(next) => {
        const nextValue = next?.value ?? '';
        if (!isControlled) {
          setUncontrolledValue(nextValue);
        }
        onValueChange?.(nextValue);
      }}
      isItemEqualToValue={(a, b) => a.value === b.value}
      name={name}
      required={required}
      disabled={disabled}
      id={id}
      autoHighlight
    >
      <ComboboxInput
        placeholder={placeholder}
        aria-label={ariaLabel}
        className={cn('w-full', className)}
        showClear={showClear && Boolean(selected)}
        disabled={disabled}
      />
      <ComboboxContent className="w-(--anchor-width)">
        <ComboboxEmpty>{emptyText}</ComboboxEmpty>
        <ComboboxList>
          {(item) => (
            <ComboboxItem key={item.value} value={item}>
              {item.label}
            </ComboboxItem>
          )}
        </ComboboxList>
      </ComboboxContent>
    </Combobox>
  );
}
