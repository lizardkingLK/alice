'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import type { ChatModelOption } from '@repo/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Label } from '@repo/ui/components/ui/label';
import { Loader2, Star } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import { IntegrationFeedbackBanner } from '@/app/projects/_components/project-details/integration-settings-shared';
import { mapAiBindingsToIntegrationBindings } from '@/app/projects/_helpers/project-ai-bindings';
import {
  listProjectIntegrationBindings,
  putProjectIntegrationBindings,
} from '@/app/projects/_services/projects.integration-bindings.client';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import {
  chatModelDisplayLabel,
  chatProviderDisplayLabel,
} from '@/app/chat/_services/chat-models-api.shared';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';
import { errorMessage } from '@/lib/errors/error-message';

export type ProjectAiModelsCardProps = {
  readonly projectId: string;
  readonly canEdit?: boolean;
};

export function ProjectAiModelsCard({
  projectId,
  canEdit = true,
}: Readonly<ProjectAiModelsCardProps>) {
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [aiBindingIds, setAiBindingIds] = useState<string[]>([]);
  const [defaultAiIntegrationId, setDefaultAiIntegrationId] = useState<
    string | null
  >(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const load = useCallback(async () => {
    setIsLoading(true);
    setFeedback(null);
    try {
      const [orgModels, bindings] = await Promise.all([
        listChatModelsForChatClient(),
        listProjectIntegrationBindings(projectId),
      ]);
      setModels(orgModels);
      setAiBindingIds(bindings.map((row) => row.integration_id));
      const projectDefault = bindings.find((row) => row.is_default_for_project);
      setDefaultAiIntegrationId(projectDefault?.integration_id ?? null);
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

  const selected = new Set(aiBindingIds);

  const toggleModel = (modelId: string, checked: boolean) => {
    if (!canEdit) {
      return;
    }
    if (checked) {
      const nextIds = [...aiBindingIds, modelId];
      setAiBindingIds(nextIds);
      if (!defaultAiIntegrationId) {
        setDefaultAiIntegrationId(modelId);
      }
      return;
    }

    const nextIds = aiBindingIds.filter((id) => id !== modelId);
    setAiBindingIds(nextIds);
    if (defaultAiIntegrationId === modelId) {
      setDefaultAiIntegrationId(nextIds[0] ?? null);
    }
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
      setAiBindingIds(saved.map((row) => row.integration_id));
      const projectDefault = saved.find((row) => row.is_default_for_project);
      setDefaultAiIntegrationId(projectDefault?.integration_id ?? null);
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
          . Empty selection falls through to organization defaults.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner message={feedback} isError={isError} />

        {isLoading ? (
          <div className="text-muted-foreground flex items-center gap-2 text-xs">
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Loading chat models...
          </div>
        ) : null}

        {!isLoading && models.length === 0 ? (
          <p className="text-muted-foreground text-xs">
            No organization chat models yet. Add one under Settings →
            Integrations.
          </p>
        ) : null}

        {!isLoading && models.length > 0 ? (
          <ul className="space-y-2">
            {models.map((model) => {
              const isSelected = selected.has(model.id);
              const isDefault = defaultAiIntegrationId === model.id;
              const label = chatModelDisplayLabel(model);
              const provider = chatProviderDisplayLabel(model.provider);

              return (
                <li key={model.id}>
                  <div className="border-border bg-muted/20 flex items-center gap-3 rounded-lg border p-3">
                    <Checkbox
                      id={`project-ai-model-${model.id}`}
                      checked={isSelected}
                      disabled={!canEdit || isSaving}
                      onCheckedChange={(value) =>
                        toggleModel(model.id, value === true)
                      }
                      className="cursor-pointer"
                    />
                    <div className="grid min-w-0 flex-1 gap-0.5">
                      <Label
                        htmlFor={`project-ai-model-${model.id}`}
                        className="cursor-pointer truncate text-sm font-medium select-none"
                        title={label}
                      >
                        {label}
                      </Label>
                      <p className="text-muted-foreground truncate text-xs">
                        {provider}
                      </p>
                    </div>
                    {isSelected ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="size-8 shrink-0"
                        disabled={!canEdit || isSaving}
                        aria-label={
                          isDefault
                            ? `${label} is the project default`
                            : `Set ${label} as project default`
                        }
                        aria-pressed={isDefault}
                        onClick={() => setDefaultAiIntegrationId(model.id)}
                      >
                        <Star
                          className={cn(
                            'size-4',
                            isDefault && 'fill-current text-amber-500'
                          )}
                        />
                      </Button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        {canEdit ? (
          <div className="flex justify-end">
            <Button
              type="button"
              size="sm"
              disabled={isLoading || isSaving}
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
