'use client';

import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { cn } from '@repo/ui/lib/utils';

export type CheckboxOption = {
  readonly id: string;
  readonly label: string;
  readonly secondaryLabel?: string;
};

type CheckboxOptionListProps = {
  readonly options: readonly CheckboxOption[];
  readonly selectedIds: readonly string[];
  // eslint-disable-next-line no-unused-vars -- selection change callback
  readonly onSelectedIdsChange: (ids: string[]) => void;
  readonly emptyText?: string;
  readonly checkboxIdPrefix?: string;
  readonly disabled?: boolean;
  readonly listClassName?: string;
  readonly emptyClassName?: string;
  readonly itemClassName?: string;
  readonly primaryLabelClassName?: string;
  readonly secondaryLabelClassName?: string;
};

export function CheckboxOptionList({
  options,
  selectedIds,
  onSelectedIdsChange,
  emptyText = 'No options available.',
  checkboxIdPrefix = 'checkbox-option',
  disabled = false,
  listClassName,
  emptyClassName,
  itemClassName,
  primaryLabelClassName = 'text-foreground text-xs font-semibold',
  secondaryLabelClassName = 'text-muted-foreground text-[10px]',
}: Readonly<CheckboxOptionListProps>) {
  if (options.length === 0) {
    return (
      <div
        className={cn(
          'text-muted-foreground bg-muted/30 border-border/50 rounded-lg border p-3 text-xs',
          emptyClassName
        )}
      >
        {emptyText}
      </div>
    );
  }

  const toggleId = (id: string, checked: boolean) => {
    if (checked) {
      if (selectedIds.includes(id)) {
        return;
      }
      onSelectedIdsChange([...selectedIds, id]);
      return;
    }
    onSelectedIdsChange(selectedIds.filter((selectedId) => selectedId !== id));
  };

  return (
    <div
      className={cn(
        'bg-background/50 border-input custom-scrollbar max-h-48 space-y-1 overflow-y-auto rounded-md border p-2',
        listClassName
      )}
    >
      {options.map((option) => {
        const checked = selectedIds.includes(option.id);
        const checkboxId = `${checkboxIdPrefix}-${option.id}`;
        return (
          <div
            key={option.id}
            className={cn(
              'hover:bg-accent/50 flex items-center gap-3 rounded px-2.5 py-1.5 transition-colors',
              itemClassName
            )}
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              disabled={disabled}
              onCheckedChange={(value) => toggleId(option.id, value === true)}
              className="cursor-pointer"
            />
            <label
              htmlFor={checkboxId}
              className="flex flex-1 cursor-pointer flex-col"
            >
              <span className={primaryLabelClassName}>{option.label}</span>
              {option.secondaryLabel ? (
                <span className={secondaryLabelClassName}>
                  {option.secondaryLabel}
                </span>
              ) : null}
            </label>
          </div>
        );
      })}
    </div>
  );
}
