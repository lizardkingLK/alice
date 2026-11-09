'use client';

import type { ReactNode } from 'react';
import {
  findProjectWorkItemTypeDef,
  workItemTypeDisplayName,
  type ProjectWorkItemTypeDef,
  type WorkItemType,
} from '@repo/types';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { workItemTypeIconFromDef } from '@/app/work-items/_helpers/work-item-type';

type WorkItemFormTypeSelectProps = {
  readonly type: string;
  // eslint-disable-next-line no-unused-vars -- controlled setter
  readonly onTypeChange: (value: string) => void;
  readonly availableTypes: readonly WorkItemType[];
  /** Catalog defs for display name + icon (values submitted remain keys). */
  readonly typeDefs?: readonly ProjectWorkItemTypeDef[] | null;
  readonly typeLocked: boolean;
  readonly triggerClassName?: string;
  readonly placeholder?: string;
  readonly 'aria-label'?: string;
  /** Optional leading icon (classic layout). Prefer off for modern pills. */
  readonly triggerStart?: ReactNode;
  /**
   * When false, options are label-only so the closed trigger does not stack a
   * catalog icon beside `triggerStart` (modern create/edit pills).
   */
  readonly showOptionIcons?: boolean;
};

/**
 * Shared type Select + hidden FormData input for classic and modern forms.
 * Options show catalog name (+ optional icon); submitted value is the type key.
 */
export function WorkItemFormTypeSelect({
  type,
  onTypeChange,
  availableTypes,
  typeDefs = null,
  typeLocked,
  triggerClassName,
  placeholder = 'Select type...',
  'aria-label': ariaLabel,
  triggerStart,
  showOptionIcons = true,
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
          {availableTypes.map((taskType) => {
            const def = findProjectWorkItemTypeDef(typeDefs, taskType) ?? {
              key: taskType,
              name: workItemTypeDisplayName(taskType, typeDefs),
              icon: 'square-check',
              level: 0,
            };
            const label = workItemTypeDisplayName(taskType, typeDefs);
            if (!showOptionIcons) {
              return (
                <SelectItem key={taskType} value={taskType}>
                  {label}
                </SelectItem>
              );
            }
            const Icon = workItemTypeIconFromDef(def);
            return (
              <SelectItem key={taskType} value={taskType}>
                <span className="flex items-center gap-2">
                  <Icon className="size-3.5 shrink-0" aria-hidden />
                  {label}
                </span>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      <input type="hidden" name="type" value={type} />
    </>
  );
}
