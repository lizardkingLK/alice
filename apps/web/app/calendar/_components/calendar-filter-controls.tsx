'use client';

import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { ALL_OPTION } from '@/app/_shared/values';
import type { CalendarActionItem } from './calendar-client.types';

export type CalendarFilterOption = {
  readonly id: string;
  readonly label: string;
};

export function applyCalendarFilterChange(options: {
  readonly value: string;
  // eslint-disable-next-line no-unused-vars -- setter signature
  readonly setValue: (value: string) => void;
  readonly actionType: Extract<
    CalendarActionItem['type'],
    'filter_project' | 'filter_assignee' | 'filter_type'
  >;
  readonly label: string;
  // eslint-disable-next-line no-unused-vars -- logger signature
  readonly logAction: (action: CalendarActionItem) => void;
}): void {
  const { value, setValue, actionType, label, logAction } = options;
  setValue(value);
  logAction({
    type: actionType,
    entity: { id: value, value, label },
  });
}

export function CalendarFilterSelect({
  value,
  onValueChange,
  placeholder,
  allLabel,
  options,
  triggerClassName = 'h-8 w-36 text-xs sm:w-40',
  includeAll = true,
}: Readonly<{
  value: string;
  // eslint-disable-next-line no-unused-vars -- select change
  onValueChange: (value: string) => void;
  placeholder: string;
  allLabel: string;
  options: readonly CalendarFilterOption[];
  triggerClassName?: string;
  includeAll?: boolean;
}>) {
  return (
    <Select value={value} onValueChange={onValueChange}>
      <SelectTrigger className={triggerClassName}>
        <SelectValue placeholder={placeholder} />
      </SelectTrigger>
      <SelectContent>
        {includeAll ? (
          <SelectItem value={ALL_OPTION}>{allLabel}</SelectItem>
        ) : null}
        {options.map((option) => (
          <SelectItem key={option.id} value={option.id}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
