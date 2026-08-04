'use client';

import type { ReactNode } from 'react';
import { WORK_ITEM_PRIORITIES, type WorkItemPriority } from '@repo/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { formatLabelFirstLetterCapitalized } from '@/app/_shared/utility';

type WorkItemPrioritySelectProps = {
  priority: WorkItemPriority;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onPriorityChange: (priority: WorkItemPriority) => void;
  triggerClassName?: string;
  triggerStart?: ReactNode;
  placeholder?: string;
  id?: string;
};

/**
 * Shared priority select + hidden FormData field for classic and modern forms.
 */
export function WorkItemPrioritySelect({
  priority,
  onPriorityChange,
  triggerClassName,
  triggerStart,
  placeholder = 'Select priority...',
  id = 'priority',
}: Readonly<WorkItemPrioritySelectProps>) {
  return (
    <>
      <Select
        value={priority}
        onValueChange={(value) => onPriorityChange(value as WorkItemPriority)}
      >
        <SelectTrigger
          id={id}
          aria-label="Priority"
          className={triggerClassName}
        >
          {triggerStart}
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {WORK_ITEM_PRIORITIES.map((item) => (
            <SelectItem key={item} value={item}>
              {formatLabelFirstLetterCapitalized(item)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <input type="hidden" name="priority" value={priority} />
    </>
  );
}
