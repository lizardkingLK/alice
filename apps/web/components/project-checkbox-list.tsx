'use client';

import { useMemo } from 'react';
import { cn } from '@repo/ui/lib/utils';
import {
  CheckboxOptionList,
  type CheckboxOption,
} from '@/components/checkbox-option-list';

export type ProjectCheckboxOption = {
  readonly key: string;
  readonly name: string;
};

type ProjectCheckboxListProps = {
  readonly projects: readonly ProjectCheckboxOption[];
  readonly selectedKeys: readonly string[];
  // eslint-disable-next-line no-unused-vars -- selection change callback
  readonly onSelectedKeysChange: (keys: string[]) => void;
  readonly emptyText?: string;
  readonly checkboxIdPrefix?: string;
  readonly disabled?: boolean;
  readonly listClassName?: string;
};

function toProjectCheckboxOptions(
  projects: readonly ProjectCheckboxOption[]
): CheckboxOption[] {
  return projects.map((project) => ({
    id: project.key,
    label: project.name,
    secondaryLabel: project.key,
  }));
}

export function ProjectCheckboxList({
  projects,
  selectedKeys,
  onSelectedKeysChange,
  emptyText = 'No projects available.',
  checkboxIdPrefix = 'project-checkbox',
  disabled = false,
  listClassName,
}: Readonly<ProjectCheckboxListProps>) {
  const options = useMemo(() => toProjectCheckboxOptions(projects), [projects]);

  return (
    <CheckboxOptionList
      options={options}
      selectedIds={selectedKeys}
      onSelectedIdsChange={onSelectedKeysChange}
      emptyText={emptyText}
      checkboxIdPrefix={checkboxIdPrefix}
      disabled={disabled}
      emptyClassName="p-4 text-sm"
      listClassName={cn('max-h-60 w-full p-3', listClassName)}
      itemClassName="rounded-md px-3 py-2"
      primaryLabelClassName="text-foreground text-sm font-semibold"
      secondaryLabelClassName="text-muted-foreground text-xs"
    />
  );
}
