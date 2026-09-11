'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  AlertTriangle,
  CheckCircle2,
  FileCode,
  Info,
  Layers,
  Lock,
  RotateCcw,
  Save,
  Sparkles,
  SlidersHorizontal,
  X,
} from '@repo/ui/lib/icons';
import {
  ProjectFieldsConfigSchema,
  DynamicFieldTypeEnum,
  SchemaValidationStatusEnum,
  TypeofEnum,
} from '@repo/types';
import {
  updateProjectFieldsConfig,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import { ProjectFieldsErrorDialog } from './project-fields-error-dialog';
import { GenerateFieldsAliceDialog } from './generate-fields-alice-dialog';
import { LoadTemplateDialog } from './load-template-dialog';

const DEFAULT_EMPTY_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: DynamicFieldTypeEnum.OBJECT,
  title: 'Project Dynamic Work-Item Fields',
  description: 'Custom metadata fields configured for project work items',
  properties: {},
  additionalProperties: true,
};

interface ProjectFieldsWorkspaceProps {
  readonly project: Project;
  readonly isManagerOrAdmin: boolean;
}

type ParsedProperty = {
  key: string;
  type: string;
  title: string;
  description?: string;
  enum?: string[];
  format?: string;
  default?: unknown;
};

function parseCurrentSchemaObject(raw: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === TypeofEnum.OBJECT &&
      !Array.isArray(parsed)
    ) {
      return parsed as Record<string, unknown>;
    }
  } catch {
    // Keep empty base schema
  }
  return {};
}

function formatTemplateUpdateMessage(
  addedCount: number,
  removedCount: number
): string {
  const messages: Partial<Record<'both' | 'added' | 'removed', string>> = {
    ...(addedCount > 0 && removedCount > 0
      ? {
          both: `Updated templates: added ${addedCount} and removed ${removedCount} ${
            removedCount === 1 ? 'field' : 'fields'
          }. Review and save when ready.`,
        }
      : {}),
    ...(addedCount > 0 && removedCount <= 0
      ? {
          added: `Added ${addedCount} template ${
            addedCount === 1 ? 'field' : 'fields'
          }. Review and save when ready.`,
        }
      : {}),
    ...(removedCount > 0 && addedCount <= 0
      ? {
          removed: `Removed ${removedCount} template ${
            removedCount === 1 ? 'field' : 'fields'
          }. Review and save when ready.`,
        }
      : {}),
  };

  return (
    messages.both ??
    messages.added ??
    messages.removed ??
    'Templates updated. Review and save when ready.'
  );
}

