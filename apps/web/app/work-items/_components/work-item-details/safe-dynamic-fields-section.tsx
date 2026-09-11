'use client';

import React, {
  Component,
  useState,
  useEffect,
  type ReactNode,
  type ErrorInfo,
} from 'react';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Switch } from '@repo/ui/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { AlertTriangle, PencilIcon, Check, X } from '@repo/ui/lib/icons';
import {
  ProjectFieldsConfigSchema,
  type ProjectFieldsConfig,
  type DynamicFieldProperty,
  DynamicFieldTypeEnum,
  DynamicFieldFormatEnum,
  DynamicFieldInputTypeEnum,
  TypeofEnum,
} from '@repo/types';

interface DynamicFieldsErrorBoundaryProps {
  readonly children: ReactNode;
  readonly fallback: ReactNode;
}

interface DynamicFieldsErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class DynamicFieldsErrorBoundary extends Component<
  DynamicFieldsErrorBoundaryProps,
  DynamicFieldsErrorBoundaryState
> {
  constructor(props: DynamicFieldsErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(
    error: Error
  ): DynamicFieldsErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Dynamic fields rendering failed:', error, info);
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback;
    }
    return this.props.children;
  }
}

export function DynamicFieldsErrorNotice() {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-400">
      <AlertTriangle className="size-4 shrink-0" />
      <span>
        Some custom fields could not be displayed due to a configuration
        mismatch.
      </span>
    </div>
  );
}

function formatDisplayValue(value: unknown): string {
  const isNonNullObject = typeof value === TypeofEnum.OBJECT && value !== null;
  const formatters: Partial<Record<string, () => string>> = {
    ...(typeof value === TypeofEnum.STRING
      ? { str: () => value as string }
      : {}),
    ...(typeof value === TypeofEnum.NUMBER ||
    typeof value === TypeofEnum.BOOLEAN
      ? { primitive: () => String(value) }
      : {}),
    ...(isNonNullObject
      ? {
          obj: () => {
            try {
              return JSON.stringify(value);
            } catch {
              return '';
            }
          },
        }
      : {}),
  };

  const execute =
    formatters.str ?? formatters.primitive ?? formatters.obj ?? (() => '');
  return execute();
}

export function DynamicFieldValueDisplay({
  property,
  value,
}: Readonly<{
  property: DynamicFieldProperty;
  value: unknown;
}>) {
  const isUnset = value === undefined || value === null || value === '';
  const isBool = typeof value === TypeofEnum.BOOLEAN;
  const isArr = Array.isArray(value);
  const isEnum = Boolean(property.enum && Array.isArray(property.enum));
  const isMultiline = property.format === DynamicFieldFormatEnum.MULTILINE;
  const displayString = isUnset ? '' : formatDisplayValue(value);

  const views: Partial<Record<string, React.ReactNode>> = {
    ...(isUnset
      ? {
          empty: (
            <span className="text-muted-foreground text-xs italic">
              Not set
            </span>
          ),
        }
      : {}),
    ...(isBool
      ? {
          bool: (
            <Badge variant={value ? 'default' : 'outline'} className="text-xs">
              {value ? 'Yes' : 'No'}
            </Badge>
          ),
        }
      : {}),
    ...(isArr
      ? {
          arr:
            (value as unknown[]).length === 0 ? (
              <span className="text-muted-foreground text-xs italic">None</span>
            ) : (
              <div className="flex flex-wrap gap-1">
                {(value as unknown[]).map((v) => {
                  const itemText = formatDisplayValue(v);
                  return (
                    <Badge
                      key={itemText}
                      variant="secondary"
                      className="text-xs"
                    >
                      {itemText}
                    </Badge>
                  );
                })}
              </div>
            ),
        }
      : {}),
    ...(isEnum
      ? {
          enumView: (
            <Badge variant="secondary" className="text-xs font-normal">
              {displayString}
            </Badge>
          ),
        }
      : {}),
    ...(isMultiline
      ? {
          multiline: (
            <span className="text-foreground line-clamp-3 text-xs whitespace-pre-wrap">
              {displayString}
            </span>
          ),
        }
      : {}),
  };

  return (
    views.empty ??
    views.bool ??
    views.arr ??
    views.enumView ??
    views.multiline ?? (
      <span
        className="text-foreground max-w-[200px] truncate text-xs"
        title={displayString}
      >
        {displayString}
      </span>
    )
  );
}

