'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { createPrefixedId } from '@repo/types';
import {
  cloneResolutionPreset,
  createEmptyResolutionPreset,
  ensureUniqueResolutionEntityIds,
  findResolutionPreset,
  workflowResolutionPresetSchema,
  type WorkflowDocument,
  type WorkflowResolutionPreset,
} from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
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
import { Loader2, Plus, Trash2 } from '@repo/ui/lib/icons';
import { afterDialogClose } from '@/lib/dialog-close';
import { WorkflowSettingsInfoTip } from '@/app/projects/_components/project-details/workflow-settings-info-tip';
import {
  offsetToLineColumn,
  toJsonEditorError,
  type JsonCursor,
  type JsonEditorError,
} from '@/app/projects/_helpers/workflow-resolution-json-error';

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
type UpdateDraft = (next: WorkflowResolutionPreset) => void;

function newId(prefix: string): string {
  return createPrefixedId(prefix);
}

function updateFieldAt(
  fields: PresetField[],
  index: number,
  patch: Partial<PresetField>
): PresetField[] {
  return fields.map((item, i) => (i === index ? { ...item, ...patch } : item));
}

function SelectFieldOptions({
  field,
  index,
  canEdit,
  editing,
  updateDraft,
}: {
  readonly field: PresetField;
  readonly index: number;
  readonly canEdit: boolean;
  readonly editing: WorkflowResolutionPreset;
  readonly updateDraft: UpdateDraft;
}) {
  const options = field.options ?? [];

  const setOptions = (next: string[]) => {
    updateDraft({
      ...editing,
      fields: updateFieldAt(editing.fields, index, { options: next }),
    });
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-muted-foreground text-xs font-medium">Options</p>
        {canEdit ? (
          <Button
            type="button"
            size="sm"
            variant="outline"
            onClick={() =>
              setOptions([...options, `Option ${options.length + 1}`])
            }
          >
            <Plus className="size-3.5" data-icon="inline-start" />
            Option
          </Button>
        ) : null}
      </div>
      {options.length === 0 ? (
        <p className="text-muted-foreground text-xs">
          Add at least one option for this dropdown.
        </p>
      ) : null}
      {options.map((option, optionIndex) => (
        <div key={`option-${field.id}-${optionIndex}`} className="flex gap-2">
          <Input
            value={option}
            disabled={!canEdit}
            aria-label={`Option ${optionIndex + 1}`}
            onChange={(event) => {
              const next = options.map((item, i) =>
                i === optionIndex ? event.target.value : item
              );
              setOptions(next);
            }}
          />
          {canEdit ? (
            <Button
              type="button"
              size="icon"
              variant="outline"
              aria-label={`Remove option ${optionIndex + 1}`}
              onClick={() =>
                setOptions(options.filter((_, i) => i !== optionIndex))
              }
            >
              <Trash2 className="size-3.5" />
            </Button>
          ) : null}
        </div>
      ))}
    </div>
  );
}

