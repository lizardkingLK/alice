'use client';

import { useMemo, useState, type ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import { Dialog, DialogContent } from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { useToggleKeyboardShortcut } from '@repo/ui/hooks/use-keyboard-shortcut';
import { ChevronDown, Plus, Search } from '@repo/ui/lib/icons';
import { isShiftLetter } from '@repo/ui/lib/shortcut-gate';
import { cn } from '@repo/ui/lib/utils';
import { FilterFieldNavItem } from '@/components/filter-field-nav-item';
import { FilterShortcutTrigger } from '@/components/filter-shortcut-trigger';

/** Fixed options list height so long filter lists scroll inside the pane. */
export const FILTER_OPTIONS_SCROLL_CLASS = 'h-96';

export type FilterDialogOption = {
  readonly value: string;
  readonly label: string;
  /** When set, options render under a project (or other) collapsible group. */
  readonly groupId?: string;
  readonly groupLabel?: string;
};

export type FilterDialogOptionGroup = {
  readonly id: string;
  readonly label: string;
  readonly options: readonly FilterDialogOption[];
};

function FilterOptionRow({
  id,
  label,
  checked,
  onCheckedChange,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  // eslint-disable-next-line no-unused-vars -- checkbox change
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onCheckedChange(value === true)}
        className="cursor-pointer"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </label>
  );
}

/** Filter options by search; group label match keeps the whole group. */
export function filterDialogOptionsBySearch(
  options: readonly FilterDialogOption[],
  search: string
): FilterDialogOption[] {
  const query = search.trim().toLowerCase();
  if (!query) {
    return [...options];
  }

  const matchingGroupIds = new Set(
    options
      .filter((option) => option.groupLabel?.toLowerCase().includes(query))
      .map((option) => option.groupId)
      .filter((id): id is string => Boolean(id))
  );

  return options.filter((option) => {
    if (option.label.toLowerCase().includes(query)) {
      return true;
    }
    return Boolean(option.groupId && matchingGroupIds.has(option.groupId));
  });
}

/** Group options that carry `groupId` / `groupLabel` (stable project order). */
export function groupFilterDialogOptions(
  options: readonly FilterDialogOption[]
): FilterDialogOptionGroup[] {
  const groups: FilterDialogOptionGroup[] = [];
  const indexById = new Map<string, number>();
  const ungroupedOptions: FilterDialogOption[] = [];

  for (const option of options) {
    const groupId = option.groupId ?? '';
    const groupLabel = option.groupLabel ?? '';
    if (!groupId) {
      ungroupedOptions.push(option);
      continue;
    }

    const existingIndex = indexById.get(groupId);
    if (existingIndex == null) {
      indexById.set(groupId, groups.length);
      groups.push({
        id: groupId,
        label: groupLabel || groupId,
        options: [option],
      });
      continue;
    }

    const existing = groups[existingIndex]!;
    groups[existingIndex] = {
      ...existing,
      options: [...existing.options, option],
    };
  }

  if (ungroupedOptions.length > 0) {
    groups.push({
      id: '__ungrouped__',
      label: 'Other',
      options: ungroupedOptions,
    });
  }

  return groups;
}

type FilterOptionsChecklistPaneProps = {
  readonly fieldId: string;
  readonly searchPlaceholder: string;
  readonly optionSearch: string;
  // eslint-disable-next-line no-unused-vars -- search change
  readonly onOptionSearchChange: (value: string) => void;
  readonly filteredOptions: readonly FilterDialogOption[];
  readonly showAllOption: boolean;
  readonly allOptionLabel: string;
  readonly selectedValue: string;
  readonly allValue: string;
  // eslint-disable-next-line no-unused-vars -- selection apply
  readonly onApplySelection: (value: string) => void;
  readonly onClearActiveField: () => void;
  /** When true (default if options have groups), render project collapsibles. */
  readonly groupByProject?: boolean;
};

function FilterOptionSelectionList({
  fieldId,
  options,
  selectedValue,
  allValue,
  showAllOption,
  onApplySelection,
  onClearActiveField,
  className,
}: Readonly<{
  fieldId: string;
  options: readonly FilterDialogOption[];
  selectedValue: string;
  allValue: string;
  showAllOption: boolean;
  // eslint-disable-next-line no-unused-vars -- selection apply
  onApplySelection: (value: string) => void;
  onClearActiveField: () => void;
  className?: string;
}>) {
  return (
    <div className={cn('space-y-0.5', className)}>
      {options.map((option) => (
        <FilterOptionRow
          key={option.value}
          id={`filter-${fieldId}-${option.value}`}
          label={option.label}
          checked={selectedValue === option.value}
          onCheckedChange={(checked) => {
            if (checked) {
              onApplySelection(option.value);
              return;
            }
            if (showAllOption) {
              onApplySelection(allValue);
              return;
            }
            onClearActiveField();
          }}
        />
      ))}
    </div>
  );
}

