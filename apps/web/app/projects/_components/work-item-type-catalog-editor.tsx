'use client';

import { useMemo, useState, type DragEvent } from 'react';
import {
  createProjectWorkItemTypeKey,
  normalizeWorkItemTypeName,
  type ProjectWorkItemTypeDef,
} from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { GripVertical, Plus, Trash2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { workItemTypeColorFromDef } from '@/app/work-items/_helpers/work-item-type';
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

type DropEdge = 'before' | 'after';

type DropIndicator = {
  readonly key: string;
  readonly edge: DropEdge;
};

function reorderByKey(
  defs: readonly ProjectWorkItemTypeDef[],
  draggedKey: string,
  targetKey: string,
  edge: DropEdge
): ProjectWorkItemTypeDef[] {
  if (draggedKey === targetKey) {
    return [...defs];
  }
  const next = [...defs];
  const from = next.findIndex((def) => def.key === draggedKey);
  let to = next.findIndex((def) => def.key === targetKey);
  if (from < 0 || to < 0) {
    return next;
  }
  const [item] = next.splice(from, 1);
  if (from < to) {
    to -= 1;
  }
  const insertAt = edge === 'after' ? to + 1 : to;
  next.splice(insertAt, 0, item!);
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
  const selectedLabel =
    WORK_ITEM_TYPE_ICON_OPTIONS.find((option) => option.key === value)?.label ??
    'Icon';

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon-sm"
          disabled={disabled}
          className="shrink-0"
          aria-label={`Choose type icon (${selectedLabel})`}
          title={selectedLabel}
        >
          <SelectedIcon className="size-4 shrink-0" aria-hidden />
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

function TypeColorSwatch({
  id,
  value,
  disabled,
  label,
  onChange,
}: Readonly<{
  id: string;
  value: string;
  disabled?: boolean;
  label: string;
  // eslint-disable-next-line no-unused-vars -- callback prop signature
  onChange: (color: string) => void;
}>) {
  return (
    <label
      htmlFor={id}
      title={value}
      className={cn(
        'border-input relative inline-flex size-7 shrink-0 items-center justify-center rounded-full border shadow-xs',
        disabled
          ? 'cursor-not-allowed opacity-50'
          : 'hover:ring-ring/40 cursor-pointer hover:ring-2'
      )}
      style={{ backgroundColor: value }}
    >
      <span className="sr-only">{label}</span>
      <input
        id={id}
        type="color"
        value={value}
        disabled={disabled}
        aria-label={label}
        className="absolute inset-0 size-full cursor-pointer opacity-0 disabled:cursor-not-allowed"
        onChange={(event) => onChange(event.target.value.toUpperCase())}
      />
    </label>
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
  const [dropIndicator, setDropIndicator] = useState<DropIndicator | null>(
    null
  );

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
    const rect = event.currentTarget.getBoundingClientRect();
    const edge: DropEdge =
      event.clientY < rect.top + rect.height / 2 ? 'before' : 'after';
    setDropIndicator((prev) => {
      if (prev?.key === key && prev.edge === edge) {
        return prev;
      }
      return { key, edge };
    });
  };

  const resolveDropEdge = (
    event: DragEvent<HTMLDivElement>,
    key: string
  ): DropEdge => {
    if (dropIndicator?.key === key) {
      return dropIndicator.edge;
    }
    const rect = event.currentTarget.getBoundingClientRect();
    if (event.clientY < rect.top + rect.height / 2) {
      return 'before';
    }
    return 'after';
  };

  const handleDrop = (event: DragEvent<HTMLDivElement>, key: string) => {
    event.preventDefault();
    if (disabled || !draggedKey) {
      return;
    }
    onChange(
      reorderByKey(ordered, draggedKey, key, resolveDropEdge(event, key))
    );
    setDraggedKey(null);
    setDropIndicator(null);
  };

  const clearDragState = () => {
    setDraggedKey(null);
    setDropIndicator(null);
  };

  const duplicateKeys = useMemo(() => duplicateNameKeys(ordered), [ordered]);

  return (
    <div className={cn('space-y-2', className)}>
      {ordered.map((def) => {
        const colorValue = workItemTypeColorFromDef(def);
        const isDragging = draggedKey === def.key;
        const showBeforeSeparator =
          dropIndicator?.key === def.key &&
          dropIndicator.edge === 'before' &&
          draggedKey !== def.key;
        const showAfterSeparator =
          dropIndicator?.key === def.key &&
          dropIndicator.edge === 'after' &&
          draggedKey !== def.key;
        const hasDuplicateName = duplicateKeys.has(def.key);
        const displayName = def.name.trim() || 'type';

        return (
          <div
            key={def.key}
            className="relative"
            onDragOver={(event) => handleDragOver(event, def.key)}
            onDrop={(event) => handleDrop(event, def.key)}
          >
            {showBeforeSeparator ? (
              <div
                aria-hidden
                className="bg-primary pointer-events-none absolute -top-1.5 right-1 left-1 z-10 h-0.5 rounded-full"
              />
            ) : null}
            <div
              className={cn(
                'bg-card rounded-lg border px-2 py-2 shadow-xs transition-opacity',
                isDragging && 'opacity-40',
                hasDuplicateName && 'border-destructive/50'
              )}
            >
              <div className="grid grid-cols-[auto_auto_minmax(0,1fr)_auto_auto_auto] items-center gap-x-1.5 gap-y-1.5">
                <button
                  type="button"
                  draggable={!disabled}
                  disabled={disabled}
                  aria-label={`Reorder ${displayName}`}
                  title="Drag to reorder"
                  className={cn(
                    'text-muted-foreground inline-flex size-8 shrink-0 items-center justify-center rounded-md',
                    !disabled &&
                      'hover:bg-muted cursor-grab active:cursor-grabbing'
                  )}
                  onDragStart={(event) => handleDragStart(event, def.key)}
                  onDragEnd={clearDragState}
                >
                  <GripVertical className="size-4 opacity-70" aria-hidden />
                </button>

                <TypeIconPicker
                  value={def.icon}
                  disabled={disabled}
                  onChange={(icon) => updateAt(def.key, { icon })}
                />

                <Input
                  id={`wit-name-${def.key}`}
                  value={def.name}
                  disabled={disabled}
                  aria-invalid={hasDuplicateName}
                  aria-label="Name"
                  placeholder="Type name"
                  className="h-8 min-w-0"
                  onChange={(event) =>
                    updateAt(def.key, { name: event.target.value })
                  }
                />

                <TypeColorSwatch
                  id={`wit-color-${def.key}`}
                  value={colorValue}
                  disabled={disabled}
                  label={`${displayName} color`}
                  onChange={(color) => updateAt(def.key, { color })}
                />

                <span
                  className="text-muted-foreground bg-muted/60 inline-flex min-w-8 justify-center rounded-md px-1.5 py-1 text-[11px] font-medium tracking-wide uppercase"
                  title={`Hierarchy level ${def.level}`}
                >
                  L{def.level}
                </span>

                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  disabled={disabled || ordered.length <= 1}
                  aria-label="Remove"
                  title="Remove type"
                  className="text-muted-foreground hover:text-destructive shrink-0"
                  onClick={() => removeType(def.key)}
                >
                  <Trash2 className="size-4" aria-hidden />
                </Button>

                {hasDuplicateName ? (
                  <p className="text-destructive col-start-3 col-end-6 text-xs">
                    Type names must be unique. Change the name.
                  </p>
                ) : null}

                <Input
                  id={`wit-desc-${def.key}`}
                  value={def.description ?? ''}
                  disabled={disabled}
                  aria-label="Type description"
                  placeholder="Short description (optional)"
                  className="text-muted-foreground col-start-3 col-end-6 h-8"
                  onChange={(event) =>
                    updateAt(def.key, { description: event.target.value })
                  }
                />
              </div>
            </div>
            {showAfterSeparator ? (
              <div
                aria-hidden
                className="bg-primary pointer-events-none absolute right-1 -bottom-1.5 left-1 z-10 h-0.5 rounded-full"
              />
            ) : null}
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
