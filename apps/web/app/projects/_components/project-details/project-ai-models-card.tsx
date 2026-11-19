'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ProjectAiModelOption } from '@repo/types/api/v1';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Loader2 } from '@repo/ui/lib/icons';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import { IntegrationFeedbackBanner } from '@/app/projects/_components/project-details/integration-settings-shared';
import { ProjectAiModelsLoading } from '@/app/projects/_components/project-ai-models-loading';
import { ProjectAiModelsAccordion } from '@/app/projects/_components/project-ai-models-accordion';
import { ProjectAiModelMintDialog } from '@/app/projects/_components/project-ai-model-mint-dialog';
import {
  mapAiBindingsToIntegrationBindings,
  toggleAiBindingSelection,
} from '@/app/projects/_helpers/project-ai-bindings';
import {
  listProjectAiModels,
  listProjectIntegrationBindings,
  putProjectIntegrationBindings,
} from '@/app/projects/_services/projects.integration-bindings.client';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';
import type { ConfigurableCatalogId } from '@/app/settings/_components/settings-integration-catalog';
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
  const [models, setModels] = useState<ProjectAiModelOption[]>([]);
  const [aiBindingIds, setAiBindingIds] = useState<string[]>([]);
  const [defaultAiIntegrationId, setDefaultAiIntegrationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);
  const [mintOpen, setMintOpen] = useState(false);
  const [mintCatalogId, setMintCatalogId] =
    useState<ConfigurableCatalogId | null>(null);
  const [editModel, setEditModel] = useState<ProjectAiModelOption | null>(null);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [projectModels, bindings] = await Promise.all([
        listProjectAiModels(projectId),
        listProjectIntegrationBindings(projectId),
      ]);
      setModels(projectModels);
      const next = applyBindingsToState(bindings);
      setAiBindingIds(next.aiBindingIds);
      setDefaultAiIntegrationId(next.defaultAiIntegrationId);
      setIsError(false);
    } catch (error: unknown) {
      setModels([]);
      setAiBindingIds([]);
      setDefaultAiIntegrationId(null);
      setIsError(true);
      setFeedback(errorMessage(error, 'Failed to load AI model bindings'));
    } finally {
      setIsLoading(false);
    }
  }, [projectId]);

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

  const busy = isLoading || isSaving;

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-base">AI agents</CardTitle>
        <CardDescription>
          Enable organization models or mint project-only keys here. Org
          credentials stay in{' '}
          <Link
            href={chatAiAgentsIntegrationsHref()}
            className="text-foreground underline underline-offset-2"
          >
            Settings → Integrations
          </Link>
          .
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner message={feedback} isError={isError} />

        {isLoading ? (
          <ProjectAiModelsLoading />
        ) : (
          <ProjectAiModelsAccordion
            models={models}
            aiBindingIds={aiBindingIds}
            defaultAiIntegrationId={defaultAiIntegrationId}
            disabled={!canEdit || busy}
            onToggleModel={toggleModel}
            onSetDefault={setDefaultAiIntegrationId}
            onCreateForCatalog={(catalogId) => {
              setEditModel(null);
              setMintCatalogId(catalogId);
              setMintOpen(true);
            }}
            onEditProjectModel={(model) => {
              setMintCatalogId(null);
              setEditModel(model);
              setMintOpen(true);
            }}
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

      <ProjectAiModelMintDialog
        open={mintOpen}
        projectId={projectId}
        catalogId={mintCatalogId}
        editModel={editModel}
        onOpenChange={setMintOpen}
        onSaved={() => {
          void load();
        }}
      />
    </Card>
  );
}
