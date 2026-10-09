'use client';

import { useState } from 'react';
import {
  cloneResolutionPreset,
  createEmptyResolutionPreset,
  findResolutionPreset,
  workflowResolutionPresetSchema,
  type WorkflowDocument,
  type WorkflowResolutionPreset,
} from '@repo/types/api/v1';
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
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from '@repo/ui/components/ui/tabs';
import { Plus, Trash2 } from '@repo/ui/lib/icons';

const NONE_VALUE = '__none__';
const CREATE_VALUE = '__create__';

type FieldType = WorkflowResolutionPreset['fields'][number]['type'];
type PresetField = WorkflowResolutionPreset['fields'][number];
type PresetOutcome = WorkflowResolutionPreset['outcomes'][number];

type WorkflowResolutionPresetEditorProps = {
  readonly workflow: WorkflowDocument;
  readonly edgeId: string;
  readonly presetId: string | null;
  readonly canEdit: boolean;
  readonly required: boolean;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onBindPreset: (presetId: string | null) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onUpsertPreset: (preset: WorkflowResolutionPreset) => void;
};

// eslint-disable-next-line no-unused-vars
type PersistDraft = (next: WorkflowResolutionPreset) => void;

function newId(prefix: string): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return `${prefix}-${crypto.randomUUID()}`;
  }
  return `${prefix}-${Date.now()}`;
}

function updateFieldAt(
  fields: PresetField[],
  index: number,
  patch: Partial<PresetField>
): PresetField[] {
  return fields.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function PresetFieldRow({
  field,
  index,
  canEdit,
  editing,
  persistDraft,
}: {
  readonly field: PresetField;
  readonly index: number;
  readonly canEdit: boolean;
  readonly editing: WorkflowResolutionPreset;
  readonly persistDraft: PersistDraft;
}) {
  return (
    <div className="border-border space-y-2 rounded-md border p-2">
      <div className="flex gap-2">
        <Input
          value={field.label}
          disabled={!canEdit}
          aria-label="Field label"
          onChange={(event) =>
            persistDraft({
              ...editing,
              fields: updateFieldAt(editing.fields, index, {
                label: event.target.value,
              }),
            })
          }
        />
        <Select
          value={field.type}
          disabled={!canEdit}
          onValueChange={(value) => {
            if (!value) return;
            persistDraft({
              ...editing,
              fields: updateFieldAt(editing.fields, index, {
                type: value as FieldType,
                options:
                  value === 'select'
                    ? (field.options ?? ['Option 1'])
                    : undefined,
              }),
            });
          }}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="text">Text</SelectItem>
            <SelectItem value="textarea">Textarea</SelectItem>
            <SelectItem value="select">Select</SelectItem>
            <SelectItem value="checkbox">Checkbox</SelectItem>
          </SelectContent>
        </Select>
        {canEdit ? (
          <Button
            type="button"
            size="icon"
            variant="outline"
            aria-label="Remove field"
            onClick={() =>
              persistDraft({
                ...editing,
                fields: editing.fields.filter((_, i) => i !== index),
              })
            }
          >
            <Trash2 className="size-3.5" />
          </Button>
        ) : null}
      </div>
      <label className="flex items-center gap-2 text-xs">
        <Checkbox
          checked={field.required === true}
          disabled={!canEdit}
          onCheckedChange={(checked) =>
            persistDraft({
              ...editing,
              fields: updateFieldAt(editing.fields, index, {
                required: checked === true,
              }),
            })
          }
        />
        Required
      </label>
      {field.type === 'select' ? (
        <Input
          value={(field.options ?? []).join(', ')}
          disabled={!canEdit}
          placeholder="Options, comma-separated"
          aria-label="Select options"
          onChange={(event) => {
            const options = event.target.value
              .split(',')
              .map((part) => part.trim())
              .filter(Boolean);
            persistDraft({
              ...editing,
              fields: updateFieldAt(editing.fields, index, { options }),
            });
          }}
        />
      ) : null}
    </div>
  );
}

function PresetOutcomeRow({
  outcome,
  index,
  canEdit,
  editing,
  persistDraft,
}: {
  readonly outcome: PresetOutcome;
  readonly index: number;
  readonly canEdit: boolean;
  readonly editing: WorkflowResolutionPreset;
  readonly persistDraft: PersistDraft;
}) {
  return (
    <div className="flex gap-2">
      <Input
        value={outcome.label}
        disabled={!canEdit}
        aria-label="Outcome label"
        onChange={(event) => {
          const outcomes = editing.outcomes.map((item, i) =>
            i === index ? { ...item, label: event.target.value } : item
          );
          persistDraft({ ...editing, outcomes });
        }}
      />
      {canEdit ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Remove outcome"
          onClick={() =>
            persistDraft({
              ...editing,
              outcomes: editing.outcomes.filter((_, i) => i !== index),
            })
          }
        >
          <Trash2 className="size-3.5" />
        </Button>
      ) : null}
    </div>
  );
}

