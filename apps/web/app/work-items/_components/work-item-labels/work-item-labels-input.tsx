'use client';

import { useState, type KeyboardEvent } from 'react';
import {
  WORK_ITEM_LABEL_MAX_LENGTH,
  WORK_ITEM_LABELS_MAX_COUNT,
  normalizeWorkItemLabels,
} from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { X } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';

type WorkItemLabelsInputProps = {
  readonly id?: string;
  readonly name?: string;
  readonly value: readonly string[];
  // eslint-disable-next-line no-unused-vars -- controlled callback
  readonly onChange: (labels: string[]) => void;
  readonly disabled?: boolean;
  readonly className?: string;
  readonly placeholder?: string;
};

function tryAddLabel(
  current: readonly string[],
  draft: string
): string[] | null {
  const candidate = draft.trim();
  if (!candidate) {
    return null;
  }
  try {
    return normalizeWorkItemLabels([...current, candidate]);
  } catch {
    return null;
  }
}

/**
 * Chip input for work-item labels. Persists via hidden JSON `name` field when set.
 */
export function WorkItemLabelsInput({
  id = 'labels',
  name = 'labels',
  value,
  onChange,
  disabled = false,
  className,
  placeholder = 'Add label and press Enter',
}: Readonly<WorkItemLabelsInputProps>) {
  const [draft, setDraft] = useState('');

  const commitDraft = () => {
    const next = tryAddLabel(value, draft);
    if (!next) {
      return;
    }
    onChange(next);
    setDraft('');
  };

  const removeLabel = (label: string) => {
    onChange(value.filter((item) => item !== label));
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter' || event.key === ',') {
      event.preventDefault();
      commitDraft();
      return;
    }
    if (event.key === 'Backspace' && !draft && value.length > 0) {
      onChange(value.slice(0, -1));
    }
  };

  const atLimit = value.length >= WORK_ITEM_LABELS_MAX_COUNT;

  return (
    <div className={cn('space-y-2', className)}>
      <div className="border-input bg-background flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border px-2 py-1.5">
        {value.map((label) => (
          <Badge
            key={label}
            variant="secondary"
            className="flex max-w-full items-center gap-1 pr-1"
          >
            <span className="truncate">{label}</span>
            {disabled ? null : (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="size-4 shrink-0 cursor-pointer p-0"
                aria-label={`Remove label ${label}`}
                onClick={() => removeLabel(label)}
              >
                <X className="size-3" />
              </Button>
            )}
          </Badge>
        ))}
        <Input
          id={id}
          value={draft}
          disabled={disabled || atLimit}
          maxLength={WORK_ITEM_LABEL_MAX_LENGTH}
          placeholder={value.length === 0 ? placeholder : undefined}
          aria-label="Add label"
          className="h-7 min-w-32 flex-1 border-0 bg-transparent px-1 shadow-none focus-visible:ring-0"
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={onKeyDown}
          onBlur={commitDraft}
        />
      </div>
      <input type="hidden" name={name} value={JSON.stringify(value)} />
    </div>
  );
}