function FilterOptionGroupCollapsible({
  fieldId,
  group,
  defaultOpen = true,
  selectedValue,
  allValue,
  showAllOption,
  onApplySelection,
  onClearActiveField,
}: Readonly<{
  fieldId: string;
  group: FilterDialogOptionGroup;
  defaultOpen?: boolean;
  selectedValue: string;
  allValue: string;
  showAllOption: boolean;
  // eslint-disable-next-line no-unused-vars -- selection apply
  onApplySelection: (value: string) => void;
  onClearActiveField: () => void;
}>) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <Collapsible open={open} onOpenChange={setOpen} className="space-y-0.5">
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/50 text-muted-foreground flex w-full cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-left text-xs font-medium tracking-wide uppercase"
          aria-label={
            open ? `Collapse ${group.label}` : `Expand ${group.label}`
          }
        >
          <ChevronDown
            className={cn(
              'size-3.5 shrink-0 transition-transform',
              !open && '-rotate-90'
            )}
          />
          <span className="min-w-0 flex-1 truncate normal-case">
            {group.label}
          </span>
          <span className="tabular-nums opacity-70">
            {group.options.length}
          </span>
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <FilterOptionSelectionList
          fieldId={fieldId}
          options={group.options}
          selectedValue={selectedValue}
          allValue={allValue}
          showAllOption={showAllOption}
          onApplySelection={onApplySelection}
          onClearActiveField={onClearActiveField}
          className="pl-2"
        />
      </CollapsibleContent>
    </Collapsible>
  );
}

/** Searchable single-select checklist used inside FilterDialogShell panes. */
export function FilterOptionsChecklistPane({
  fieldId,
  searchPlaceholder,
  optionSearch,
  onOptionSearchChange,
  filteredOptions,
  showAllOption,
  allOptionLabel,
  selectedValue,
  allValue,
  onApplySelection,
  onClearActiveField,
  groupByProject,
}: Readonly<FilterOptionsChecklistPaneProps>) {
  const shouldGroup =
    groupByProject ?? filteredOptions.some((option) => Boolean(option.groupId));

  const groups = useMemo(
    () => (shouldGroup ? groupFilterDialogOptions(filteredOptions) : []),
    [filteredOptions, shouldGroup]
  );

  return (
    <>
      <div className="border-border border-b py-3 pr-12 pl-3">
        <div className="relative">
          <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
          <Input
            value={optionSearch}
            onChange={(event) => onOptionSearchChange(event.target.value)}
            placeholder={searchPlaceholder}
            aria-label={searchPlaceholder}
            className="pl-9"
          />
        </div>
      </div>

      <ScrollArea className={cn('min-h-0', FILTER_OPTIONS_SCROLL_CLASS)}>
        <div className="space-y-1 p-3">
          {showAllOption ? (
            <FilterOptionRow
              id={`filter-${fieldId}-all`}
              label={allOptionLabel}
              checked={!selectedValue || selectedValue === allValue}
              onCheckedChange={(checked) => {
                if (checked) {
                  onApplySelection(allValue);
                }
              }}
            />
          ) : null}

          {shouldGroup ? (
            groups.map((group) => (
              <FilterOptionGroupCollapsible
                key={group.id}
                fieldId={fieldId}
                group={group}
                defaultOpen
                selectedValue={selectedValue}
                allValue={allValue}
                showAllOption={showAllOption}
                onApplySelection={onApplySelection}
                onClearActiveField={onClearActiveField}
              />
            ))
          ) : (
            <FilterOptionSelectionList
              fieldId={fieldId}
              options={filteredOptions}
              selectedValue={selectedValue}
              allValue={allValue}
              showAllOption={showAllOption}
              onApplySelection={onApplySelection}
              onClearActiveField={onClearActiveField}
            />
          )}

          {filteredOptions.length === 0 ? (
            <p className="text-muted-foreground px-2 py-6 text-center text-sm">
              No matching options.
            </p>
          ) : null}
        </div>
      </ScrollArea>
    </>
  );
}

export type FilterDialogNavField = {
  readonly id: string;
  readonly label: string;
};

type FilterDialogShellProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- dialog open state
  readonly onOpenChange: (open: boolean) => void;
  readonly hasActiveFilters: boolean;
  readonly hideTooltipWhileOpen?: boolean;
  readonly delayDuration?: number;
  /** When set, renders the two-pane field nav layout. */
  readonly fields?: readonly FilterDialogNavField[];
  readonly activeFieldId?: string;
  // eslint-disable-next-line no-unused-vars -- field nav
  readonly onActiveFieldIdChange?: (id: string) => void;
  readonly onClearAll?: () => void;
  readonly showAddFieldPlaceholder?: boolean;
  readonly onClearActiveField?: () => void;
  readonly onOkay: () => void;
  readonly onClose?: () => void;
  readonly footerCountLabel?: ReactNode;
  readonly okayLabel?: string;
  readonly clearLabel?: string;
  /**
   * Optional “Set as default” checkbox (Project / Sprint panes). Placed to the
   * right of Clear. Domain dialogs own checked state / intent.
   */
  readonly setAsDefault?: {
    readonly visible: boolean;
    readonly checked: boolean;
    // eslint-disable-next-line no-unused-vars -- checkbox change
    readonly onCheckedChange: (checked: boolean) => void;
    readonly label?: string;
  };
  /** Optional controls before Close / Okay (e.g. Save workspace). */
  readonly footerStart?: ReactNode;
  readonly children: ReactNode;
  readonly contentClassName?: string;
};

/**
 * Shared Filter dialog chrome: Shift+F trigger, optional two-pane field nav,
 * and Clear / Okay footer. Domain dialogs supply pane body + apply logic.
 */
export function FilterDialogShell({
  open,
  onOpenChange,
  hasActiveFilters,
  hideTooltipWhileOpen = true,
  delayDuration = 600,
  fields,
  activeFieldId,
  onActiveFieldIdChange,
  onClearAll,
  showAddFieldPlaceholder = false,
  onClearActiveField,
  onOkay,
  onClose,
  footerCountLabel,
  okayLabel = 'Okay',
  clearLabel = 'Clear',
  setAsDefault,
  footerStart,
  children,
  contentClassName,
}: Readonly<FilterDialogShellProps>) {
  useToggleKeyboardShortcut(
    (event) => isShiftLetter(event, 'f'),
    open,
    (updater) => {
      onOpenChange(typeof updater === 'function' ? updater(open) : updater);
    }
  );

  const handleClose = () => {
    onClose?.();
    onOpenChange(false);
  };

  const hasFieldNav = Boolean(fields && fields.length > 0);

  const footer = (
    <div className="border-border flex items-center justify-between gap-2 border-t px-3 pt-2 pb-4">
      <div className="flex min-w-0 items-center gap-2">
        {onClearActiveField ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground h-8 px-2 text-xs"
            onClick={onClearActiveField}
          >
            {clearLabel}
          </Button>
        ) : null}
        {setAsDefault?.visible ? (
          <label className="text-muted-foreground flex cursor-pointer items-center gap-2 text-xs">
            <Checkbox
              checked={setAsDefault.checked}
              onCheckedChange={(value) =>
                setAsDefault.onCheckedChange(value === true)
              }
              className="cursor-pointer"
              aria-label={setAsDefault.label ?? 'Set as default'}
            />
            <span>{setAsDefault.label ?? 'Set as default'}</span>
          </label>
        ) : null}
        {footerStart}
      </div>
      <div className="flex items-center gap-2">
        {footerCountLabel ? (
          <span className="text-muted-foreground hidden text-xs sm:inline">
            {footerCountLabel}
          </span>
        ) : null}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer px-3 text-xs"
          onClick={handleClose}
        >
          Close
        </Button>
        <Button
          type="button"
          size="sm"
          className="h-8 cursor-pointer px-3 text-xs"
          onClick={onOkay}
        >
          {okayLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <FilterShortcutTrigger
        open={open}
        hasActiveFilters={hasActiveFilters}
        hideTooltipWhileOpen={hideTooltipWhileOpen}
        delayDuration={delayDuration}
      />

      <DialogContent
        showCloseButton
        className={cn(
          'gap-0 overflow-hidden p-0',
          hasFieldNav ? 'sm:max-w-4xl' : 'sm:max-w-lg',
          contentClassName
        )}
      >
        {hasFieldNav ? (
          <div className="flex min-h-[28rem]">
            <aside className="border-border flex w-52 shrink-0 flex-col border-r p-3 pb-4">
              <nav className="space-y-0.5" aria-label="Filter fields">
                {fields!.map((field) => (
                  <FilterFieldNavItem
                    key={field.id}
                    label={field.label}
                    active={field.id === activeFieldId}
                    onSelect={() => onActiveFieldIdChange?.(field.id)}
                  />
                ))}
              </nav>

              {showAddFieldPlaceholder ? (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled
                  className="mt-3 h-8 w-full cursor-not-allowed gap-1.5 text-xs opacity-60"
                >
                  <Plus className="size-3.5" />
                  Add field
                </Button>
              ) : null}

              {onClearAll ? (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="text-muted-foreground mt-auto h-8 justify-start px-2 text-xs"
                  onClick={onClearAll}
                >
                  Clear all
                </Button>
              ) : null}
            </aside>

            <section className="flex min-w-0 flex-1 flex-col">
              {children}
              {footer}
            </section>
          </div>
        ) : (
          <div className="flex flex-col">
            <div className="px-4 pt-4 pb-2">{children}</div>
            {footer}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
