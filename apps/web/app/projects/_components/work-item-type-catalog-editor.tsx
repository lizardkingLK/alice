'use client';

import { useMemo, useState, type DragEvent } from 'react';
import {
  createProjectWorkItemTypeKey,
  normalizeWorkItemTypeName,
  type ProjectWorkItemTypeDef,
} from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { GripVertical, Plus, Trash2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  workItemTypeCardToneStyle,
  workItemTypeColorFromDef,
  workItemTypeIconFromDef,
} from '@/app/work-items/_helpers/work-item-type';
import {
  WORK_ITEM_TYPE_ICON_OPTIONS,
  resolveWorkItemTypeIcon,
} from '@/app/work-items/_helpers/work-item-type-icons';

function nextUniqueTypeName(
  existing: readonly ProjectWorkItemTypeDef[]
): string {
  const taken = new Set(
    existing.map((def) => normalizeWorkItemTypeName(def.name)).filter(Boolean)
  );
  if (!taken.has('new type')) {
    return 'New type';
  }
  let index = 2;
  while (taken.has(`new type ${index}`)) {
    index += 1;
  }
  return `New type ${index}`;
}

function duplicateNameKeys(
  defs: readonly ProjectWorkItemTypeDef[]
): ReadonlySet<string> {
  const counts = new Map<string, number>();
  for (const def of defs) {
    const normalized = normalizeWorkItemTypeName(def.name);
    if (!normalized) {
      continue;
    }
    counts.set(normalized, (counts.get(normalized) ?? 0) + 1);
  }
  const duplicates = new Set<string>();
  for (const def of defs) {
    const normalized = normalizeWorkItemTypeName(def.name);
    if (normalized && (counts.get(normalized) ?? 0) > 1) {
      duplicates.add(def.key);
    }
  }
  return duplicates;
}

function renumberLevels(
  defs: readonly ProjectWorkItemTypeDef[]
): ProjectWorkItemTypeDef[] {
  return defs.map((def, index) => ({ ...def, level: index }));
}

function reorderByKey(
  defs: readonly ProjectWorkItemTypeDef[],
  draggedKey: string,
  targetKey: string
): ProjectWorkItemTypeDef[] {
  if (draggedKey === targetKey) {
    return [...defs];
  }
  const next = [...defs];
  const from = next.findIndex((def) => def.key === draggedKey);
  const to = next.findIndex((def) => def.key === targetKey);
  if (from < 0 || to < 0) {
    return next;
  }
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item!);
  return renumberLevels(next);
}

export type WorkItemTypeCatalogEditorProps = {
  readonly value: readonly ProjectWorkItemTypeDef[];
  // eslint-disable-next-line no-unused-vars -- callback prop signature
  readonly onChange: (next: ProjectWorkItemTypeDef[]) => void;
  readonly disabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback prop signature
  readonly onRequestRemove?: (key: string) => void;
  readonly className?: string;
};