function PresetFieldRow({
  field,
  index,
  canEdit,
  editing,
  updateDraft,
}: {
  readonly field: PresetField;
  readonly index: number;
  readonly canEdit: boolean;
  readonly editing: WorkflowResolutionPreset;
  readonly updateDraft: UpdateDraft;
}) {
  return (
    <div className="border-border space-y-2 rounded-md border p-2">
      <div className="flex gap-2">
        <Input
          value={field.label}
          disabled={!canEdit}
          aria-label="Field label"
          onChange={(event) =>
            updateDraft({
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
            updateDraft({
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
              updateDraft({
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
            updateDraft({
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
        <SelectFieldOptions
          field={field}
          index={index}
          canEdit={canEdit}
          editing={editing}
          updateDraft={updateDraft}
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
  updateDraft,
}: {
  readonly outcome: PresetOutcome;
  readonly index: number;
  readonly canEdit: boolean;
  readonly editing: WorkflowResolutionPreset;
  readonly updateDraft: UpdateDraft;
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
          updateDraft({ ...editing, outcomes });
        }}
      />
      {canEdit ? (
        <Button
          type="button"
          size="icon"
          variant="outline"
          aria-label="Remove outcome"
          onClick={() =>
            updateDraft({
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
  updateDraft,
}: {
  readonly edgeId: string;
  readonly editing: WorkflowResolutionPreset;
  readonly canEdit: boolean;
  readonly updateDraft: UpdateDraft;
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
            updateDraft({ ...editing, title: event.target.value })
          }
        />
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">Fields</p>
            <WorkflowSettingsInfoTip text="Questions people answer when taking this move — for example a reason or notes." />
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                updateDraft({
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
            updateDraft={updateDraft}
          />
        ))}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1.5">
            <p className="text-sm font-medium">Outcomes</p>
            <WorkflowSettingsInfoTip text="Choices they pick to finish the form (for example Fixed or Won't fix). Stored with the answers — does not change where the item goes yet." />
          </div>
          {canEdit ? (
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() =>
                updateDraft({
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
            updateDraft={updateDraft}
          />
        ))}
      </div>
    </TabsContent>
  );
}

function PreviewFieldControl({ field }: { readonly field: PresetField }) {
  if (field.type === 'textarea') {
    return (
      <Textarea disabled placeholder="Preview" className="min-h-24 text-base" />
    );
  }
  if (field.type === 'text') {
    return <Input disabled placeholder="Preview" className="h-10 text-base" />;
  }
  if (field.type === 'select') {
    return (
      <Select disabled>
        <SelectTrigger className="h-10 text-base">
          <SelectValue placeholder={(field.options ?? [])[0] ?? 'Select'} />
        </SelectTrigger>
      </Select>
    );
  }
  return (
    <div className="flex items-center gap-2 text-base">
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
    <TabsContent value="preview" className="pt-2">
      <div className="border-border bg-muted/30 space-y-4 rounded-lg border p-5 text-base shadow-sm">
        <p className="text-foreground text-lg font-semibold tracking-tight">
          {editing.title.trim() || 'Untitled form'}
        </p>
        {editing.fields.map((field) => (
          <div key={field.id} className="space-y-2">
            <Label className="text-base">
              {field.label}
              {field.required ? ' *' : ''}
            </Label>
            <PreviewFieldControl field={field} />
          </div>
        ))}
        {editing.outcomes.length > 0 ? (
          <div className="space-y-2">
            <Label className="text-base">Outcome</Label>
            <Select disabled>
              <SelectTrigger className="h-10 text-base">
                <SelectValue
                  placeholder={editing.outcomes[0]?.label ?? 'Outcome'}
                />
              </SelectTrigger>
            </Select>
          </div>
        ) : null}
        {editing.fields.length === 0 && editing.outcomes.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            Add fields or outcomes on the Form tab to preview them here.
          </p>
        ) : null}
      </div>
    </TabsContent>
  );
}

function PresetJsonTab({
  canEdit,
  jsonText,
  jsonError,
  isCommitting,
  editing,
  onJsonTextChange,
  onCommit,
}: {
  readonly canEdit: boolean;
  readonly jsonText: string;
  readonly jsonError: JsonEditorError | null;
  readonly isCommitting: boolean;
  readonly editing: WorkflowResolutionPreset;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onJsonTextChange: (value: string) => void;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onCommit: (value: string) => void;
}) {
  const value = jsonText || JSON.stringify(editing, null, 2);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);
  const [cursor, setCursor] = useState<JsonCursor>({ line: 1, column: 1 });

  const lineCount = useMemo(
    () => Math.max(1, value.split('\n').length),
    [value]
  );

  const syncCursor = () => {
    const textarea = textareaRef.current;
    if (!textarea) {
      return;
    }
    setCursor(offsetToLineColumn(value, textarea.selectionStart));
  };

  const handleEditorScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  return (
    <TabsContent value="json" className="space-y-2 pt-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-muted-foreground font-mono text-xs">
          {lineCount} {lineCount === 1 ? 'line' : 'lines'}
        </span>
        <span
          className="text-muted-foreground font-mono text-xs tabular-nums"
          aria-live="polite"
        >
          Ln {cursor.line}, Col {cursor.column}
        </span>
      </div>

      <div className="border-border bg-muted/20 focus-within:border-ring focus-within:ring-ring relative flex max-h-[min(50vh,28rem)] overflow-hidden rounded-lg border font-mono text-xs focus-within:ring-1">
        <div
          ref={lineNumbersRef}
          aria-hidden="true"
          className="border-border/60 bg-muted/35 text-muted-foreground/45 shrink-0 overflow-hidden border-r py-3 pr-2 pl-2 text-right leading-5 select-none"
          style={{ minWidth: '2.75rem' }}
        >
          {Array.from({ length: lineCount }, (_, index) => {
            const lineNum = index + 1;
            const isError = jsonError?.line === lineNum;
            return (
              <div
                key={lineNum}
                className={`h-5 leading-5 ${
                  isError
                    ? 'bg-destructive/20 text-destructive rounded-sm px-0.5 font-bold'
                    : ''
                }`}
                title={isError ? `Error near line ${lineNum}` : undefined}
              >
                {lineNum}
              </div>
            );
          })}
        </div>

        <textarea
          ref={textareaRef}
          id="workflow-resolution-preset-json"
          rows={14}
          value={value}
          disabled={!canEdit || isCommitting}
          wrap="off"
          spellCheck={false}
          className="placeholder:text-muted-foreground w-full resize-none overflow-auto bg-transparent px-3 py-3 font-mono text-xs leading-5 whitespace-pre outline-none disabled:cursor-not-allowed disabled:opacity-75"
          onChange={(event) => {
            onJsonTextChange(event.target.value);
            setCursor(
              offsetToLineColumn(
                event.target.value,
                event.target.selectionStart
              )
            );
          }}
          onBlur={(event) => {
            if (canEdit) {
              onCommit(event.target.value);
            }
          }}
          onScroll={handleEditorScroll}
          onClick={syncCursor}
          onKeyUp={syncCursor}
          onSelect={syncCursor}
        />
      </div>

      <div className="flex min-h-5 items-center justify-between gap-2">
        {jsonError ? (
          <p className="text-destructive font-mono text-xs">
            {jsonError.message}
          </p>
        ) : (
          <span />
        )}
        {isCommitting ? (
          <Loader2
            className="text-muted-foreground size-3.5 shrink-0 animate-spin"
            aria-label="Saving JSON"
          />
        ) : null}
      </div>
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
  const [jsonError, setJsonError] = useState<JsonEditorError | null>(null);
  const [isJsonCommitting, setIsJsonCommitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [editorOpen, setEditorOpen] = useState(false);

  const editing = draft;

  const resetEditorContent = () => {
    setDraft(null);
    setJsonText('');
    setJsonError(null);
    setIsJsonCommitting(false);
    setSubmitError(null);
  };

  // Keep form body through the exit animation; reset only after it finishes.
  useEffect(() => {
    if (editorOpen) {
      return;
    }
    return afterDialogClose(() => {
      setDraft(null);
      setJsonText('');
      setJsonError(null);
      setIsJsonCommitting(false);
      setSubmitError(null);
    });
  }, [editorOpen]);

  const beginEdit = (preset: WorkflowResolutionPreset) => {
    setDraft(structuredClone(preset));
    setJsonText(JSON.stringify(preset, null, 2));
    setJsonError(null);
    setIsJsonCommitting(false);
    setSubmitError(null);
  };

  const closeEditor = () => {
    setEditorOpen(false);
  };

  const openEditor = (preset: WorkflowResolutionPreset) => {
    beginEdit(preset);
    setEditorOpen(true);
  };

  const handleEditorOpenChange = (open: boolean) => {
    if (!open) {
      closeEditor();
      return;
    }
    setEditorOpen(true);
  };

  const clearBinding = () => {
    onBindPreset(null);
    if (editorOpen) {
      closeEditor();
    } else {
      resetEditorContent();
    }
  };

  const createAndOpen = () => {
    const created = createEmptyResolutionPreset(newId('preset'), 'New preset');
    openEditor(created);
  };

  const selectExisting = (value: string) => {
    const preset = findResolutionPreset(workflow, value);
    if (!preset) {
      return;
    }
    if (editorOpen) {
      closeEditor();
    } else {
      resetEditorContent();
    }
    onBindPreset(preset.id);
  };

  const handlePickerChange = (value: string | null) => {
    if (!value || value === NONE_VALUE) {
      clearBinding();
      return;
    }
    if (value === CREATE_VALUE) {
      createAndOpen();
      return;
    }
    selectExisting(value);
  };

  const updateDraft = (next: WorkflowResolutionPreset) => {
    setDraft(next);
    setJsonText(JSON.stringify(next, null, 2));
    setSubmitError(null);
  };

  const commitJsonText = (text: string) => {
    setIsJsonCommitting(true);
    // Let the spinner paint before sync parse/format work.
    window.setTimeout(() => {
      try {
        const parsedJson = JSON.parse(text) as unknown;
        const corrected = ensureUniqueResolutionEntityIds(
          workflowResolutionPresetSchema.parse(parsedJson)
        );
        setJsonError(null);
        updateDraft(corrected);
      } catch (error) {
        setJsonError(toJsonEditorError(text, error));
      } finally {
        setIsJsonCommitting(false);
      }
    }, 0);
  };

  const saveAsClone = () => {
    if (!draft) {
      return;
    }
    const title = draft.title.trim();
    const cloned = cloneResolutionPreset(
      { ...draft, title: title || 'New preset' },
      newId('preset'),
      title ? undefined : 'New preset (copy)'
    );
    beginEdit(cloned);
  };

  const submitDraft = () => {
    if (!draft || !canEdit) {
      return;
    }
    try {
      const parsed = workflowResolutionPresetSchema.parse(draft);
      onUpsertPreset(parsed);
      onBindPreset(parsed.id);
      closeEditor();
    } catch (error) {
      setSubmitError(
        error instanceof Error ? error.message : 'Fix the form before saving.'
      );
    }
  };

  return (
    <div
      className="space-y-2"
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

      {presetId && bound ? (
        <Button
          type="button"
          size="sm"
          variant="outline"
          className="w-full"
          onClick={() => openEditor(bound)}
        >
          Edit form
        </Button>
      ) : null}

      {required && !presetId ? (
        <p className="text-xs leading-relaxed text-amber-700 dark:text-amber-400">
          This move needs a resolution form before you can save.
        </p>
      ) : null}

      <Dialog open={editorOpen} onOpenChange={handleEditorOpenChange}>
        <DialogContent className="flex max-h-[min(90vh,48rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="shrink-0 border-b px-6 py-4">
            <DialogTitle>
              {editing?.title?.trim() || 'Resolution form'}
            </DialogTitle>
            <DialogDescription>
              Edit fields and outcomes here. Click Save to apply this form to
              the transition, then Save the workflow on the canvas.
            </DialogDescription>
          </DialogHeader>

          {editing ? (
            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-4">
              <Tabs defaultValue="form" className="w-full">
                <div className="flex flex-wrap items-center justify-between gap-2">
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
                  updateDraft={updateDraft}
                />
                <PresetPreviewTab editing={editing} />
                <PresetJsonTab
                  canEdit={canEdit}
                  jsonText={jsonText}
                  jsonError={jsonError}
                  isCommitting={isJsonCommitting}
                  editing={editing}
                  onJsonTextChange={(value) => {
                    setJsonText(value);
                    setJsonError(null);
                  }}
                  onCommit={commitJsonText}
                />
              </Tabs>
              {submitError ? (
                <p className="text-destructive mt-3 text-xs">{submitError}</p>
              ) : null}
            </div>
          ) : null}

          <DialogFooter className="border-border m-0 shrink-0 gap-2 border-t px-6 py-3 sm:justify-end">
            <Button type="button" variant="outline" onClick={closeEditor}>
              Cancel
            </Button>
            {canEdit ? (
              <Button type="button" onClick={submitDraft}>
                Save
              </Button>
            ) : null}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