function PresetFormTab({
  edgeId,
  editing,
  canEdit,
  persistDraft,
}: {
  readonly edgeId: string;
  readonly editing: WorkflowResolutionPreset;
  readonly canEdit: boolean;
  readonly persistDraft: PersistDraft;
}) {
  return (
    <TabsContent value="form" className="space-y-3 pt-2">
      <div className="space-y-1.5">
        <Label htmlFor={`preset-title-${edgeId}`}>Title</Label>
        <Input
          id={`preset-title-${edgeId}`}
          value={editing.title}
          disabled={!canEdit}
          onChange={(event) =>
            persistDraft({ ...editing, title: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Fields</p>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                persistDraft({
                  ...editing,
                  fields: [
                    ...editing.fields,
                    {
                      id: newId('field'),
                      type: 'text',
                      label: 'New field',
                      required: false,
                    },
                  ],
                })
              }
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Field
            </Button>
          ) : null}
        </div>
        {editing.fields.length === 0 ? (
          <p className="text-muted-foreground text-xs">No fields yet.</p>
        ) : null}
        {editing.fields.map((field, index) => (
          <PresetFieldRow
            key={field.id}
            field={field}
            index={index}
            canEdit={canEdit}
            editing={editing}
            persistDraft={persistDraft}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Outcomes</p>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                persistDraft({
                  ...editing,
                  outcomes: [
                    ...editing.outcomes,
                    { id: newId('outcome'), label: 'New outcome' },
                  ],
                })
              }
            >
              <Plus className="size-3.5" data-icon="inline-start" />
              Outcome
            </Button>
          ) : null}
        </div>
        {editing.outcomes.map((outcome, index) => (
          <PresetOutcomeRow
            key={outcome.id}
            outcome={outcome}
            index={index}
            canEdit={canEdit}
            editing={editing}
            persistDraft={persistDraft}
          />
        ))}
      </div>
    </TabsContent>
  );
}

function PreviewFieldControl({ field }: { readonly field: PresetField }) {
  if (field.type === 'textarea') {
    return <Textarea disabled placeholder="Preview" />;
  }
  if (field.type === 'text') {
    return <Input disabled placeholder="Preview" />;
  }
  if (field.type === 'select') {
    return (
      <Select disabled>
        <SelectTrigger>
          <SelectValue placeholder={(field.options ?? [])[0] ?? 'Select'} />
        </SelectTrigger>
      </Select>
    );
  }
  return (
    <div className="flex items-center gap-2 text-sm">
      <Checkbox disabled />
      <span>{field.label}</span>
    </div>
  );
}

function PresetPreviewTab({
  editing,
}: {
  readonly editing: WorkflowResolutionPreset;
}) {
  return (
    <TabsContent value="preview" className="space-y-3 pt-2">
      <p className="text-foreground text-sm font-medium">{editing.title}</p>
      {editing.fields.map((field) => (
        <div key={field.id} className="space-y-1.5">
          <Label>
            {field.label}
            {field.required ? ' *' : ''}
          </Label>
          <PreviewFieldControl field={field} />
        </div>
      ))}
      {editing.outcomes.length > 0 ? (
        <div className="space-y-1.5">
          <Label>Outcome</Label>
          <Select disabled>
            <SelectTrigger>
              <SelectValue
                placeholder={editing.outcomes[0]?.label ?? 'Outcome'}
              />
            </SelectTrigger>
          </Select>
        </div>
      ) : null}
    </TabsContent>
  );
}

function PresetJsonTab({
  canEdit,
  jsonText,
  jsonError,
  editing,
  onJsonTextChange,
  onApply,
}: {
  readonly canEdit: boolean;
  readonly jsonText: string;
  readonly jsonError: string | null;
  readonly editing: WorkflowResolutionPreset;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onJsonTextChange: (value: string) => void;
  readonly onApply: () => void;
}) {
  return (
    <TabsContent value="json" className="space-y-2 pt-2">
      <Textarea
        value={jsonText || JSON.stringify(editing, null, 2)}
        disabled={!canEdit}
        rows={12}
        className="font-mono text-xs"
        onChange={(event) => onJsonTextChange(event.target.value)}
      />
      {jsonError ? (
        <p className="text-destructive text-xs">{jsonError}</p>
      ) : null}
      {canEdit ? (
        <Button type="button" size="sm" onClick={onApply}>
          Apply JSON
        </Button>
      ) : null}
    </TabsContent>
  );
}

