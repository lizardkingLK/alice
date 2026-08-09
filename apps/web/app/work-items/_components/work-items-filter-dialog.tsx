'use client';

import { useEffect, useMemo, useState } from 'react';
import { Constants } from '@repo/types/database';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Filter, Plus, Search } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { parseWorkItemLabelsFilterParam } from '@repo/types';
import {
  applyProjectFilterToSearchParams,
  buildSprintFilterOptionsForQuery,
} from '@/app/board/_services/board-defaults';
import type { WorkItemsFilterDraft } from '@/app/work-items/_components/workItems-table-helpers';
import type { FilterQuery } from '@/app/work-items/_components/workItems-table-types';
import { WorkItemLabelsInput } from '@/app/work-items/_components/work-item-labels-input';
import type { WorkItemWorkspaceProps } from '@/app/work-items/_components/workItems-workspace';
import { WORK_ITEM_STATUSES } from '@/app/work-items/_helpers/work-item-status';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import { QUERY_FILTER_ALL_VALUE } from '@/hooks/use-query-filter';

/** Fixed options list height so long filter lists scroll inside the pane. */
const FILTER_OPTIONS_SCROLL_CLASS = 'h-64';

const WORK_ITEM_TYPES = Constants.public.Enums.WorkItemType;

type FilterFieldId =
  'project' | 'sprint' | 'assignee' | 'type' | 'status' | 'labels' | 'parent';

type FilterOption = {
  readonly value: string;
  readonly label: string;
};

type FilterFieldConfig = {
  readonly id: FilterFieldId;
  readonly label: string;
  readonly searchPlaceholder: string;
  readonly wired: boolean;
};

/* eslint-disable no-unused-vars */
export type WorkItemsFilterDialogProps = {
  readonly projects: WorkItemWorkspaceProps['projects'];
  readonly projectMembers: WorkItemWorkspaceProps['projectMembers'];
  readonly sprints: WorkItemWorkspaceProps['sprints'];
  readonly projectQuery: FilterQuery;
  readonly sprintQuery: FilterQuery;
  readonly typeQuery: FilterQuery;
  readonly assigneeQuery: FilterQuery;
  readonly labelsQuery: FilterQuery;
  readonly isProjectLocked: boolean;
  readonly isAssigneeLocked: boolean;
  readonly hasActiveFilters: boolean;
  readonly onApplyFilters: (draft: WorkItemsFilterDraft) => void;
};
/* eslint-enable no-unused-vars */