const INPUT_TYPE_MAP: Record<string, DynamicFieldInputTypeEnum> = {
  [DynamicFieldFormatEnum.DATE]: DynamicFieldInputTypeEnum.DATE,
  [DynamicFieldFormatEnum.URI]: DynamicFieldInputTypeEnum.URL,
};

function resolveInputType(format?: string): string {
  return (
    (format ? INPUT_TYPE_MAP[format] : undefined) ??
    DynamicFieldInputTypeEnum.TEXT
  );
}

function SelectDynamicEditor({
  propKey,
  options,
  value,
  onFieldChange,
  onDone,
}: {
  readonly propKey: string;
  readonly options: readonly string[];
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly onDone?: () => void;
}) {
  const stringVal =
    typeof value === TypeofEnum.STRING ? (value as string) : '__none__';
  return (
    <Select
      defaultValue={stringVal}
      defaultOpen
      onOpenChange={(open) => {
        if (!open) {
          onDone?.();
        }
      }}
      onValueChange={(val) => {
        onFieldChange?.(propKey, val === '__none__' ? null : val);
        onDone?.();
      }}
    >
      <SelectTrigger className="h-8 text-xs">
        <SelectValue placeholder="Select an option..." />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="__none__">
          <span className="text-muted-foreground italic">None / Clear</span>
        </SelectItem>
        {options.map((opt) => (
          <SelectItem key={opt} value={opt}>
            {opt}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function BooleanDynamicEditor({
  propKey,
  value,
  onFieldChange,
  onDone,
}: {
  readonly propKey: string;
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly onDone?: () => void;
}) {
  const isChecked = Boolean(value);
  return (
    <div className="flex items-center gap-2 pt-0.5">
      <Switch
        checked={isChecked}
        onCheckedChange={(checked) => {
          onFieldChange?.(propKey, checked);
          onDone?.();
        }}
      />
      <span className="text-muted-foreground text-xs">
        {isChecked ? 'Yes' : 'No'}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        className="text-muted-foreground ml-auto h-6 text-[11px]"
        onClick={onDone}
      >
        Done
      </Button>
    </div>
  );
}

function NumberDynamicEditor({
  propKey,
  isInteger,
  value,
  onFieldChange,
  onDone,
}: {
  readonly propKey: string;
  readonly isInteger: boolean;
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly onDone?: () => void;
}) {
  const [draft, setDraft] = useState(
    value !== undefined && value !== null ? String(value) : ''
  );

  const handleSave = () => {
    const raw = draft.trim();
    if (raw === '') {
      if (value !== undefined && value !== null) {
        onFieldChange?.(propKey, null);
      }
    } else {
      const num = isInteger ? parseInt(raw, 10) : parseFloat(raw);
      if (!Number.isNaN(num) && num !== value) {
        onFieldChange?.(propKey, num);
      }
    }
    onDone?.();
  };

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type="number"
        step={isInteger ? '1' : 'any'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onDone?.();
          }
        }}
        placeholder="0"
        className="h-8 flex-1 text-xs"
      />
      <Button
        type="button"
        size="icon-xs"
        variant="secondary"
        className="size-7 shrink-0 cursor-pointer"
        aria-label="Save value"
        onClick={handleSave}
      >
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="text-muted-foreground size-7 shrink-0 cursor-pointer"
        aria-label="Cancel"
        onClick={onDone}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function ArrayDynamicEditor({
  propKey,
  options,
  value,
  onFieldChange,
  onDone,
}: {
  readonly propKey: string;
  readonly options: readonly string[];
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly onDone?: () => void;
}) {
  const selected = Array.isArray(value) ? (value as string[]) : [];
  return (
    <div className="space-y-1.5 pt-0.5">
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => {
          const isSelected = selected.includes(opt);
          return (
            <Badge
              key={opt}
              variant={isSelected ? 'default' : 'outline'}
              className="cursor-pointer text-xs transition-colors select-none"
              onClick={() => {
                const next = isSelected
                  ? selected.filter((s) => s !== opt)
                  : [...selected, opt];
                onFieldChange?.(propKey, next.length > 0 ? next : null);
              }}
            >
              {opt}
            </Badge>
          );
        })}
      </div>
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={onDone}
        className="text-muted-foreground h-6 text-[11px]"
      >
        Done
      </Button>
    </div>
  );
}

function TextDynamicEditor({
  propKey,
  format,
  value,
  onFieldChange,
  onDone,
}: {
  readonly propKey: string;
  readonly format?: string;
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly onDone?: () => void;
}) {
  const [draft, setDraft] = useState<string>(
    typeof value === TypeofEnum.STRING ? (value as string) : ''
  );

  const handleSave = () => {
    const val = draft.trim();
    if (val !== (value ?? '')) {
      onFieldChange?.(propKey, val || null);
    }
    onDone?.();
  };

  if (format === DynamicFieldFormatEnum.MULTILINE) {
    return (
      <div className="space-y-1.5">
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          autoFocus
          onKeyDown={(e) => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') {
              e.preventDefault();
              handleSave();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              onDone?.();
            }
          }}
          placeholder="Enter details... (Ctrl+Enter to save)"
          rows={3}
          className="resize-y font-sans text-xs"
        />
        <div className="flex items-center justify-end gap-1.5">
          <Button
            type="button"
            variant="ghost"
            size="xs"
            className="text-muted-foreground h-6 text-[11px]"
            onClick={onDone}
          >
            Cancel
          </Button>
          <Button
            type="button"
            size="xs"
            className="h-6 text-[11px]"
            onClick={handleSave}
          >
            Save
          </Button>
        </div>
      </div>
    );
  }

  const inputType = resolveInputType(format);

  return (
    <div className="flex items-center gap-1.5">
      <Input
        type={inputType}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        autoFocus
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            handleSave();
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onDone?.();
          }
        }}
        placeholder={
          format === DynamicFieldFormatEnum.DATE
            ? 'YYYY-MM-DD'
            : 'Enter value...'
        }
        className="h-8 flex-1 text-xs"
      />
      <Button
        type="button"
        size="icon-xs"
        variant="secondary"
        className="size-7 shrink-0 cursor-pointer"
        aria-label="Save value"
        onClick={handleSave}
      >
        <Check className="size-3.5 text-emerald-600 dark:text-emerald-400" />
      </Button>
      <Button
        type="button"
        size="icon-xs"
        variant="ghost"
        className="text-muted-foreground size-7 shrink-0 cursor-pointer"
        aria-label="Cancel"
        onClick={onDone}
      >
        <X className="size-3.5" />
      </Button>
    </div>
  );
}