export function ProjectFieldsWorkspace({
  project,
  isManagerOrAdmin,
}: Readonly<ProjectFieldsWorkspaceProps>) {
  const router = useRouter();
  const initialConfigText = useMemo(() => {
    if (
      project.attributes_config &&
      typeof project.attributes_config === TypeofEnum.OBJECT &&
      Object.keys(project.attributes_config).length > 0
    ) {
      return JSON.stringify(project.attributes_config, null, 2);
    }
    return JSON.stringify(DEFAULT_EMPTY_SCHEMA, null, 2);
  }, [project.attributes_config]);

  const [schemaText, setSchemaText] = useState<string>(initialConfigText);
  const [currentUpdatedAt, setCurrentUpdatedAt] = useState<string>(
    () => project.updated_at || new Date().toISOString()
  );

  useEffect(() => {
    if (project.updated_at) {
      setCurrentUpdatedAt(project.updated_at);
    }
  }, [project.updated_at]);

  const [isSaving, setIsSaving] = useState(false);
  const [isAliceDialogOpen, setIsAliceDialogOpen] = useState(false);
  const [isLoadTemplateDialogOpen, setIsLoadTemplateDialogOpen] =
    useState(false);
  const [validationResult, setValidationResult] = useState<{
    status: SchemaValidationStatusEnum;
    message?: string;
  }>({ status: SchemaValidationStatusEnum.UNVALIDATED });

  // Auto-dismiss green success messages after a few seconds
  useEffect(() => {
    if (validationResult.status === SchemaValidationStatusEnum.VALID) {
      const timer = setTimeout(() => {
        setValidationResult({ status: SchemaValidationStatusEnum.UNVALIDATED });
      }, 4500);
      return () => clearTimeout(timer);
    }
  }, [validationResult]);

  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const lineNumbersRef = useRef<HTMLDivElement>(null);

  const lineCount = useMemo(() => {
    return schemaText ? schemaText.split('\n').length : 1;
  }, [schemaText]);

  const [errorDialogState, setErrorDialogState] = useState<{
    open: boolean;
    error: string | null;
    title?: string;
    description?: string;
  }>({
    open: false,
    error: null,
  });

  const showErrorDialog = (
    error: string,
    title?: string,
    description?: string
  ) => {
    setErrorDialogState({
      open: true,
      error,
      title,
      description,
    });
  };

  const handleEditorScroll = () => {
    if (lineNumbersRef.current && textareaRef.current) {
      lineNumbersRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const textarea = e.currentTarget;
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const value = textarea.value;
      const newValue = value.substring(0, start) + '  ' + value.substring(end);
      setSchemaText(newValue);
      if (validationResult.status !== SchemaValidationStatusEnum.UNVALIDATED) {
        setValidationResult({ status: SchemaValidationStatusEnum.UNVALIDATED });
      }
      requestAnimationFrame(() => {
        textarea.selectionStart = textarea.selectionEnd = start + 2;
      });
    }
  };

  // Parse properties from current schema text for the visual cards
  const { parsedProperties, parseError } = useMemo(() => {
    try {
      const parsed = JSON.parse(schemaText);
      if (
        !parsed ||
        typeof parsed !== TypeofEnum.OBJECT ||
        Array.isArray(parsed)
      ) {
        return {
          parsedProperties: [] as ParsedProperty[],
          parseError: 'Root schema must be a JSON object.',
        };
      }

      if (parsed.type && parsed.type !== DynamicFieldTypeEnum.OBJECT) {
        return {
          parsedProperties: [] as ParsedProperty[],
          parseError: 'Root schema "type" must be "object".',
        };
      }

      const properties = parsed.properties;
      if (
        !properties ||
        typeof properties !== TypeofEnum.OBJECT ||
        Array.isArray(properties)
      ) {
        return { parsedProperties: [] as ParsedProperty[], parseError: null };
      }

      const list: ParsedProperty[] = Object.entries(properties).map(
        ([key, prop]) => {
          const propertyRecord =
            prop && typeof prop === TypeofEnum.OBJECT
              ? (prop as Record<string, unknown>)
              : {};
          return {
            key,
            type:
              typeof propertyRecord.type === TypeofEnum.STRING
                ? propertyRecord.type
                : 'unknown',
            title:
              typeof propertyRecord.title === TypeofEnum.STRING
                ? propertyRecord.title
                : key,
            description:
              typeof propertyRecord.description === TypeofEnum.STRING
                ? propertyRecord.description
                : undefined,
            enum: Array.isArray(propertyRecord.enum)
              ? propertyRecord.enum.map(String)
              : undefined,
            format:
              typeof propertyRecord.format === TypeofEnum.STRING
                ? propertyRecord.format
                : undefined,
            default: propertyRecord.default,
          };
        }
      );

      return { parsedProperties: list, parseError: null };
    } catch (err) {
      return {
        parsedProperties: [] as ParsedProperty[],
        parseError: err instanceof Error ? err.message : 'Invalid JSON syntax',
      };
    }
  }, [schemaText]);

  // Extract error line number if parse error mentions "line X" (as seen in user image 1)
  const highlightedErrorLine = useMemo(() => {
    const errorStr =
      parseError ||
      (validationResult.status === SchemaValidationStatusEnum.INVALID
        ? validationResult.message
        : null);
    if (!errorStr) return null;
    const match = errorStr.match(/line\s+(\d+)/i);
    const line = match?.[1];
    return line ? parseInt(line, 10) : null;
  }, [parseError, validationResult]);

  const handleBeautify = () => {
    try {
      const parsed = JSON.parse(schemaText);
      setSchemaText(JSON.stringify(parsed, null, 2));
      setValidationResult({
        status: SchemaValidationStatusEnum.VALID,
        message: 'JSON formatted successfully.',
      });
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : '';
      showErrorDialog(
        `Cannot format invalid JSON${detail}. Please fix syntax errors first.`,
        'JSON Syntax Error'
      );
    }
  };

  const existingPropertiesMap = useMemo(() => {
    try {
      const parsed = JSON.parse(schemaText);
      if (
        parsed &&
        typeof parsed === TypeofEnum.OBJECT &&
        parsed.properties &&
        typeof parsed.properties === TypeofEnum.OBJECT &&
        !Array.isArray(parsed.properties)
      ) {
        return parsed.properties as Record<string, unknown>;
      }
    } catch {
      // ignore
    }
    return {} as Record<string, unknown>;
  }, [schemaText]);

  const handleOpenLoadTemplate = () => {
    setIsLoadTemplateDialogOpen(true);
  };

  const handleApplyTemplates = (
    fieldsToAdd: Record<string, unknown>,
    keysToRemove: string[] = []
  ) => {
    const currentSchema = parseCurrentSchemaObject(schemaText);
    const existingProps =
      currentSchema.properties &&
      typeof currentSchema.properties === TypeofEnum.OBJECT &&
      !Array.isArray(currentSchema.properties)
        ? { ...(currentSchema.properties as Record<string, unknown>) }
        : {};

    // Remove keys that were unselected
    for (const key of keysToRemove) {
      delete existingProps[key];
    }

    // Merge in selected template fields
    const mergedProps = {
      ...existingProps,
      ...fieldsToAdd,
    };

    const updatedSchema = {
      $schema:
        currentSchema.$schema || 'https://json-schema.org/draft/2020-12/schema',
      type: DynamicFieldTypeEnum.OBJECT,
      title: currentSchema.title || 'Project Dynamic Work-Item Fields',
      description:
        currentSchema.description ||
        'Custom metadata fields configured for project work items',
      ...currentSchema,
      properties: mergedProps,
      additionalProperties: currentSchema.additionalProperties ?? true,
    };

    const formatted = JSON.stringify(updatedSchema, null, 2);
    setSchemaText(formatted);

    const newlyAddedKeys = Object.keys(fieldsToAdd).filter(
      (k) => !existingPropertiesMap[k]
    );
    const addedCount = newlyAddedKeys.length;
    const removedCount = keysToRemove.length;

    setValidationResult({
      status: SchemaValidationStatusEnum.VALID,
      message: formatTemplateUpdateMessage(addedCount, removedCount),
    });
  };

  const handleAddTemplates = (newFields: Record<string, unknown>) => {
    handleApplyTemplates(newFields, []);
  };

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(schemaText);
      const validation = ProjectFieldsConfigSchema.safeParse(parsed);
      if (!validation.success) {
        const issues = validation.error.issues
          .map((i) => `• ${i.path.join('.') || 'root'}: ${i.message}`)
          .join('\n');
        setValidationResult({
          status: SchemaValidationStatusEnum.INVALID,
          message: 'Schema failed validation rules.',
        });
        showErrorDialog(
          `The schema failed validation with the following issues:\n\n${issues}`,
          'Schema Validation Error',
          'The dynamic fields configuration must adhere to the Project Fields JSON Schema standard.'
        );
        return;
      }

      setValidationResult({
        status: SchemaValidationStatusEnum.VALID,
        message: `Schema is syntactically valid (${parsedProperties.length} dynamic ${
          parsedProperties.length === 1 ? 'field' : 'fields'
        } defined). Ready to save.`,
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      setValidationResult({
        status: SchemaValidationStatusEnum.INVALID,
        message: `JSON Syntax Error: ${msg}`,
      });
      showErrorDialog(
        `JSON Syntax Error: ${msg}`,
        'JSON Syntax Error',
        'The schema contains invalid JSON syntax. Please correct the syntax before proceeding.'
      );
    }
  };

  const handleSave = async () => {
    if (!isManagerOrAdmin) {
      showErrorDialog(
        'Only project managers and administrators can save field schemas.',
        'Permission Denied',
        'You do not have permission to modify dynamic field configurations.'
      );
      return;
    }

    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(schemaText);
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : '';
      showErrorDialog(
        `Cannot save invalid JSON${detail}. Please correct syntax errors first.`,
        'JSON Syntax Error'
      );
      return;
    }

    const validation = ProjectFieldsConfigSchema.safeParse(parsedConfig);
    if (!validation.success) {
      const issues = validation.error.issues
        .map((i) => `• ${i.path.join('.') || 'root'}: ${i.message}`)
        .join('\n');
      showErrorDialog(
        `Cannot save schema due to validation errors:\n\n${issues}`,
        'Schema Validation Error'
      );
      return;
    }

    setIsSaving(true);
    try {
      const targetUpdatedAt =
        currentUpdatedAt || project.updated_at || new Date().toISOString();
      const updated = await updateProjectFieldsConfig(
        project.id,
        validation.data,
        targetUpdatedAt
      );
      if (updated?.updated_at) {
        setCurrentUpdatedAt(updated.updated_at);
      }
      setValidationResult({
        status: SchemaValidationStatusEnum.VALID,
        message: 'Changes saved to project.',
      });
      router.refresh();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to save dynamic fields schema.';
      showErrorDialog(
        msg,
        'Save Failed',
        'An error occurred while saving the dynamic fields schema to the server.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="text-primary size-5" />
            <h2 className="text-foreground text-xl font-semibold tracking-tight">
              Dynamic Fields
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            Configure custom metadata fields for work items in this project
            using standard JSON Schema. Dynamic fields adapt to agile workflows
            (Scrum, Kanban, SAFe) and appear on work-item details without
            blocking core workflows.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleOpenLoadTemplate}
            disabled={!isManagerOrAdmin || isSaving}
            title="Select and load standard templates"
          >
            <RotateCcw className="mr-1.5 size-3.5" />
            Load Template
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleBeautify}
            disabled={!isManagerOrAdmin || isSaving}
            title="Format JSON with indentation"
          >
            <FileCode className="mr-1.5 size-3.5" />
            Beautify
          </Button>

          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleValidate}
            disabled={isSaving}
            title="Validate JSON Schema syntax"
          >
            <CheckCircle2 className="mr-1.5 size-3.5" />
            Validate
          </Button>

          <Button
            type="button"
            variant="secondary"
            size="sm"
            onClick={() => setIsAliceDialogOpen(true)}
            disabled={!isManagerOrAdmin || isSaving}
            title="Generate Schema with Alice AI"
          >
            <Sparkles className="mr-1.5 size-3.5 text-amber-500" />
            Generate with Alice
          </Button>

          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={!isManagerOrAdmin || isSaving || Boolean(parseError)}
            className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-24"
          >
            <Save className="mr-1.5 size-3.5" />
            {isSaving ? 'Saving…' : 'Save Changes'}
          </Button>
        </div>
      </div>

      {/* Access Warning if not Manager/Admin */}
      {!isManagerOrAdmin && (
        <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-3 rounded-lg border p-3 text-sm">
          <Lock className="size-4 shrink-0 text-amber-500" />
          <span>
            You have view-only access to this project&apos;s dynamic fields
            configuration. Only project managers and administrators can edit and
            save schemas.
          </span>
        </div>
      )}

      {/* Validation Status Banner */}
      {validationResult.status === SchemaValidationStatusEnum.VALID && (
        <div className="flex items-center justify-between gap-2.5 rounded-lg border border-emerald-500/20 bg-emerald-500/10 px-3.5 py-2.5 text-sm text-emerald-700 transition-all duration-300 dark:text-emerald-400">
          <div className="flex items-center gap-2.5">
            <CheckCircle2 className="size-4 shrink-0" />
            <span>{validationResult.message}</span>
          </div>
          <button
            type="button"
            onClick={() =>
              setValidationResult({
                status: SchemaValidationStatusEnum.UNVALIDATED,
              })
            }
            className="rounded p-0.5 text-emerald-700/60 transition-colors hover:text-emerald-700 dark:text-emerald-400/60 dark:hover:text-emerald-400"
            aria-label="Dismiss message"
          >
            <X className="size-3.5" />
          </button>
        </div>
      )}

      {(validationResult.status === SchemaValidationStatusEnum.INVALID ||
        parseError) && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">
            {validationResult.status === SchemaValidationStatusEnum.INVALID
              ? validationResult.message
              : `JSON Parse Error: ${parseError}`}
          </span>
        </div>
      )}

      {/* Visual Fields Summary */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Layers className="text-muted-foreground size-4" />
            <h3 className="text-foreground text-sm font-semibold tracking-tight">
              Configured Fields ({parsedProperties.length})
            </h3>
          </div>
          <span className="text-muted-foreground text-xs">
            Rendered preview of fields defined in the schema below
          </span>
        </div>

        {parsedProperties.length === 0 ? (
          <Card className="border-border/80 bg-card/40 border-dashed">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <SlidersHorizontal className="text-muted-foreground/60 mb-2 size-8 stroke-1" />
              <p className="text-foreground text-sm font-medium">
                No dynamic fields configured yet
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Define field properties in the JSON Schema editor below, or
                click &quot;Load Template&quot; to populate common fields.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {parsedProperties.map((prop) => (
              <Card
                key={prop.key}
                className="border-border/60 bg-card/60 hover:border-border transition-colors"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-foreground truncate text-sm font-semibold">
                      {prop.title}
                    </CardTitle>
                    <Badge
                      variant="secondary"
                      className="shrink-0 font-mono text-[10px]"
                    >
                      {prop.format ? `${prop.type}:${prop.format}` : prop.type}
                    </Badge>
                  </div>
                  <CardDescription className="text-muted-foreground truncate font-mono text-xs">
                    key: {prop.key}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2 p-4 pt-1 text-xs">
                  {prop.description && (
                    <p className="text-muted-foreground line-clamp-2">
                      {prop.description}
                    </p>
                  )}
                  {prop.enum && prop.enum.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground text-[11px] font-medium">
                        Allowed options:
                      </span>
                      <div className="flex flex-wrap gap-1">
                        {prop.enum.map((opt) => (
                          <Badge
                            key={opt}
                            variant="outline"
                            className="bg-muted/40 text-[10px]"
                          >
                            {opt}
                          </Badge>
                        ))}
                      </div>
                    </div>
                  )}
                  {prop.default !== undefined && (
                    <p className="text-muted-foreground text-[11px]">
                      Default:{' '}
                      <code className="font-mono">{String(prop.default)}</code>
                    </p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* JSON Schema Editor */}
      <div className="space-y-2">
        <div className="flex items-center justify-between">
          <label
            htmlFor="json-schema-editor"
            className="text-foreground text-sm font-semibold tracking-tight"
          >
            JSON Schema Specification
          </label>
          <span className="text-muted-foreground font-mono text-xs">
            {lineCount} {lineCount === 1 ? 'line' : 'lines'} • Draft 2020-12 /
            Draft-07 Compatible
          </span>
        </div>

        <div className="border-border bg-muted/20 focus-within:border-ring focus-within:ring-ring relative flex overflow-hidden rounded-lg border font-mono text-xs focus-within:ring-1 md:text-sm">
          {/* Line Numbers Gutter */}
          <div
            ref={lineNumbersRef}
            aria-hidden="true"
            className="border-border/60 bg-muted/35 text-muted-foreground/45 shrink-0 overflow-hidden border-r py-4 pr-2 pl-3 text-right font-mono text-xs leading-6 select-none md:text-sm"
            style={{ minWidth: '3.25rem' }}
          >
            {Array.from({ length: lineCount }, (_, i) => {
              const lineNum = i + 1;
              const isError = highlightedErrorLine === lineNum;
              return (
                <div
                  key={lineNum}
                  className={`h-6 leading-6 transition-colors ${
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

          {/* Textarea Code Editor */}
          <textarea
            ref={textareaRef}
            id="json-schema-editor"
            rows={18}
            value={schemaText}
            onChange={(e) => {
              setSchemaText(e.target.value);
              if (validationResult.status !== 'unvalidated') {
                setValidationResult({ status: 'unvalidated' });
              }
            }}
            onScroll={handleEditorScroll}
            onKeyDown={handleKeyDown}
            disabled={!isManagerOrAdmin || isSaving}
            wrap="off"
            className="placeholder:text-muted-foreground w-full resize-y overflow-x-auto bg-transparent px-4 py-4 font-mono text-xs leading-6 whitespace-pre outline-none disabled:cursor-not-allowed disabled:opacity-75 md:text-sm"
            placeholder="Enter JSON Schema..."
            spellCheck={false}
          />
        </div>

        <p className="text-muted-foreground flex items-center gap-1.5 pt-1 text-xs">
          <Info className="size-3.5 shrink-0" />
          Dynamic field definitions support standard types: string, number,
          boolean, array, and select options (enum).
        </p>
      </div>

      {/* Generate with Alice Modal Dialog */}
      <GenerateFieldsAliceDialog
        open={isAliceDialogOpen}
        onOpenChange={setIsAliceDialogOpen}
        currentSchema={(() => {
          try {
            return JSON.parse(schemaText);
          } catch {
            return undefined;
          }
        })()}
        onGenerated={(newSchema) => {
          let mergedSchema = newSchema;
          try {
            const current = JSON.parse(schemaText);
            if (
              current &&
              typeof current === 'object' &&
              current.properties &&
              typeof current.properties === 'object'
            ) {
              const newObj = newSchema as {
                properties?: Record<string, unknown>;
              };
              mergedSchema = {
                ...current,
                ...newObj,
                properties: {
                  ...current.properties,
                  ...(newObj.properties || {}),
                },
              };
            }
          } catch {
            // Keep newSchema as is if existing schemaText is not valid JSON
          }

          const formatted = JSON.stringify(mergedSchema, null, 2);
          setSchemaText(formatted);
          setValidationResult({
            status: 'valid',
            message:
              'Fields generated with Alice and merged with existing fields. Review and save when ready.',
          });
        }}
        onError={(err) => {
          setIsAliceDialogOpen(false);
          showErrorDialog(
            err,
            'Alice Schema Generation Failed',
            'Alice Assistant could not generate a valid schema for this request.'
          );
        }}
      />

      {/* Load Template Selection Dialog */}
      <LoadTemplateDialog
        open={isLoadTemplateDialogOpen}
        onOpenChange={setIsLoadTemplateDialogOpen}
        projectId={project.id}
        existingProperties={existingPropertiesMap}
        onAddTemplates={handleAddTemplates}
        onApplyTemplates={handleApplyTemplates}
      />

      {/* Sprint-Capacity-Style Error Popup Dialog */}
      <ProjectFieldsErrorDialog
        open={errorDialogState.open}
        title={errorDialogState.title}
        description={errorDialogState.description}
        error={errorDialogState.error}
        onOpenChange={(open) => {
          if (!open) {
            setErrorDialogState((prev) => ({ ...prev, open: false }));
          }
        }}
        onClose={() =>
          setErrorDialogState((prev) => ({ ...prev, open: false }))
        }
      />
    </div>
  );
}