function FilterFieldNavItem({
  label,
  active,
  onSelect,
}: Readonly<{
  label: string;
  active: boolean;
  onSelect: () => void;
}>) {
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

function FilterOptionRow({
  id,
  label,
  checked,
  onCheckedChange,
}: Readonly<{
  id: string;
  label: string;
  checked: boolean;
  // eslint-disable-next-line no-unused-vars
  onCheckedChange: (checked: boolean) => void;
}>) {
  return (
    <label
      htmlFor={id}
      className="hover:bg-muted/50 flex cursor-pointer items-center gap-2.5 rounded-md px-2 py-1.5 text-sm"
    >
      <input
        id={id}
        type="checkbox"
        checked={checked}
        onChange={(event) => onCheckedChange(event.target.checked)}
        className="border-input size-4 rounded border"
      />
      <span className="min-w-0 flex-1 truncate">{label}</span>
    </label>
  );
}

function buildVisibleFields(
  isProjectLocked: boolean,
  isAssigneeLocked: boolean
): FilterFieldConfig[] {
  const fields: FilterFieldConfig[] = [];

  if (!isProjectLocked) {
    fields.push(
      {
        id: 'project',
        label: 'Project',
        searchPlaceholder: 'Search projects',
        wired: true,
      },
      {
        id: 'sprint',
        label: 'Sprint',
        searchPlaceholder: 'Search sprints',
        wired: true,
      }
    );
  }

  fields.push({
    id: 'parent',
    label: 'Parent',
    searchPlaceholder: 'Search parent work items',
    wired: false,
  });

  if (!isAssigneeLocked) {
    fields.push({
      id: 'assignee',
      label: 'Assignee',
      searchPlaceholder: 'Search assignees',
      wired: true,
    });
  }

  fields.push(
    {
      id: 'status',
      label: 'Status',
      searchPlaceholder: 'Search statuses',
      wired: false,
    },
    {
      id: 'type',
      label: 'Work type',
      searchPlaceholder: 'Search work types',
      wired: true,
    },
    {
      id: 'labels',
      label: 'Labels',
      searchPlaceholder: 'Add label',
      wired: true,
    }
  );

  return fields;
}

function optionsForField(
  fieldId: FilterFieldId,
  props: WorkItemsFilterDialogProps,
  draft: WorkItemsFilterDraft
): FilterOption[] {
  switch (fieldId) {
    case 'project':
      return props.projects.map((project) => ({
        value: project.id,
        label: project.name,
      }));
    case 'sprint':
      return buildSprintFilterOptionsForQuery(
        props.sprints,
        draft.project,
        QUERY_FILTER_ALL_VALUE
      );
    case 'assignee':
      return props.projectMembers.map((member) => ({
        value: member.id,
        label: member.name,
      }));
    case 'type':
      return WORK_ITEM_TYPES.map((workItemType) => ({
        value: workItemType,
        label: workItemType,
      }));
    case 'status':
      return WORK_ITEM_STATUSES.map((status) => ({
        value: status,
        label: formatLabelWithSpace(status),
      }));
    case 'labels':
      return [];
    case 'parent':
      return [{ value: '__none__', label: 'No parent' }];
    default:
      return [];
  }
}

function allLabelForField(fieldId: FilterFieldId): string {
  switch (fieldId) {
    case 'project':
      return 'All projects';
    case 'sprint':
      return 'All sprints';
    case 'assignee':
      return 'All assignees';
    case 'type':
      return 'All types';
    case 'labels':
      return 'No labels';
    default:
      return 'All';
  }
}

function labelsFromQuery(query: FilterQuery): string[] {
  if (!query.value || query.value === query.allValue) {
    return [];
  }
  return parseWorkItemLabelsFilterParam(query.value) ?? [];
}

function snapshotDraft(
  props: WorkItemsFilterDialogProps
): WorkItemsFilterDraft {
  return {
    project: props.projectQuery.value,
    sprint: props.sprintQuery.value,
    type: props.typeQuery.value,
    assignee: props.assigneeQuery.value,
    labels: labelsFromQuery(props.labelsQuery),
  };
}

function emptyDraft(props: WorkItemsFilterDialogProps): WorkItemsFilterDraft {
  const all = QUERY_FILTER_ALL_VALUE;
  return {
    project: props.isProjectLocked ? props.projectQuery.value : all,
    sprint: props.isProjectLocked ? props.sprintQuery.value : all,
    type: all,
    assignee: props.isAssigneeLocked ? props.assigneeQuery.value : all,
    labels: [],
  };
}

function labelsSelectionSummary(count: number): string {
  if (count === 0) {
    return 'No label filters applied.';
  }
  if (count === 1) {
    return '1 label selected.';
  }
  return `${count} labels selected.`;
}

function FilterLabelsPane({
  selectedLabels,
  onChange,
}: Readonly<{
  selectedLabels: readonly string[];
  // eslint-disable-next-line no-unused-vars
  onChange: (labels: string[]) => void;
}>) {
  return (
    <>
      <div className="border-border border-b py-3 pr-12 pl-3">
        <p className="text-muted-foreground mb-2 text-xs">
          Add exact labels (case-sensitive). Items matching any label are
          included.
        </p>
        <WorkItemLabelsInput
          value={selectedLabels}
          onChange={onChange}
          placeholder="Add label and press Enter"
        />
      </div>
      <div
        className={cn(
          'text-muted-foreground flex flex-1 items-start p-3 text-sm',
          FILTER_OPTIONS_SCROLL_CLASS
        )}
      >
        {labelsSelectionSummary(selectedLabels.length)}
      </div>
    </>
  );
}

function FilterChecklistPane({
  fieldId,
  searchPlaceholder,
  optionSearch,
  onOptionSearchChange,
  filteredOptions,
  showAllOption,
  selectedValue,
  allValue,
  onApplySelection,
  onClearActiveField,
}: Readonly<{
  fieldId: FilterFieldId;
  searchPlaceholder: string;
  optionSearch: string;
  // eslint-disable-next-line no-unused-vars
  onOptionSearchChange: (value: string) => void;
  filteredOptions: readonly FilterOption[];
  showAllOption: boolean;
  selectedValue: string;
  allValue: string;
  // eslint-disable-next-line no-unused-vars
  onApplySelection: (value: string) => void;
  onClearActiveField: () => void;
}>) {
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
        <div className="space-y-0.5 p-3">
          {showAllOption ? (
            <FilterOptionRow
              id={`filter-${fieldId}-all`}
              label={allLabelForField(fieldId)}
              checked={!selectedValue || selectedValue === allValue}
              onCheckedChange={(checked) => {
                if (checked) {
                  onApplySelection(allValue);
                }
              }}
            />
          ) : null}

          {filteredOptions.map((option) => (
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

function selectedValueForField(
  field: FilterFieldConfig,
  draft: WorkItemsFilterDraft,
  placeholderSelections: Partial<Record<FilterFieldId, string>>
): string {
  if (!field.wired) {
    return placeholderSelections[field.id] ?? '';
  }
  switch (field.id) {
    case 'project':
      return draft.project;
    case 'sprint':
      return draft.sprint;
    case 'assignee':
      return draft.assignee;
    case 'type':
      return draft.type;
    case 'labels':
      return '';
    default:
      return '';
  }
}

function countVisibleOptions(
  isLabelsField: boolean,
  selectedLabelsCount: number,
  filteredOptionsCount: number,
  showAllOption: boolean
): number {
  if (isLabelsField) {
    return selectedLabelsCount;
  }
  return filteredOptionsCount + (showAllOption ? 1 : 0);
}

function draftWithProjectChange(
  draft: WorkItemsFilterDraft,
  nextProject: string,
  sprints: WorkItemWorkspaceProps['sprints']
): WorkItemsFilterDraft {
  const params = new URLSearchParams();
  applyProjectFilterToSearchParams(params, {
    nextProject,
    sprints,
    allValue: QUERY_FILTER_ALL_VALUE,
    pageMode: 'one',
  });
  return {
    ...draft,
    project: nextProject,
    sprint: params.get('sprint') ?? QUERY_FILTER_ALL_VALUE,
  };
}

export function WorkItemsFilterDialog(
  props: Readonly<WorkItemsFilterDialogProps>
) {
  const {
    isProjectLocked,
    isAssigneeLocked,
    hasActiveFilters,
    onApplyFilters,
    sprints,
  } = props;

  const fields = useMemo(
    () => buildVisibleFields(isProjectLocked, isAssigneeLocked),
    [isAssigneeLocked, isProjectLocked]
  );

  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<WorkItemsFilterDraft>(() =>
    snapshotDraft(props)
  );
  const [activeFieldId, setActiveFieldId] = useState<FilterFieldId>(
    fields[0]?.id ?? 'type'
  );
  const [optionSearch, setOptionSearch] = useState('');
  const [placeholderSelections, setPlaceholderSelections] = useState<
    Partial<Record<FilterFieldId, string>>
  >({});

  const activeField =
    fields.find((field) => field.id === activeFieldId) ?? fields[0]!;

  useEffect(() => {
    if (!fields.some((field) => field.id === activeFieldId)) {
      setActiveFieldId(fields[0]?.id ?? 'type');
    }
  }, [activeFieldId, fields]);

  useEffect(() => {
    setOptionSearch('');
  }, [activeFieldId]);

  useEffect(() => {
    if (!open) {
      return;
    }
    setDraft(snapshotDraft(props));
    setPlaceholderSelections({});
    // Seed once when the dialog opens; ignore prop churn while editing.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- open transition only
  }, [open]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.shiftKey && event.key.toLowerCase() === 'f') {
        event.preventDefault();
        setOpen((current) => !current);
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
  };

  const options = optionsForField(activeField.id, props, draft);
  const filteredOptions = options.filter((option) =>
    option.label.toLowerCase().includes(optionSearch.trim().toLowerCase())
  );

  const isLabelsField = activeField.id === 'labels';
  const selectedValue = selectedValueForField(
    activeField,
    draft,
    placeholderSelections
  );

  const applySelection = (value: string) => {
    if (!activeField.wired || activeField.id === 'labels') {
      if (!activeField.wired) {
        setPlaceholderSelections((current) => ({
          ...current,
          [activeField.id]: value,
        }));
      }
      return;
    }

    if (activeField.id === 'project') {
      setDraft((current) => draftWithProjectChange(current, value, sprints));
      return;
    }

    setDraft((current) => {
      switch (activeField.id) {
        case 'sprint':
          return { ...current, sprint: value };
        case 'assignee':
          return { ...current, assignee: value };
        case 'type':
          return { ...current, type: value };
        default:
          return current;
      }
    });
  };

  const clearActiveField = () => {
    if (!activeField.wired) {
      setPlaceholderSelections((current) => {
        const next = { ...current };
        delete next[activeField.id];
        return next;
      });
      return;
    }

    if (activeField.id === 'labels') {
      setDraft((current) => ({ ...current, labels: [] }));
      return;
    }

    if (activeField.id === 'project') {
      setDraft((current) =>
        draftWithProjectChange(current, QUERY_FILTER_ALL_VALUE, sprints)
      );
      return;
    }

    setDraft((current) => {
      switch (activeField.id) {
        case 'sprint':
          return { ...current, sprint: QUERY_FILTER_ALL_VALUE };
        case 'assignee':
          return { ...current, assignee: QUERY_FILTER_ALL_VALUE };
        case 'type':
          return { ...current, type: QUERY_FILTER_ALL_VALUE };
        default:
          return current;
      }
    });
  };

  const handleClearAllDraft = () => {
    setDraft(emptyDraft(props));
    setPlaceholderSelections({});
  };

  const handleClose = () => {
    setOpen(false);
  };

  const handleOkay = () => {
    onApplyFilters(draft);
    setOpen(false);
  };

  const showAllOption = Boolean(!isLabelsField && activeField.wired);
  const visibleCount = countVisibleOptions(
    isLabelsField,
    draft.labels.length,
    filteredOptions.length,
    showAllOption
  );
  const footerCountLabel = isLabelsField
    ? `${visibleCount} selected`
    : `${visibleCount} of ${visibleCount}`;

  let fieldPane = (
    <FilterChecklistPane
      fieldId={activeField.id}
      searchPlaceholder={activeField.searchPlaceholder}
      optionSearch={optionSearch}
      onOptionSearchChange={setOptionSearch}
      filteredOptions={filteredOptions}
      showAllOption={showAllOption}
      selectedValue={selectedValue}
      allValue={QUERY_FILTER_ALL_VALUE}
      onApplySelection={applySelection}
      onClearActiveField={clearActiveField}
    />
  );
  if (isLabelsField) {
    fieldPane = (
      <FilterLabelsPane
        selectedLabels={draft.labels}
        onChange={(labels) => setDraft((current) => ({ ...current, labels }))}
      />
    );
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider delayDuration={200}>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Open filters"
                className={cn(
                  'h-9 cursor-pointer gap-1.5 px-3',
                  (open || hasActiveFilters) &&
                    'border-primary text-primary hover:text-primary'
                )}
              >
                <Filter className="size-3.5" />
                Filter
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Press Shift + F to open and close
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent
        showCloseButton
        className="gap-0 overflow-hidden p-0 sm:max-w-2xl"
      >
        {/*
          Reserve top-right space for DialogContent's absolute close button
          so it never sits on top of the options search field.
        */}
        <div className="flex">
          <aside className="border-border flex w-44 shrink-0 flex-col border-r p-3 pb-4">
            <nav className="space-y-0.5" aria-label="Filter fields">
              {fields.map((field) => (
                <FilterFieldNavItem
                  key={field.id}
                  label={field.label}
                  active={field.id === activeField.id}
                  onSelect={() => setActiveFieldId(field.id)}
                />
              ))}
            </nav>

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

            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground mt-auto h-8 justify-start px-2 text-xs"
              onClick={handleClearAllDraft}
            >
              Clear all
            </Button>
          </aside>

          <section className="flex min-w-0 flex-1 flex-col">
            {fieldPane}

            <div className="border-border flex items-center justify-between gap-2 border-t px-3 pt-2 pb-4">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="text-muted-foreground h-8 px-2 text-xs"
                onClick={clearActiveField}
              >
                Clear
              </Button>
              <div className="flex items-center gap-2">
                <span className="text-muted-foreground hidden text-xs sm:inline">
                  {footerCountLabel}
                </span>
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
                  onClick={handleOkay}
                >
                  Okay
                </Button>
              </div>
            </div>
          </section>
        </div>
      </DialogContent>
    </Dialog>
  );
}
