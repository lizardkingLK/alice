'use client';

import type { ReactNode } from 'react';
import type { WorkItemType } from '@repo/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';

type WorkItemFormTypeSelectProps = {
  readonly type: string;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onTypeChange: (value: string) => void;
  readonly availableTypes: readonly WorkItemType[];
  readonly typeLocked: boolean;
  readonly triggerClassName?: string;
  readonly placeholder?: string;
  readonly 'aria-label'?: string;
  /** Optional leading icon (modern pill layout). */
  readonly triggerStart?: ReactNode;
};

/**
 * Shared type Select + hidden FormData input for classic and modern forms.
 */
export function WorkItemFormTypeSelect({
  type,
  onTypeChange,
  availableTypes,
  typeLocked,
  triggerClassName,
  placeholder = 'Select type...',
  'aria-label': ariaLabel,
  triggerStart,
}: Readonly<WorkItemFormTypeSelectProps>) {
  return (
    <>
      <Select value={type} onValueChange={onTypeChange} disabled={typeLocked}>
        <SelectTrigger
          id="type"
          className={triggerClassName}
          aria-label={ariaLabel}
        >
          {triggerStart}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {availableTypes.map((taskType) => (
            <SelectItem key={taskType} value={taskType}>
              {taskType}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="type" value={type} />
    </>
  );
}
