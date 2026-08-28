'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { ChevronDown } from '@repo/ui/lib/icons';
import {
  SUBTASK_SORT_DIRECTION_LABELS,
  SUBTASK_SORT_DIRECTIONS,
  SUBTASK_SORT_FIELD_LABELS,
  SUBTASK_SORT_FIELDS,
  type SubtaskSortDirection,
  type SubtaskSortField,
} from '@/app/work-items/_helpers/work-item-sort-subtasks';

/* eslint-disable no-unused-vars */
type LabelledSortRadioGroupProps<T extends string> = {
  readonly label: string;
  readonly value: T;
  readonly options: readonly T[];
  readonly labels: Record<T, string>;
  readonly onValueChange: (value: T) => void;
  readonly disabled?: boolean;
};
/* eslint-enable no-unused-vars */

function LabelledSortRadioGroup<T extends string>({
  label,
  value,
  options,
  labels,
  onValueChange,
  disabled = false,
}: Readonly<LabelledSortRadioGroupProps<T>>) {
  return (
    <DropdownMenuGroup>
      <DropdownMenuLabel>{label}</DropdownMenuLabel>
      <DropdownMenuRadioGroup
        value={value}
        onValueChange={(next) => onValueChange(next as T)}
      >
        {options.map((option) => (
          <DropdownMenuRadioItem
            key={option}
            value={option}
            disabled={disabled}
          >
            {labels[option]}
          </DropdownMenuRadioItem>
        ))}
      </DropdownMenuRadioGroup>
    </DropdownMenuGroup>
  );
}

/* eslint-disable no-unused-vars */
type SubtaskOrderByMenuProps = {
  readonly sortField: SubtaskSortField;
  readonly sortDirection: SubtaskSortDirection;
  readonly onSortFieldChange: (field: SubtaskSortField) => void;
  readonly onSortDirectionChange: (direction: SubtaskSortDirection) => void;
};
/* eslint-enable no-unused-vars */

export function SubtaskOrderByMenu({
  sortField,
  sortDirection,
  onSortFieldChange,
  onSortDirectionChange,
}: Readonly<SubtaskOrderByMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="cursor-pointer">
          Order by
          {sortField !== 'none' ? (
            <span className="text-muted-foreground font-normal">
              {SUBTASK_SORT_FIELD_LABELS[sortField]}
              {' · '}
              {SUBTASK_SORT_DIRECTION_LABELS[sortDirection]}
            </span>
          ) : null}
          <ChevronDown data-icon="inline-end" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-44">
        <LabelledSortRadioGroup
          label="Sort by"
          value={sortField}
          options={SUBTASK_SORT_FIELDS}
          labels={SUBTASK_SORT_FIELD_LABELS}
          onValueChange={onSortFieldChange}
        />
        <DropdownMenuSeparator />
        <LabelledSortRadioGroup
          label="Direction"
          value={sortDirection}
          options={SUBTASK_SORT_DIRECTIONS}
          labels={SUBTASK_SORT_DIRECTION_LABELS}
          onValueChange={onSortDirectionChange}
          disabled={sortField === 'none'}
        />
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