function DynamicFieldEditor({
  propKey,
  property,
  value,
  onFieldChange,
  onDone,
}: {
  readonly propKey: string;
  readonly property: DynamicFieldProperty;
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly onDone?: () => void;
}) {
  const hasEnum = Boolean(property.enum && property.enum.length > 0);
  const isBoolean = property.type === DynamicFieldTypeEnum.BOOLEAN;
  const isNumber =
    property.type === DynamicFieldTypeEnum.NUMBER ||
    property.type === DynamicFieldTypeEnum.INTEGER;
  const isArrayWithEnum = Boolean(
    property.type === DynamicFieldTypeEnum.ARRAY &&
    property.items?.enum &&
    property.items.enum.length > 0
  );

  const editors: Partial<Record<string, React.ReactNode>> = {
    ...(hasEnum
      ? {
          enumEditor: (
            <SelectDynamicEditor
              propKey={propKey}
              options={property.enum!}
              value={value}
              onFieldChange={onFieldChange}
              onDone={onDone}
            />
          ),
        }
      : {}),
    ...(isBoolean
      ? {
          boolEditor: (
            <BooleanDynamicEditor
              propKey={propKey}
              value={value}
              onFieldChange={onFieldChange}
              onDone={onDone}
            />
          ),
        }
      : {}),
    ...(isNumber
      ? {
          numEditor: (
            <NumberDynamicEditor
              propKey={propKey}
              isInteger={property.type === DynamicFieldTypeEnum.INTEGER}
              value={value}
              onFieldChange={onFieldChange}
              onDone={onDone}
            />
          ),
        }
      : {}),
    ...(isArrayWithEnum
      ? {
          arrayEditor: (
            <ArrayDynamicEditor
              propKey={propKey}
              options={property.items!.enum!}
              value={value}
              onFieldChange={onFieldChange}
              onDone={onDone}
            />
          ),
        }
      : {}),
  };

  return (
    editors.enumEditor ??
    editors.boolEditor ??
    editors.numEditor ??
    editors.arrayEditor ?? (
      <TextDynamicEditor
        propKey={propKey}
        format={property.format}
        value={value}
        onFieldChange={onFieldChange}
        onDone={onDone}
      />
    )
  );
}

