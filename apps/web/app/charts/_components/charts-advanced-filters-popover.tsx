'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { CircleHelp, X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  CHARTS_FILTER_COLUMNS,
  CHARTS_SAMPLE_PROJECTS,
  CHARTS_SAMPLE_WORK_ITEMS,
  chartsFilterValueOptions,
  chartsQuickFieldOptions,
  countChartsSampleMatches,
  type ChartsAdvancedFilterRow,
  type ChartsFilterColumnId,
  type ChartsFilterCondition,
  type ChartsFilterOption,
  type ChartsQuickFieldId,
  type ChartsWidgetFilterDraft,
} from '@/app/charts/_components/charts-sample.data';

type ChartsFilterMode = ChartsWidgetFilterDraft['mode'];

type ChartsAdvancedFiltersPopoverProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled open change
  readonly onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- apply draft filters
  readonly onApply: (draft: ChartsWidgetFilterDraft) => void;
  readonly appliedFilters?: ChartsWidgetFilterDraft | null;
  readonly trigger: ReactNode;
  readonly searchQuery?: string;
  readonly assigneeId?: string | null;
  readonly className?: string;
};

const QUICK_FIELDS: readonly { id: ChartsQuickFieldId; label: string }[] = [
  { id: 'project', label: 'Project' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Work type' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
] as const;

const DEFAULT_QUICK_SELECTIONS: Record<ChartsQuickFieldId, string> = {
  project: 'all',
  status: 'all',
  type: 'all',
  assignee: 'all',
  priority: 'all',
};

function createFilterRow(
  column: ChartsFilterColumnId = 'status'
): ChartsAdvancedFilterRow {
  const values = chartsFilterValueOptions(column);
  return {
    id:
      typeof crypto !== 'undefined' && 'randomUUID' in crypto
        ? crypto.randomUUID()
        : `filter-${Date.now()}`,
    column,
    condition: 'is',
    value: values[0]?.value ?? '',
  };
}

function hydrateFromApplied(
  applied: ChartsWidgetFilterDraft | null | undefined
): {
  mode: ChartsFilterMode;
  projectId: string;
  rows: ChartsAdvancedFilterRow[];
  quickSelections: Record<ChartsQuickFieldId, string>;
} {
  if (!applied) {
    return {
      mode: 'advanced',
      projectId: 'all',
      rows: [createFilterRow('status')],
      quickSelections: { ...DEFAULT_QUICK_SELECTIONS },
    };
  }
  return {
    mode: applied.mode,
    projectId: applied.projectId,
    rows:
      applied.rows.length > 0
        ? applied.rows.map((row) => ({ ...row }))
        : [createFilterRow('status')],
    quickSelections: { ...applied.quickSelections },
  };
}

/**
 * Radix Select sets `disableOutsidePointerEvents`, so a second click on the
 * trigger (or elsewhere in the popover) is hit-tested as outside the popover.
 * Always swallow outside dismiss while this panel is open; close via Apply,
 * Escape, or the Filter trigger instead.
 */
function preventOutsideDismiss(event: { preventDefault: () => void }) {
  event.preventDefault();
}

function ChartsFilterSelect({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  triggerClassName,
  options,
  children,
}: Readonly<{
  value: string | undefined;
  // eslint-disable-next-line no-unused-vars -- select change
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
  triggerClassName?: string;
  options?: readonly ChartsFilterOption[];
  children?: ReactNode;
}>) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger
        aria-label={ariaLabel}
        className={cn('h-9 min-w-28 flex-1 cursor-pointer', triggerClassName)}
      >
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent onCloseAutoFocus={(event) => event.preventDefault()}>
        {children}
        {options?.map((option) => (
          <SelectItem key={option.value} value={option.value}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

export function ChartsAdvancedFiltersPopover({
  open,
  onOpenChange,
  onApply,
  appliedFilters = null,
  trigger,
  searchQuery = '',
  assigneeId = null,
  className,
}: Readonly<ChartsAdvancedFiltersPopoverProps>) {
  const initial = hydrateFromApplied(appliedFilters);
  const [mode, setMode] = useState<ChartsFilterMode>(initial.mode);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [rows, setRows] = useState<ChartsAdvancedFilterRow[]>(initial.rows);
  const [quickField, setQuickField] = useState<ChartsQuickFieldId>('status');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickSelections, setQuickSelections] = useState(
    initial.quickSelections
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = hydrateFromApplied(appliedFilters);
      setMode(next.mode);
      setProjectId(next.projectId);
      setRows(next.rows);
      setQuickSelections(next.quickSelections);
      setQuickSearch('');
      setQuickField('status');
    }
    wasOpenRef.current = open;
  }, [appliedFilters, open]);

  const draft = useMemo<ChartsWidgetFilterDraft>(
    () => ({
      mode,
      projectId,
      rows,
      quickSelections,
    }),
    [mode, projectId, rows, quickSelections]
  );

  const matchingCount = useMemo(
    () =>
      countChartsSampleMatches(draft, {
        search: searchQuery,
        assigneeId,
      }),
    [assigneeId, draft, searchQuery]
  );

  const clearAll = () => {
    setProjectId('all');
    setRows([{ ...createFilterRow('status'), value: '' }]);
    setQuickSelections({ ...DEFAULT_QUICK_SELECTIONS });
  };

  const updateRow = (
    id: string,
    patch: Partial<Omit<ChartsAdvancedFilterRow, 'id'>>
  ) => {
    setRows((prev) =>
      prev.map((row) => {
        if (row.id !== id) {
          return row;
        }
        const next = { ...row, ...patch };
        if (patch.column && patch.column !== row.column) {
          const values = chartsFilterValueOptions(patch.column);
          next.value = values[0]?.value ?? '';
          next.condition = 'is';
        }
        return next;
      })
    );
  };

  const removeRow = (id: string) => {
    setRows((prev) => {
      if (prev.length <= 1) {
        return prev;
      }
      return prev.filter((row) => row.id !== id);
    });
  };

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const quickOptions = useMemo(
    () => chartsQuickFieldOptions(quickField),
    [quickField]
  );

  const filteredQuickOptions = useMemo(() => {
    const query = quickSearch.trim().toLowerCase();
    if (!query) {
      return quickOptions;
    }
    return quickOptions.filter((option) =>
      option.label.toLowerCase().includes(query)
    );
  }, [quickOptions, quickSearch]);

  return (
    <Popover open={open} onOpenChange={onOpenChange} modal={false}>
      <PopoverTrigger asChild>{trigger}</PopoverTrigger>
      <PopoverContent
        align="start"
        sideOffset={8}
        className={cn(
          'bg-popover text-popover-foreground border-border ring-foreground/10 w-[min(92vw,36rem)] gap-0 rounded-xl p-0 shadow-lg ring-1',
          className
        )}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onPointerDownOutside={preventOutsideDismiss}
        onInteractOutside={preventOutsideDismiss}
        onFocusOutside={preventOutsideDismiss}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-semibold tracking-tight">
              {mode === 'advanced' ? 'Advanced filters' : 'Quick filters'}
            </h3>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              Showing {matchingCount} of {CHARTS_SAMPLE_WORK_ITEMS.length} items
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer"
                    aria-label="About matching items"
                  >
                    <CircleHelp className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Live match count for the current draft, including toolbar
                  search and assignee.
                </TooltipContent>
              </Tooltip>
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground hover:text-foreground h-8 cursor-pointer px-2 text-xs"
              onClick={clearAll}
            >
              Clear all
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer text-xs"
              disabled
            >
              Save filters
            </Button>
          </div>
        </div>

        {mode === 'advanced' ? (
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground w-14 shrink-0 text-xs font-medium">
                Project
              </span>
              <ChartsFilterSelect
                value={projectId}
                onValueChange={setProjectId}
                ariaLabel="Project"
                placeholder="All projects"
                triggerClassName="min-w-0"
                options={[
                  { value: 'all', label: 'All projects' },
                  ...CHARTS_SAMPLE_PROJECTS.map((project) => ({
                    value: project.id,
                    label: project.name,
                  })),
                ]}
              />
            </div>

            {rows.map((row, index) => {
              const valueOptions = chartsFilterValueOptions(row.column);
              return (
                <div key={row.id} className="flex flex-wrap items-center gap-2">
                  <span className="text-muted-foreground w-14 shrink-0 text-xs font-medium">
                    {index === 0 ? 'Where' : 'And'}
                  </span>
                  <ChartsFilterSelect
                    value={row.column}
                    onValueChange={(value) =>
                      updateRow(row.id, {
                        column: value as ChartsFilterColumnId,
                      })
                    }
                    ariaLabel={`Filter column ${index + 1}`}
                    placeholder="Column"
                    options={CHARTS_FILTER_COLUMNS.map((column) => ({
                      value: column.id,
                      label: column.label,
                    }))}
                  />
                  <ChartsFilterSelect
                    value={row.condition}
                    onValueChange={(value) =>
                      updateRow(row.id, {
                        condition: value as ChartsFilterCondition,
                      })
                    }
                    ariaLabel={`Filter condition ${index + 1}`}
                    placeholder="Condition"
                  >
                    <SelectItem value="is">Is</SelectItem>
                    <SelectItem value="is-not">Is not</SelectItem>
                    <SelectItem value="contains">Contains</SelectItem>
                  </ChartsFilterSelect>
                  <ChartsFilterSelect
                    value={row.value || undefined}
                    onValueChange={(value) => updateRow(row.id, { value })}
                    ariaLabel={`Filter value ${index + 1}`}
                    placeholder="Value"
                    options={valueOptions}
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    aria-label={`Remove filter ${index + 1}`}
                    className="text-muted-foreground hover:text-foreground shrink-0 cursor-pointer"
                    disabled={rows.length <= 1}
                    onClick={() => removeRow(row.id)}
                  >
                    <X className="size-4" />
                  </Button>
                </div>
              );
            })}

            <div className="flex flex-wrap items-center gap-3 pt-1">
              <button
                type="button"
                className="text-primary hover:text-primary/80 cursor-pointer text-xs font-medium"
                onClick={() =>
                  setRows((prev) => [...prev, createFilterRow('status')])
                }
              >
                + New filter
              </button>
              <button
                type="button"
                className="text-primary hover:text-primary/80 cursor-pointer text-xs font-medium"
                onClick={() =>
                  setRows((prev) => [...prev, createFilterRow('type')])
                }
              >
                + New group
              </button>
            </div>
          </div>
        ) : (
          <div className="grid max-h-[min(60vh,22rem)] grid-cols-[9rem_minmax(0,1fr)] overflow-hidden">
            <nav
              className="border-border flex flex-col gap-0.5 overflow-y-auto border-r p-2"
              aria-label="Quick filter fields"
            >
              {QUICK_FIELDS.map((field) => (
                <button
                  key={field.id}
                  type="button"
                  onClick={() => {
                    setQuickField(field.id);
                    setQuickSearch('');
                  }}
                  className={cn(
                    'relative flex w-full cursor-pointer items-center rounded-md px-3 py-2 text-left text-sm transition-colors',
                    quickField === field.id
                      ? 'bg-primary/10 text-foreground font-medium'
                      : 'text-muted-foreground hover:bg-muted/60 hover:text-foreground'
                  )}
                >
                  {quickField === field.id ? (
                    <span
                      aria-hidden
                      className="bg-primary absolute top-1 bottom-1 left-0 w-0.5 rounded-full"
                    />
                  ) : null}
                  {field.label}
                </button>
              ))}
            </nav>
            <div className="flex min-h-0 flex-col gap-2 p-3">
              <Input
                value={quickSearch}
                onChange={(event) => setQuickSearch(event.target.value)}
                placeholder={`Search ${QUICK_FIELDS.find((field) => field.id === quickField)?.label.toLowerCase() ?? 'options'}`}
                className="h-9"
                aria-label="Search filter options"
              />
              <ScrollArea className="h-52 pr-2">
                <div className="flex flex-col gap-0.5">
                  {filteredQuickOptions.map((option) => {
                    const checked =
                      quickSelections[quickField] === option.value;
                    const optionId = `charts-quick-${quickField}-${option.value}`;
                    return (
                      <label
                        key={option.value}
                        htmlFor={optionId}
                        className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
                      >
                        <input
                          id={optionId}
                          type="checkbox"
                          checked={checked}
                          onChange={() =>
                            setQuickSelections((prev) => ({
                              ...prev,
                              [quickField]: option.value,
                            }))
                          }
                          className="border-input size-4 rounded border"
                        />
                        <span className="min-w-0 flex-1">
                          <TruncatedText className="text-sm">
                            {option.label}
                          </TruncatedText>
                        </span>
                      </label>
                    );
                  })}
                  {filteredQuickOptions.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                      No matching options
                    </p>
                  ) : null}
                </div>
              </ScrollArea>
            </div>
          </div>
        )}

        <div className="border-border flex items-center justify-between gap-3 border-t px-4 py-3">
          <button
            type="button"
            className="text-muted-foreground hover:text-foreground cursor-pointer text-xs font-medium"
            onClick={() =>
              setMode((prev) => (prev === 'advanced' ? 'quick' : 'advanced'))
            }
          >
            {mode === 'advanced'
              ? 'Switch to quick filters'
              : 'Switch to advanced filters'}
          </button>
          <Button
            type="button"
            size="sm"
            className="h-8 cursor-pointer"
            onClick={handleApply}
          >
            Apply
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
