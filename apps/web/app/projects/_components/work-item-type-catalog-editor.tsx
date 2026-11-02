'use client';

import { useMemo } from 'react';
import type { ProjectWorkItemTypeDef } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { ArrowDown, ArrowUp, Plus, Trash2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  workItemTypeBadgeStyle,
  workItemTypeIcon,
} from '@/app/work-items/_helpers/work-item-type';

const ICON_OPTIONS = [
  'layers',
  'trophy',
  'bookmark',
  'square-check',
  'circle-alert',
] as const;

function slugifyKey(name: string): string {
  const chars: string[] = [];
  let pendingUnderscore = false;
  for (const char of name.trim()) {
    if (/[a-zA-Z0-9]/.test(char)) {
      if (pendingUnderscore && chars.length > 0) {
        chars.push('_');
      }
      chars.push(char);
      pendingUnderscore = false;
    } else {
      pendingUnderscore = true;
    }
  }
  const slug = chars.join('');
  return slug.length > 0 ? slug : `Type_${Date.now()}`;
}

function uniqueKey(base: string, existing: ReadonlySet<string>): string {
  if (!existing.has(base)) {
    return base;
  }
  let index = 2;
  while (existing.has(`${base}_${index}`)) {
    index += 1;
  }
  return `${base}_${index}`;
}

function renumberLevels(
  defs: readonly ProjectWorkItemTypeDef[]
): ProjectWorkItemTypeDef[] {
  return defs.map((def, index) => ({ ...def, level: index }));
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

  const updateAt = (key: string, patch: Partial<ProjectWorkItemTypeDef>) => {
    onChange(
      ordered.map((def) => (def.key === key ? { ...def, ...patch } : def))
    );
  };

  const move = (key: string, direction: -1 | 1) => {
    const index = ordered.findIndex((def) => def.key === key);
    const target = index + direction;
    if (index < 0 || target < 0 || target >= ordered.length) {
      return;
    }
    const next = [...ordered];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item!);
    onChange(renumberLevels(next));
  };

  const addType = () => {
    const keys = new Set(ordered.map((def) => def.key));
    const name = 'New type';
    const key = uniqueKey(slugifyKey(name), keys);
    onChange(
      renumberLevels([
        ...ordered,
        {
          key,
          name,
          description: '',
          icon: 'square-check',
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

  return (
    <div className={cn('space-y-3', className)}>
      {ordered.map((def, index) => {
        const Icon = workItemTypeIcon(def.key);
        return (
          <div
            key={def.key}
            className={cn(
              'rounded-lg border p-3',
              workItemTypeBadgeStyle(def.key)
            )}
          >
            <div className="mb-3 flex items-center gap-2">
              <Icon className="size-4 shrink-0" aria-hidden />
              <span className="text-muted-foreground font-mono text-xs">
                {def.key}
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
                  onChange={(event) =>
                    updateAt(def.key, { name: event.target.value })
                  }
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor={`wit-icon-${def.key}`}>Icon</Label>
                <Select
                  value={def.icon}
                  disabled={disabled}
                  onValueChange={(icon) => updateAt(def.key, { icon })}
                >
                  <SelectTrigger id={`wit-icon-${def.key}`}>
                    <SelectValue placeholder="Icon" />
                  </SelectTrigger>
                  <SelectContent>
                    {ICON_OPTIONS.map((icon) => (
                      <SelectItem key={icon} value={icon}>
                        {icon}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
                disabled={disabled || index === 0}
                onClick={() => move(def.key, -1)}
              >
                <ArrowUp data-icon="inline-start" />
                Up
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={disabled || index === ordered.length - 1}
                onClick={() => move(def.key, 1)}
              >
                <ArrowDown data-icon="inline-start" />
                Down
              </Button>
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