function DynamicFieldRow({
  propKey,
  property,
  value,
  onFieldChange,
  readOnly,
}: {
  readonly propKey: string;
  readonly property: DynamicFieldProperty;
  readonly value: unknown;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly readOnly?: boolean;
}) {
  const [isEditing, setIsEditing] = useState(false);
  const [optimisticValue, setOptimisticValue] = useState<unknown>(value);
  const title = property.title || propKey;

  useEffect(() => {
    setOptimisticValue(value);
  }, [value]);

  const handleFieldChange = (key: string, nextValue: unknown) => {
    setOptimisticValue(nextValue);
    onFieldChange?.(key, nextValue);
  };

  return (
    <div className="grid grid-cols-[7rem_1fr] items-start gap-3 py-2">
      <span
        className="text-muted-foreground truncate pt-1 text-sm font-normal"
        title={title}
      >
        {title}
      </span>
      <div className="min-w-0">
        {isEditing && !readOnly ? (
          <div className="space-y-1.5">
            <DynamicFieldEditor
              propKey={propKey}
              property={property}
              value={optimisticValue}
              onFieldChange={handleFieldChange}
              onDone={() => setIsEditing(false)}
            />
          </div>
        ) : (
          <div className="group flex items-center justify-between gap-2">
            <div
              role={!readOnly && onFieldChange ? 'button' : undefined}
              tabIndex={!readOnly && onFieldChange ? 0 : undefined}
              className={
                !readOnly && onFieldChange
                  ? 'cursor-pointer transition-opacity hover:opacity-80'
                  : undefined
              }
              onClick={() => {
                if (!readOnly && onFieldChange) {
                  setIsEditing(true);
                }
              }}
              onKeyDown={(e) => {
                if (
                  !readOnly &&
                  onFieldChange &&
                  (e.key === 'Enter' || e.key === ' ')
                ) {
                  setIsEditing(true);
                }
              }}
            >
              <DynamicFieldValueDisplay
                property={property}
                value={optimisticValue}
              />
            </div>
            {!readOnly && onFieldChange && (
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer opacity-0 transition-opacity group-hover:opacity-100"
                aria-label={`Edit ${title}`}
                onClick={() => setIsEditing(true)}
              >
                <PencilIcon className="size-3.5" />
              </Button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

interface DynamicFieldsRendererProps {
  readonly config: ProjectFieldsConfig;
  readonly values: Record<string, unknown>;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly readOnly?: boolean;
}

export function DynamicFieldsRenderer({
  config,
  values,
  onFieldChange,
  readOnly,
}: Readonly<DynamicFieldsRendererProps>) {
  const entries = Object.entries(config.properties || {});
  if (entries.length === 0) return null;

  return (
    <div className="space-y-3 pt-1">
      {entries.map(([key, property]) => (
        <DynamicFieldRow
          key={key}
          propKey={key}
          property={property}
          value={values[key]}
          onFieldChange={onFieldChange}
          readOnly={readOnly}
        />
      ))}
    </div>
  );
}

export interface SafeDynamicFieldsSectionProps {
  readonly schema: unknown;
  readonly values: Record<string, unknown>;
  // eslint-disable-next-line no-unused-vars
  readonly onFieldChange?: (key: string, value: unknown) => void;
  readonly readOnly?: boolean;
}

export function SafeDynamicFieldsSection({
  schema,
  values,
  onFieldChange,
  readOnly,
}: Readonly<SafeDynamicFieldsSectionProps>) {
  try {
    if (!schema || typeof schema !== TypeofEnum.OBJECT) {
      return null;
    }

    const validatedSchema = ProjectFieldsConfigSchema.safeParse(schema);
    if (
      !validatedSchema.success ||
      !validatedSchema.data.properties ||
      Object.keys(validatedSchema.data.properties).length === 0
    ) {
      return null;
    }

    return (
      <DynamicFieldsErrorBoundary fallback={<DynamicFieldsErrorNotice />}>
        <DynamicFieldsRenderer
          config={validatedSchema.data}
          values={values}
          onFieldChange={onFieldChange}
          readOnly={readOnly}
        />
      </DynamicFieldsErrorBoundary>
    );
  } catch (error) {
    console.error('Failed to parse or render dynamic fields:', error);
    return null;
  }
}
