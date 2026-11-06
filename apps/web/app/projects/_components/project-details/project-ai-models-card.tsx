'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChatModelOption } from '@repo/types';
import type { ProjectIntegrationBindingImportSource } from '@repo/types/api/v1';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Loader2 } from '@repo/ui/lib/icons';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import { IntegrationFeedbackBanner } from '@/app/projects/_components/project-details/integration-settings-shared';
import { ProjectAiModelsPicker } from '@/app/projects/_components/project-ai-models-picker';
import {
  mapAiBindingsToIntegrationBindings,
  toggleAiBindingSelection,
} from '@/app/projects/_helpers/project-ai-bindings';
import {
  importProjectIntegrationBindingsFromProject,
  listProjectIntegrationBindingImportSources,
  listProjectIntegrationBindings,
  putProjectIntegrationBindings,
} from '@/app/projects/_services/projects.integration-bindings.client';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';
import { errorMessage } from '@/lib/errors/error-message';

export type ProjectAiModelsCardProps = {
  readonly projectId: string;
  readonly canEdit?: boolean;
};

function applyBindingsToState(
  bindings: ReadonlyArray<{
    integration_id: string;
    is_default_for_project: boolean;
  }>
): { aiBindingIds: string[]; defaultAiIntegrationId: string | null } {
  const aiBindingIds = bindings.map((row) => row.integration_id);
  const projectDefault = bindings.find((row) => row.is_default_for_project);
  return {
    aiBindingIds,
    defaultAiIntegrationId: projectDefault?.integration_id ?? null,
  };
}

export function ProjectAiModelsCard({
  projectId,
  canEdit = true,
}: Readonly<ProjectAiModelsCardProps>) {
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [aiBindingIds, setAiBindingIds] = useState<string[]>([]);
  const [defaultAiIntegrationId, setDefaultAiIntegrationId] = useState<
    string | null
  >(null);
  const [importSources, setImportSources] = useState<
    ProjectIntegrationBindingImportSource[]
  >([]);
  const [selectedSourceProjectId, setSelectedSourceProjectId] = useState<
    string | undefined
  >(undefined);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [orgModels, bindings, sources] = await Promise.all([
        listChatModelsForChatClient(),
        listProjectIntegrationBindings(projectId),
        canEdit
          ? listProjectIntegrationBindingImportSources(projectId)
          : Promise.resolve([]),
      ]);
      setModels(orgModels);
      const next = applyBindingsToState(bindings);
      setAiBindingIds(next.aiBindingIds);
      setDefaultAiIntegrationId(next.defaultAiIntegrationId);
      setImportSources(sources);
      setSelectedSourceProjectId((current) =>
        current && sources.some((source) => source.project_id === current)
          ? current
          : undefined
      );
    } catch (error: unknown) {
      setModels([]);
      setAiBindingIds([]);
      setDefaultAiIntegrationId(null);
      setImportSources([]);
      setIsError(true);
      setFeedback(errorMessage(error, 'Failed to load AI model bindings'));
    } finally {
      setIsLoading(false);
    }
  }, [canEdit, projectId]);

  useEffect(() => {
    void load();
  }, [load]);

  const toggleModel = (modelId: string, checked: boolean) => {
    if (!canEdit) {
      return;
    }
    const next = toggleAiBindingSelection(
      { aiBindingIds, defaultAiIntegrationId },
      modelId,
      checked
    );
    setAiBindingIds([...next.aiBindingIds]);
    setDefaultAiIntegrationId(next.defaultAiIntegrationId);
  };

  const handleSave = async () => {
    if (!canEdit) {
      return;
    }
    setIsSaving(true);
    setFeedback(null);
    try {
      const bindings =
        mapAiBindingsToIntegrationBindings(
          aiBindingIds,
          defaultAiIntegrationId
        ) ?? [];
      const saved = await putProjectIntegrationBindings(projectId, bindings);
      const next = applyBindingsToState(saved);
      setAiBindingIds(next.aiBindingIds);
      setDefaultAiIntegrationId(next.defaultAiIntegrationId);
      setIsError(false);
      setFeedback(
        bindings.length === 0
          ? 'Cleared project AI models. Chat will use organization defaults.'
          : 'Project AI models updated.'
      );
    } catch (error: unknown) {
      setIsError(true);
      setFeedback(errorMessage(error, 'Failed to save AI model bindings'));
    } finally {
      setIsSaving(false);
    }
  };

  const handleImport = async () => {
    if (!canEdit || !selectedSourceProjectId) {
      return;
    }
    setIsImporting(true);
    setFeedback(null);
    try {
      const saved = await importProjectIntegrationBindingsFromProject(
        projectId,
        selectedSourceProjectId
      );
      const next = applyBindingsToState(saved);
      setAiBindingIds(next.aiBindingIds);
      setDefaultAiIntegrationId(next.defaultAiIntegrationId);
      setIsError(false);
      setFeedback(
        saved.length === 0
          ? 'Imported an empty AI pool from the source project.'
          : `Imported ${saved.length} AI model bind(s) from the source project.`
      );
    } catch (error: unknown) {
      setIsError(true);
      setFeedback(
        errorMessage(error, 'Failed to import AI model bindings from project')
      );
    } finally {
      setIsImporting(false);
    }
  };

  const busy = isLoading || isSaving || isImporting;

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">AI agents</CardTitle>
        <CardDescription>
          Bind organization chat models for Alice Chat in this project. Mint new
          keys in{' '}
          <Link
            href={chatAiAgentsIntegrationsHref()}
            className="text-foreground underline underline-offset-2"
          >
            Settings → Integrations
          </Link>
          . Empty selection falls through to organization defaults. Import
          copies org binds from another project you belong to (no API keys).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner message={feedback} isError={isError} />

        {canEdit && importSources.length > 0 ? (
          <div className="space-y-2">
            <Label htmlFor="ai-import-source">Import from project</Label>
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
              <Select
                value={selectedSourceProjectId}
                onValueChange={setSelectedSourceProjectId}
                disabled={busy}
              >
                <SelectTrigger id="ai-import-source" className="sm:max-w-sm">
                  <SelectValue placeholder="Choose a project you belong to" />
                </SelectTrigger>
                <SelectContent>
                  {importSources.map((source) => (
                    <SelectItem
                      key={source.project_id}
                      value={source.project_id}
                    >
                      {source.name} ({source.key}) · {source.binding_count}{' '}
                      model
                      {source.binding_count === 1 ? '' : 's'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={busy || !selectedSourceProjectId}
                onClick={() => void handleImport()}
              >
                {isImporting ? (
                  <>
                    <Loader2
                      data-icon="inline-start"
                      className="animate-spin"
                    />
                    Importing
                  </>
                ) : (
                  'Import binds'
                )}
              </Button>
            </div>
          </div>
        ) : null}

        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading chat models...
          </div>
        ) : (
          <ProjectAiModelsPicker
            models={models}
            aiBindingIds={aiBindingIds}
            defaultAiIntegrationId={defaultAiIntegrationId}
            idPrefix="project-ai-model"
            disabled={!canEdit || busy}
            emptyMessage="No organization chat models yet. Add one under Settings → Integrations."
            onToggleModel={toggleModel}
            onSetDefault={setDefaultAiIntegrationId}
          />
        )}

        {canEdit ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={busy}
              onClick={() => void handleSave()}
            >
              {isSaving ? (
                <>
                  <Loader2 data-icon="inline-start" className="animate-spin" />
                  Saving
                </>
              ) : (
                'Save AI models'
              )}
            </Button>
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