function TypeIconPicker({
  value,
  disabled,
  onChange,
}: Readonly<{
  value: string;
  disabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- callback prop signature
  onChange: (icon: string) => void;
}>) {
  const [open, setOpen] = useState(false);
  const SelectedIcon = resolveWorkItemTypeIcon(value);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          disabled={disabled}
          className="h-10 w-full justify-start gap-2"
          aria-label="Choose type icon"
        >
          <SelectedIcon className="size-4 shrink-0" aria-hidden />
          <span className="truncate text-sm">
            {WORK_ITEM_TYPE_ICON_OPTIONS.find((option) => option.key === value)
              ?.label ?? 'Icon'}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-2" align="start">
        <div className="grid grid-cols-6 gap-1">
          {WORK_ITEM_TYPE_ICON_OPTIONS.map((option) => {
            const isSelected = option.key === value;
            return (
              <Button
                key={option.key}
                type="button"
                variant={isSelected ? 'secondary' : 'ghost'}
                size="icon"
                className={cn(
                  'size-10',
                  isSelected && 'ring-primary ring-2 ring-offset-1'
                )}
                title={option.label}
                aria-label={option.label}
                aria-pressed={isSelected}
                onClick={() => {
                  onChange(option.key);
                  setOpen(false);
                }}
              >
                <option.Icon className="size-4" aria-hidden />
              </Button>
            );
          })}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function WorkItemTypeCatalogEditor({
  value,
  onChange,
  disabled = false,
  onRequestRemove,
  className,
}: WorkItemTypeCatalogEditorProps) {
  const ordered = useMemo(
    () => [...value].sort((a, b) => a.level - b.level),
    [value]
  );
  const [draggedKey, setDraggedKey] = useState<string | null>(null);
  const [dropTargetKey, setDropTargetKey] = useState<string | null>(null);

  const updateAt = (key: string, patch: Partial<ProjectWorkItemTypeDef>) => {
    onChange(
      ordered.map((def) => (def.key === key ? { ...def, ...patch } : def))
    );
  };

  const addType = () => {
    const name = nextUniqueTypeName(ordered);
    onChange(
      renumberLevels([
        ...ordered,
        {
          key: createProjectWorkItemTypeKey(),
          name,
          description: '',
          icon: 'square-check',
          color: '#64748B',
          level: ordered.length,
        },
      ])
    );
  };

  const removeType = (key: string) => {
    if (onRequestRemove) {
      onRequestRemove(key);
      return;
    }
    onChange(renumberLevels(ordered.filter((def) => def.key !== key)));
  };

  const handleDragStart = (event: DragEvent<HTMLElement>, key: string) => {
    if (disabled) {
      return;
    }
    setDraggedKey(key);
    event.dataTransfer.effectAllowed = 'move';
    event.dataTransfer.setData('text/plain', key);
  };

  const handleDragOver = (event: DragEvent<HTMLDivElement>, key: string) => {
    if (disabled || !draggedKey || draggedKey === key) {
      return;
    }
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setDropTargetKey(key);
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, key: string) => {
    event.preventDefault();
    if (disabled || !draggedKey) {
      return;
    }
    onChange(reorderByKey(ordered, draggedKey, key));
    setDraggedKey(null);
    setDropTargetKey(null);
  };

  const clearDragState = () => {
    setDraggedKey(null);
    setDropTargetKey(null);
  };

  const duplicateKeys = useMemo(() => duplicateNameKeys(ordered), [ordered]);

  return (
    <div className={cn('space-y-3', className)}>
      {ordered.map((def) => {
        const Icon = workItemTypeIconFromDef(def);
        const tone = workItemTypeCardToneStyle(def);
        const colorValue = workItemTypeColorFromDef(def);
        const isDragging = draggedKey === def.key;
        const isDropTarget =
          dropTargetKey === def.key && draggedKey !== def.key;
        const hasDuplicateName = duplicateKeys.has(def.key);

        return (
          <div
            key={def.key}
            onDragOver={(event) => handleDragOver(event, def.key)}
            onDrop={(event) => handleDrop(event, def.key)}
            className={cn(
              'rounded-lg border p-3 transition-shadow',
              isDragging && 'opacity-40',
              isDropTarget && 'ring-primary ring-2 ring-offset-2',
              hasDuplicateName && 'border-destructive/50'
            )}
            style={tone}
          >
            <div className="mb-3 flex items-center gap-2">
              <button
                type="button"
                draggable={!disabled}
                disabled={disabled}
                aria-label={`Reorder ${def.name.trim() || 'type'}`}
                title="Drag to reorder"
                className={cn(
                  'text-muted-foreground inline-flex size-7 shrink-0 items-center justify-center rounded-md',
                  !disabled &&
                    'hover:bg-background/50 cursor-grab active:cursor-grabbing'
                )}
                onDragStart={(event) => handleDragStart(event, def.key)}
                onDragEnd={clearDragState}
              >
                <GripVertical className="size-4 opacity-70" aria-hidden />
              </button>
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="truncate text-sm font-semibold">
                {def.name.trim() || 'Untitled type'}
              </span>
              <span className="text-muted-foreground ml-auto text-xs">
                Level {def.level}
              </span>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor={`wit-name-${def.key}`}>Name</Label>
                <Input
                  id={`wit-name-${def.key}`}
                  value={def.name}
                  disabled={disabled}
                  aria-invalid={hasDuplicateName}
                  onChange={(event) =>
                    updateAt(def.key, { name: event.target.value })
                  }
                />
                {hasDuplicateName ? (
                  <p className="text-destructive text-xs">
                    Type names must be unique. Change the name.
                  </p>
                ) : null}
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`wit-icon-${def.key}`}>Icon</Label>
                <TypeIconPicker
                  value={def.icon}
                  disabled={disabled}
                  onChange={(icon) => updateAt(def.key, { icon })}
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`wit-color-${def.key}`}>Color</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={`wit-color-${def.key}`}
                    type="color"
                    value={colorValue}
                    disabled={disabled}
                    className="border-input h-10 w-14 cursor-pointer p-1"
                    onChange={(event) =>
                      updateAt(def.key, {
                        color: event.target.value.toUpperCase(),
                      })
                    }
                  />
                  <Input
                    value={colorValue}
                    disabled={disabled}
                    maxLength={7}
                    className="font-mono uppercase"
                    onChange={(event) => {
                      const next = event.target.value.trim();
                      if (/^#[0-9A-Fa-f]{6}$/.test(next)) {
                        updateAt(def.key, { color: next.toUpperCase() });
                      }
                    }}
                    aria-label={`${def.name.trim() || 'Type'} color hex`}
                  />
                </div>
              </div>
              <div className="space-y-1.5 sm:col-span-2">
                <Label htmlFor={`wit-desc-${def.key}`}>Type description</Label>
                <Textarea
                  id={`wit-desc-${def.key}`}
                  value={def.description ?? ''}
                  disabled={disabled}
                  rows={2}
                  onChange={(event) =>
                    updateAt(def.key, { description: event.target.value })
                  }
                />
              </div>
            </div>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || ordered.length <= 1}
                onClick={() => removeType(def.key)}
              >
                <Trash2 data-icon="inline-start" />
                Remove
              </Button>
            </div>
          </div>
        );
      })}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled}
        onClick={addType}
      >
        <Plus data-icon="inline-start" />
        Add type
      </Button>
    </div>
  );
}
