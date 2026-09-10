'use client';

import { useMemo, useState } from 'react';
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
} from '@repo/ui/lib/icons';
import { toast } from '@repo/ui/components/ui/sonner';
import {
  updateProjectFieldsConfig,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';

const DEFAULT_EMPTY_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  title: 'Project Dynamic Work-Item Fields',
  description: 'Custom metadata fields configured for project work items',
  properties: {},
  additionalProperties: true,
};

const SAMPLE_STARTER_SCHEMA = {
  $schema: 'https://json-schema.org/draft/2020-12/schema',
  type: 'object',
  title: 'Project Dynamic Work-Item Fields',
  description: 'Custom metadata fields configured for project work items',
  properties: {
    moscowRating: {
      type: 'string',
      title: 'MoSCoW Rating',
      description: 'Agile MoSCoW prioritization category',
      enum: ['Must', 'Should', 'Could', "Won't"],
    },
    acceptanceCriteria: {
      type: 'string',
      title: 'Acceptance Criteria',
      description: 'Conditions that must be met for this work item to be accepted',
      format: 'multiline',
    },
    businessValue: {
      type: 'number',
      title: 'Business Value',
      description: 'Relative business value score (1-100)',
      minimum: 1,
      maximum: 100,
    },
    releaseNotesIncluded: {
      type: 'boolean',
      title: 'Include in Release Notes',
      description: 'Whether this item should be highlighted in customer release notes',
      default: false,
    },
  },
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

export function ProjectFieldsWorkspace({
  project,
  isManagerOrAdmin,
}: Readonly<ProjectFieldsWorkspaceProps>) {
  const router = useRouter();
  const initialConfigText = useMemo(() => {
    if (
      project.attributes_config &&
      typeof project.attributes_config === 'object' &&
      Object.keys(project.attributes_config).length > 0
    ) {
      return JSON.stringify(project.attributes_config, null, 2);
    }
    return JSON.stringify(DEFAULT_EMPTY_SCHEMA, null, 2);
  }, [project.attributes_config]);

  const [schemaText, setSchemaText] = useState<string>(initialConfigText);
  const [isSaving, setIsSaving] = useState(false);
  const [validationResult, setValidationResult] = useState<{
    status: 'valid' | 'invalid' | 'unvalidated';
    message?: string;
  }>({ status: 'unvalidated' });

  // Parse properties from current schema text for the visual cards
  const { parsedProperties, parseError } = useMemo(() => {
    try {
      const parsed = JSON.parse(schemaText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        return {
          parsedProperties: [] as ParsedProperty[],
          parseError: 'Root schema must be a JSON object.',
        };
      }

      if (parsed.type && parsed.type !== 'object') {
        return {
          parsedProperties: [] as ParsedProperty[],
          parseError: 'Root schema "type" must be "object".',
        };
      }

      const properties = parsed.properties;
      if (!properties || typeof properties !== 'object' || Array.isArray(properties)) {
        return { parsedProperties: [] as ParsedProperty[], parseError: null };
      }

      const list: ParsedProperty[] = Object.entries(properties).map(
        ([key, prop]) => {
          const propertyRecord =
            prop && typeof prop === 'object'
              ? (prop as Record<string, unknown>)
              : {};
          return {
            key,
            type:
              typeof propertyRecord.type === 'string'
                ? propertyRecord.type
                : 'unknown',
            title:
              typeof propertyRecord.title === 'string'
                ? propertyRecord.title
                : key,
            description:
              typeof propertyRecord.description === 'string'
                ? propertyRecord.description
                : undefined,
            enum: Array.isArray(propertyRecord.enum)
              ? propertyRecord.enum.map(String)
              : undefined,
            format:
              typeof propertyRecord.format === 'string'
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

  const handleBeautify = () => {
    try {
      const parsed = JSON.parse(schemaText);
      setSchemaText(JSON.stringify(parsed, null, 2));
      toast.success('JSON formatted successfully.');
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : '';
      toast.error(`Cannot format invalid JSON${detail}. Please fix syntax errors first.`);
    }
  };

  const handleLoadStarterTemplate = () => {
    setSchemaText(JSON.stringify(SAMPLE_STARTER_SCHEMA, null, 2));
    setValidationResult({
      status: 'valid',
      message: 'Loaded standard starter template. Click Save Changes to apply.',
    });
    toast.info('Loaded standard template with MoSCoW and Acceptance Criteria.');
  };

  const handleValidate = () => {
    try {
      const parsed = JSON.parse(schemaText);
      if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
        setValidationResult({
          status: 'invalid',
          message: 'Root schema must be a JSON object.',
        });
        return;
      }
      if (parsed.type && parsed.type !== 'object') {
        setValidationResult({
          status: 'invalid',
          message: 'Root schema "type" must be "object".',
        });
        return;
      }
      if (
        parsed.properties !== undefined &&
        (typeof parsed.properties !== 'object' ||
          parsed.properties === null ||
          Array.isArray(parsed.properties))
      ) {
        setValidationResult({
          status: 'invalid',
          message: 'The "properties" field must be an object dictionary.',
        });
        return;
      }

      setValidationResult({
        status: 'valid',
        message: `Schema is syntactically valid (${parsedProperties.length} dynamic ${
          parsedProperties.length === 1 ? 'field' : 'fields'
        } defined). Ready to save.`,
      });
      toast.success('Schema is valid!');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Invalid JSON';
      setValidationResult({
        status: 'invalid',
        message: `JSON Syntax Error: ${msg}`,
      });
      toast.error(`Invalid JSON: ${msg}`);
    }
  };

  const handleSave = async () => {
    if (!isManagerOrAdmin) {
      toast.error('Only project managers and administrators can save field schemas.');
      return;
    }

    let parsedConfig: unknown;
    try {
      parsedConfig = JSON.parse(schemaText);
    } catch (err) {
      const detail = err instanceof Error ? `: ${err.message}` : '';
      toast.error(`Cannot save invalid JSON${detail}. Please correct syntax errors.`);
      return;
    }

    setIsSaving(true);
    try {
      await updateProjectFieldsConfig(project.id, parsedConfig);
      toast.success('Dynamic fields schema saved successfully.');
      setValidationResult({
        status: 'valid',
        message: 'Changes saved to project.',
      });
      router.refresh();
    } catch (error) {
      const msg =
        error instanceof Error
          ? error.message
          : 'Failed to save dynamic fields schema.';
      toast.error(msg);
      setValidationResult({
        status: 'invalid',
        message: msg,
      });
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
            <h2 className="text-xl font-semibold tracking-tight text-foreground">
              Dynamic Fields
            </h2>
          </div>
          <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
            Configure custom metadata fields for work items in this project using standard
            JSON Schema. Dynamic fields adapt to agile workflows (Scrum, Kanban, SAFe)
            and appear on work-item details without blocking core workflows.
          </p>
        </div>

        {/* Action Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleLoadStarterTemplate}
            disabled={!isManagerOrAdmin || isSaving}
            title="Populate standard starter template"
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
            disabled
            className="cursor-not-allowed opacity-75"
            title="Alice AI Schema Generator (Phase 2)"
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
        <div className="border-border bg-muted/40 flex items-center gap-3 rounded-lg border p-3 text-sm text-muted-foreground">
          <Lock className="size-4 shrink-0 text-amber-500" />
          <span>
            You have view-only access to this project&apos;s dynamic fields configuration.
            Only project managers and administrators can edit and save schemas.
          </span>
        </div>
      )}

      {/* Validation Status Banner */}
      {validationResult.status === 'valid' && (
        <div className="border-emerald-500/20 bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm">
          <CheckCircle2 className="size-4 shrink-0" />
          <span>{validationResult.message}</span>
        </div>
      )}

      {(validationResult.status === 'invalid' || parseError) && (
        <div className="border-destructive/20 bg-destructive/10 text-destructive flex items-center gap-2.5 rounded-lg border px-3.5 py-2.5 text-sm">
          <AlertTriangle className="size-4 shrink-0" />
          <span className="font-medium">
            {validationResult.status === 'invalid'
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
            <h3 className="text-sm font-semibold tracking-tight text-foreground">
              Configured Fields ({parsedProperties.length})
            </h3>
          </div>
          <span className="text-muted-foreground text-xs">
            Rendered preview of fields defined in the schema below
          </span>
        </div>

        {parsedProperties.length === 0 ? (
          <Card className="border-dashed border-border/80 bg-card/40">
            <CardContent className="flex flex-col items-center justify-center py-8 text-center">
              <SlidersHorizontal className="text-muted-foreground/60 mb-2 size-8 stroke-1" />
              <p className="text-sm font-medium text-foreground">
                No dynamic fields configured yet
              </p>
              <p className="text-muted-foreground mt-1 max-w-sm text-xs">
                Define field properties in the JSON Schema editor below, or click &quot;Load
                Template&quot; to populate common fields.
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {parsedProperties.map((prop) => (
              <Card
                key={prop.key}
                className="border-border/60 bg-card/60 transition-colors hover:border-border"
              >
                <CardHeader className="p-4 pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-sm font-semibold text-foreground truncate">
                      {prop.title}
                    </CardTitle>
                    <Badge variant="secondary" className="font-mono text-[10px] shrink-0">
                      {prop.format ? `${prop.type}:${prop.format}` : prop.type}
                    </Badge>
                  </div>
                  <CardDescription className="font-mono text-xs text-muted-foreground truncate">
                    key: {prop.key}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4 pt-1 space-y-2 text-xs">
                  {prop.description && (
                    <p className="text-muted-foreground line-clamp-2">
                      {prop.description}
                    </p>
                  )}
                  {prop.enum && prop.enum.length > 0 && (
                    <div className="space-y-1">
                      <span className="text-muted-foreground font-medium text-[11px]">
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
                      Default: <code className="font-mono">{String(prop.default)}</code>
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
            className="text-sm font-semibold tracking-tight text-foreground"
          >
            JSON Schema Specification
          </label>
          <span className="text-muted-foreground font-mono text-xs">
            Draft 2020-12 / Draft-07 Compatible
          </span>
        </div>

        <div className="relative rounded-lg border border-border bg-muted/20 focus-within:border-ring focus-within:ring-1 focus-within:ring-ring">
          <textarea
            id="json-schema-editor"
            rows={18}
            value={schemaText}
            onChange={(e) => {
              setSchemaText(e.target.value);
              if (validationResult.status !== 'unvalidated') {
                setValidationResult({ status: 'unvalidated' });
              }
            }}
            disabled={!isManagerOrAdmin || isSaving}
            className="font-mono text-xs md:text-sm leading-relaxed w-full resize-y bg-transparent p-4 outline-none placeholder:text-muted-foreground disabled:opacity-75 disabled:cursor-not-allowed"
            placeholder="Enter JSON Schema..."
            spellCheck={false}
          />
        </div>

        <p className="text-muted-foreground text-xs flex items-center gap-1.5 pt-1">
          <Info className="size-3.5 shrink-0" />
          Dynamic field definitions support standard types: string, number, boolean, array,
          and select options (enum).
        </p>
      </div>
    </div>
  );
}