export function WorkflowResolutionPresetEditor({
  workflow,
  edgeId,
  presetId,
  canEdit,
  required,
  onBindPreset,
  onUpsertPreset,
}: WorkflowResolutionPresetEditorProps) {
  const bound = presetId ? findResolutionPreset(workflow, presetId) : null;
  const [draft, setDraft] = useState<WorkflowResolutionPreset | null>(null);
  const [jsonText, setJsonText] = useState('');
  const [jsonError, setJsonError] = useState<string | null>(null);

  const editing = draft ?? bound;

  const beginEdit = (preset: WorkflowResolutionPreset) => {
    setDraft(structuredClone(preset));
    setJsonText(JSON.stringify(preset, null, 2));
    setJsonError(null);
  };

  const clearBinding = () => {
    setDraft(null);
    onBindPreset(null);
  };

  const createAndBind = () => {
    const created = createEmptyResolutionPreset(newId('preset'), 'New preset');
    beginEdit(created);
    onUpsertPreset(created);
    onBindPreset(created.id);
  };

  const selectExisting = (value: string) => {
    const preset = findResolutionPreset(workflow, value);
    if (!preset) {
      return;
    }
    beginEdit(preset);
    onBindPreset(preset.id);
  };

  const handlePickerChange = (value: string | null) => {
    if (!value || value === NONE_VALUE) {
      clearBinding();
      return;
    }
    if (value === CREATE_VALUE) {
      createAndBind();
      return;
    }
    selectExisting(value);
  };

  const persistDraft = (next: WorkflowResolutionPreset) => {
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    onUpsertPreset(next);
    onBindPreset(next.id);
  };

  const applyJson = () => {
    try {
      const parsed = workflowResolutionPresetSchema.parse(JSON.parse(jsonText));
      setJsonError(null);
      persistDraft(parsed);
    } catch (error) {
      setJsonError(
        error instanceof Error ? error.message : 'Invalid preset JSON'
      );
    }
  };

  const saveAsClone = () => {
    if (!editing) {
      return;
    }
    const cloned = cloneResolutionPreset(editing, newId('preset'));
    beginEdit(cloned);
    onUpsertPreset(cloned);
    onBindPreset(cloned.id);
  };

  return (
    <div
      className="space-y-3"
      data-testid={`workflow-resolution-preset-${edgeId}`}
    >
      <Select
        value={presetId ?? NONE_VALUE}
        disabled={!canEdit}
        onValueChange={handlePickerChange}
      >
        <SelectTrigger id="workflow-edge-resolution-preset">
          <SelectValue placeholder="None" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE_VALUE}>None</SelectItem>
          {workflow.resolutionPresets.map((preset) => (
            <SelectItem key={preset.id} value={preset.id}>
              {preset.title}
            </SelectItem>
          ))}
          {canEdit ? (
            <SelectItem value={CREATE_VALUE}>Create new…</SelectItem>
          ) : null}
        </SelectContent>
      </Select>

      {required && !presetId ? (
        <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          This move needs a resolution form before you can save.
        </p>
      ) : null}

      {editing ? (
        <Tabs defaultValue="form" className="w-full">
          <div className="flex items-center justify-between gap-2">
            <TabsList>
              <TabsTrigger value="form">Form</TabsTrigger>
              <TabsTrigger value="preview">Preview</TabsTrigger>
              <TabsTrigger value="json">JSON</TabsTrigger>
            </TabsList>
            {canEdit ? (
              <Button
                type="button"
                size="sm"
                variant="outline"
                onClick={saveAsClone}
              >
                Save as…
              </Button>
            ) : null}
          </div>

          <PresetFormTab
            edgeId={edgeId}
            editing={editing}
            canEdit={canEdit}
            persistDraft={persistDraft}
          />
          <PresetPreviewTab editing={editing} />
          <PresetJsonTab
            canEdit={canEdit}
            jsonText={jsonText}
            jsonError={jsonError}
            editing={editing}
            onJsonTextChange={setJsonText}
            onApply={applyJson}
          />
        </Tabs>
      ) : null}
    </div>
  );
}
