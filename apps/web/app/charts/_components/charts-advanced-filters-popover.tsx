'use client';

import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
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
import { CircleHelp, X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { FilterFieldNavItem } from '@/components/filter-field-nav-item';
import { FILTER_OPTIONS_SCROLL_CLASS } from '@/components/filter-dialog-shell';
import { preventDismissForFloatingPortal } from '@/lib/dialog-outside-events';
import {
  CHARTS_FILTER_COLUMNS,
  chartsFilterValueOptions,
  chartsQuickFieldOptions,
  chartsSprintFieldOptions,
  type ChartsAdvancedFilterRow,
  type ChartsFilterColumnId,
  type ChartsFilterCondition,
  type ChartsFilterOption,
  type ChartsProjectOption,
  type ChartsQuickFieldId,
  type ChartsSampleMember,
  type ChartsSprintOption,
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
  readonly projects?: readonly ChartsProjectOption[];
  readonly sprints?: readonly ChartsSprintOption[];
  readonly members?: readonly ChartsSampleMember[];
  readonly trigger: ReactNode;
  readonly className?: string;
};

const QUICK_FIELDS: readonly { id: ChartsQuickFieldId; label: string }[] = [
  { id: 'project', label: 'Project' },
  { id: 'sprint', label: 'Sprint' },
  { id: 'status', label: 'Status' },
  { id: 'type', label: 'Work type' },
  { id: 'assignee', label: 'Assignee' },
  { id: 'priority', label: 'Priority' },
] as const;

const DEFAULT_QUICK_SELECTIONS: Record<ChartsQuickFieldId, string> = {
  project: 'all',
  sprint: 'all',
  status: 'all',
  type: 'all',
  assignee: 'all',
  priority: 'all',
};

const ADVANCED_COLUMN_IDS = CHARTS_FILTER_COLUMNS.map(
  (column) => column.id
) as ChartsFilterColumnId[];

function createFilterRow(
  column: ChartsFilterColumnId = 'status',
  members: readonly ChartsSampleMember[] = []
): ChartsAdvancedFilterRow {
  const values = chartsFilterValueOptions(column, members);
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

function firstAvailableColumn(
  used: ReadonlySet<ChartsFilterColumnId>,
  prefer?: ChartsFilterColumnId
): ChartsFilterColumnId | null {
  if (prefer && !used.has(prefer)) {
    return prefer;
  }
  return ADVANCED_COLUMN_IDS.find((column) => !used.has(column)) ?? null;
}

/**
 * Keep at most one row per column (AND of two Status=… filters can never match).
 */
function dedupeRowsByColumn(
  rows: readonly ChartsAdvancedFilterRow[],
  members: readonly ChartsSampleMember[] = []
): ChartsAdvancedFilterRow[] {
  const seen = new Set<ChartsFilterColumnId>();
  const next: ChartsAdvancedFilterRow[] = [];
  for (const row of rows) {
    if (seen.has(row.column)) {
      continue;
    }
    seen.add(row.column);
    next.push({ ...row });
  }
  if (next.length === 0) {
    return [createFilterRow('status', members)];
  }
  return next;
}

function hydrateFromApplied(
  applied: ChartsWidgetFilterDraft | null | undefined,
  members: readonly ChartsSampleMember[] = []
): {
  mode: ChartsFilterMode;
  projectId: string;
  rows: ChartsAdvancedFilterRow[];
  quickSelections: Record<ChartsQuickFieldId, string>;
  sprintId: string | undefined;
} {
  if (!applied) {
    return {
      mode: 'quick',
      projectId: 'all',
      rows: [createFilterRow('status', members)],
      quickSelections: { ...DEFAULT_QUICK_SELECTIONS },
      sprintId: undefined,
    };
  }
  const sprintId = applied.sprintId?.trim() || undefined;
  const quickSprint =
    applied.quickSelections.sprint ??
    sprintId ??
    DEFAULT_QUICK_SELECTIONS.sprint;
  return {
    mode: applied.mode,
    projectId: applied.projectId,
    rows: dedupeRowsByColumn(
      applied.rows.length > 0
        ? applied.rows
        : [createFilterRow('status', members)],
      members
    ),
    quickSelections: {
      ...DEFAULT_QUICK_SELECTIONS,
      ...applied.quickSelections,
      sprint: quickSprint,
    },
    sprintId,
  };
}

/**
 * Nested Select portals can look like "outside" the popover. Ignore those;
 * allow a real outside click (dialog chrome, chart body, etc.) to dismiss.
 */
function ChartsFilterSelect({
  value,
  onValueChange,
  ariaLabel,
  placeholder,
  triggerClassName,
  options,
  children,
  disabled,
}: Readonly<{
  value: string | undefined;
  // eslint-disable-next-line no-unused-vars -- select change
  onValueChange: (value: string) => void;
  ariaLabel: string;
  placeholder: string;
  triggerClassName?: string;
  options?: readonly ChartsFilterOption[];
  children?: ReactNode;
  disabled?: boolean;
}>) {
  return (
    <Select value={value} onValueChange={onValueChange} disabled={disabled}>
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
  projects = [],
  sprints = [],
  members = [],
  trigger,
  className,
}: Readonly<ChartsAdvancedFiltersPopoverProps>) {
  const initial = hydrateFromApplied(appliedFilters, members);
  const [mode, setMode] = useState<ChartsFilterMode>(initial.mode);
  const [projectId, setProjectId] = useState(initial.projectId);
  const [rows, setRows] = useState<ChartsAdvancedFilterRow[]>(initial.rows);
  const [quickField, setQuickField] = useState<ChartsQuickFieldId>('project');
  const [quickSearch, setQuickSearch] = useState('');
  const [quickSelections, setQuickSelections] = useState(
    initial.quickSelections
  );
  const [sprintId, setSprintId] = useState<string | undefined>(
    initial.sprintId
  );
  const wasOpenRef = useRef(false);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      const next = hydrateFromApplied(appliedFilters, members);
      setMode(next.mode);
      setProjectId(next.projectId);
      setRows(next.rows);
      setQuickSelections(next.quickSelections);
      setSprintId(next.sprintId);
      setQuickSearch('');
      setQuickField('project');
    }
    wasOpenRef.current = open;
  }, [appliedFilters, members, open]);

  const resolvedProjectId =
    mode === 'quick' ? quickSelections.project : projectId;

  const draft = useMemo<ChartsWidgetFilterDraft>(() => {
    let resolvedSprint;
    if (mode === 'quick') {
      if (quickSelections.sprint === 'all') {
        resolvedSprint = undefined;
      } else {
        resolvedSprint = quickSelections.sprint;
      }
    } else {
      resolvedSprint = sprintId;
    }

    return {
      mode,
      projectId: resolvedProjectId,
      rows,
      quickSelections: {
        ...quickSelections,
        project: resolvedProjectId,
        sprint: resolvedSprint ?? 'all',
      },
      ...(resolvedSprint ? { sprintId: resolvedSprint } : {}),
    };
  }, [mode, quickSelections, resolvedProjectId, rows, sprintId]);

  const projectOptions = useMemo(
    () => [
      { value: 'all', label: 'All projects' },
      ...projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    ],
    [projects]
  );

  const sprintOptions = useMemo(
    () => chartsSprintFieldOptions(sprints, resolvedProjectId),
    [resolvedProjectId, sprints]
  );
  const sprintSelectDisabled =
    !resolvedProjectId || resolvedProjectId === 'all';

  const usedColumns = useMemo(
    () => new Set(rows.map((row) => row.column)),
    [rows]
  );
  const canAddFilter = usedColumns.size < ADVANCED_COLUMN_IDS.length;

  const clearAll = () => {
    setProjectId('all');
    setRows([createFilterRow('status', members)]);
    setQuickSelections({ ...DEFAULT_QUICK_SELECTIONS });
    setSprintId(undefined);
  };

  const setSprintScope = (nextSprintId: string) => {
    const normalized = nextSprintId === 'all' ? undefined : nextSprintId;
    setSprintId(normalized);
    setQuickSelections((prev) => ({
      ...prev,
      sprint: nextSprintId,
    }));
  };

  const setProjectScope = (nextProjectId: string) => {
    const currentProjectId = resolvedProjectId;
    setProjectId(nextProjectId);
    setQuickSelections((prev) => ({
      ...prev,
      project: nextProjectId,
      ...(nextProjectId !== currentProjectId ? { sprint: 'all' } : {}),
    }));
    if (nextProjectId !== currentProjectId) {
      setSprintId(undefined);
    }
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
          const values = chartsFilterValueOptions(patch.column, members);
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

  const addFilterRow = () => {
    const column = firstAvailableColumn(usedColumns);
    if (!column) {
      return;
    }
    setRows((prev) => [...prev, createFilterRow(column, members)]);
  };

  const columnOptionsForRow = (rowId: string, current: ChartsFilterColumnId) =>
    CHARTS_FILTER_COLUMNS.filter(
      (column) =>
        column.id === current ||
        !rows.some((row) => row.id !== rowId && row.column === column.id)
    ).map((column) => ({
      value: column.id,
      label: column.label,
    }));

  const handleApply = () => {
    onApply(draft);
    onOpenChange(false);
  };

  const quickOptions = useMemo(
    () =>
      chartsQuickFieldOptions(quickField, projects, {
        sprints,
        projectId: resolvedProjectId,
        members,
      }),
    [members, projects, quickField, resolvedProjectId, sprints]
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
        onPointerDownOutside={preventDismissForFloatingPortal}
        onInteractOutside={preventDismissForFloatingPortal}
      >
        <div className="border-border flex items-start justify-between gap-3 border-b px-4 py-3">
          <div className="min-w-0 space-y-0.5">
            <h3 className="text-sm font-semibold tracking-tight">
              {mode === 'advanced' ? 'Advanced filters' : 'Quick filters'}
            </h3>
            <p className="text-muted-foreground flex items-center gap-1 text-xs">
              Live counts use the selected project’s work-item rollups
              <Tooltip delayDuration={400}>
                <TooltipTrigger asChild>
                  <button
                    type="button"
                    className="text-muted-foreground hover:text-foreground inline-flex cursor-pointer"
                    aria-label="About chart filters"
                  >
                    <CircleHelp className="size-3.5" />
                  </button>
                </TooltipTrigger>
                <TooltipContent side="bottom">
                  Pick a project to load the pie. Slice clicks open the table
                  for that group.
                </TooltipContent>
              </Tooltip>
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:text-foreground h-8 shrink-0 cursor-pointer px-2 text-xs"
            onClick={clearAll}
          >
            Clear all
          </Button>
        </div>

        {mode === 'advanced' ? (
          <div className="flex flex-col gap-3 px-4 py-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground w-14 shrink-0 text-xs font-medium">
                Project
              </span>
              <ChartsFilterSelect
                value={projectId}
                onValueChange={setProjectScope}
                ariaLabel="Project"
                placeholder="All projects"
                triggerClassName="min-w-0"
                options={projectOptions}
              />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <span className="text-muted-foreground w-14 shrink-0 text-xs font-medium">
                Sprint
              </span>
              <ChartsFilterSelect
                value={sprintId ?? 'all'}
                onValueChange={setSprintScope}
                ariaLabel="Sprint"
                placeholder="All sprints"
                triggerClassName="min-w-0"
                options={sprintOptions}
                disabled={sprintSelectDisabled}
              />
            </div>

            {rows.map((row, index) => {
              const valueOptions = chartsFilterValueOptions(
                row.column,
                members
              );
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
                    options={columnOptionsForRow(row.id, row.column)}
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
                className={cn(
                  'cursor-pointer text-xs font-medium',
                  canAddFilter
                    ? 'text-primary hover:text-primary/80'
                    : 'text-muted-foreground cursor-not-allowed opacity-60'
                )}
                disabled={!canAddFilter}
                onClick={addFilterRow}
              >
                + New filter
              </button>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-[9rem_minmax(0,1fr)] overflow-hidden">
            <nav
              className="border-border flex flex-col gap-0.5 overflow-y-auto border-r p-2"
              aria-label="Quick filter fields"
            >
              {QUICK_FIELDS.map((field) => (
                <FilterFieldNavItem
                  key={field.id}
                  label={field.label}
                  active={quickField === field.id}
                  onSelect={() => {
                    setQuickField(field.id);
                    setQuickSearch('');
                  }}
                />
              ))}
            </nav>
            <div className="flex min-h-0 flex-col overflow-hidden">
              <div className="shrink-0 p-3 pb-2">
                <Input
                  value={quickSearch}
                  onChange={(event) => setQuickSearch(event.target.value)}
                  placeholder={`Search ${QUICK_FIELDS.find((field) => field.id === quickField)?.label.toLowerCase() ?? 'options'}`}
                  className="h-9"
                  aria-label="Search filter options"
                />
              </div>
              {/*
                Portaled Popover inside Dialog: body scroll-lock swallows wheel
                events on native overflow. ScrollArea + stopPropagation matches
                calendar overflow + registry filter panes.
              */}
              <ScrollArea
                type="always"
                className={cn('min-h-0 w-full', FILTER_OPTIONS_SCROLL_CLASS)}
                onWheel={(event) => event.stopPropagation()}
              >
                <div className="flex flex-col gap-0.5 px-3 pb-3">
                  {quickField === 'sprint' && sprintSelectDisabled ? (
                    <p className="text-muted-foreground px-2 py-2 text-xs">
                      Pick a project first to choose a sprint.
                    </p>
                  ) : null}
                  {filteredQuickOptions.map((option) => {
                    const checked =
                      quickSelections[quickField] === option.value;
                    const optionId = `charts-quick-${quickField}-${option.value}`;
                    return (
                      <label
                        key={option.value}
                        htmlFor={optionId}
                        className={cn(
                          'hover:bg-muted/50 flex items-center gap-2.5 rounded-md px-2 py-1.5 text-sm',
                          quickField === 'sprint' && sprintSelectDisabled
                            ? 'cursor-not-allowed opacity-60'
                            : 'cursor-pointer'
                        )}
                      >
                        <Checkbox
                          id={optionId}
                          checked={checked}
                          onCheckedChange={() => {
                            if (quickField === 'project') {
                              setProjectScope(option.value);
                              return;
                            }
                            if (quickField === 'sprint') {
                              setSprintScope(option.value);
                              return;
                            }
                            setQuickSelections((prev) => ({
                              ...prev,
                              [quickField]: option.value,
                            }));
                          }}
                          className="cursor-pointer"
                          disabled={
                            quickField === 'sprint' && sprintSelectDisabled
                          }
                        />
                        <span
                          className="min-w-0 flex-1 truncate"
                          title={option.label}
                        >
                          {option.label}
                        </span>
                      </label>
                    );
                  })}
                  {filteredQuickOptions.length === 0 ? (
                    <p className="text-muted-foreground px-2 py-4 text-center text-xs">
                      {quickField === 'sprint' && sprintSelectDisabled
                        ? 'Pick a project to filter by sprint'
                        : 'No matching options'}
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
              setMode((prev) => {
                const next = prev === 'advanced' ? 'quick' : 'advanced';
                if (next === 'advanced') {
                  setRows((current) => dedupeRowsByColumn(current, members));
                }
                if (next === 'quick') {
                  setQuickField('project');
                  setQuickSearch('');
                }
                return next;
              })
            }
          >
            {mode === 'advanced'
              ? 'Switch to quick filters'
              : 'Switch to advanced filters'}
          </button>
          <div className="flex items-center gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={() => onOpenChange(false)}
            >
              Close
            </Button>
            <Button
              type="button"
              size="sm"
              className="h-8 cursor-pointer"
              onClick={handleApply}
            >
              Apply
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
