'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { FIGMA_PROJECT_URL_MESSAGE, isValidFigmaProjectUrl } from '@repo/types';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Edit, ExternalLink, Trash2 } from '@repo/ui/lib/icons';
import { IntegrationIdentity } from '@/app/settings/_components/settings-integration-identity';
import { WORKSPACE_INTEGRATIONS } from '@/app/settings/_components/settings-integration-catalog';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import {
  IntegrationEditForm,
  IntegrationFeedbackBanner,
  IntegrationSummaryFields,
} from '@/app/projects/_components/project-details/integration-settings-shared';
import { useIntegrationSettingsSave } from '@/app/projects/_hooks/use-integration-settings-save';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

const FIGMA_CATALOG_ITEM = WORKSPACE_INTEGRATIONS.find(
  (integration) => integration.id === 'figma'
);

export type FigmaSettingsCardProps = {
  readonly project: Project;
  readonly canEditProject: boolean;
};

export function FigmaSettingsCard({
  project,
  canEditProject,
}: Readonly<FigmaSettingsCardProps>) {
  const [savedUrl, setSavedUrl] = useState(project.figma_url ?? null);
  const [figmaUrl, setFigmaUrl] = useState(project.figma_url ?? '');
  const [isEditing, setIsEditing] = useState(!project.figma_url);

  const { isSaving, message, isError, clearFeedback, setFailure, save } =
    useIntegrationSettingsSave({
      projectId: project.id,
      expectedUpdatedAt: project.updated_at,
      successMessage: 'Figma link saved successfully!',
      logLabel: 'Failed to save Figma link:',
    });

  useEffect(() => {
    setSavedUrl(project.figma_url ?? null);
    setFigmaUrl(project.figma_url ?? '');
    setIsEditing(!project.figma_url);
  }, [project.figma_url]);

  if (!FIGMA_CATALOG_ITEM) {
    return null;
  }

  const handleCancelEdit = () => {
    setFigmaUrl(savedUrl ?? '');
    setIsEditing(false);
    clearFeedback();
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();
    const nextUrl = figmaUrl.trim();
    if (!isValidFigmaProjectUrl(nextUrl)) {
      setFailure(FIGMA_PROJECT_URL_MESSAGE);
      return;
    }

    if (await save({ figma_url: nextUrl })) {
      setSavedUrl(nextUrl);
      setFigmaUrl(nextUrl);
      setIsEditing(false);
    }
  };

  const handleRemove = async () => {
    if (await save({ figma_url: null })) {
      setSavedUrl(null);
      setFigmaUrl('');
      setIsEditing(true);
    }
  };

  const body =
    canEditProject && isEditing ? (
      <IntegrationEditForm
        onSubmit={handleSave}
        showCancel={Boolean(savedUrl)}
        onCancel={handleCancelEdit}
        isSaving={isSaving}
        saveDisabled={!figmaUrl.trim()}
        saveLabel="Save Figma Link"
      >
        <div className="space-y-2">
          <Label htmlFor={`figma-url-${project.id}`}>Figma URL</Label>
          <Input
            id={`figma-url-${project.id}`}
            type="url"
            value={figmaUrl}
            onChange={(event) => setFigmaUrl(event.target.value)}
            placeholder="https://www.figma.com/design/..."
            autoComplete="url"
            required
          />
          <p className="text-muted-foreground text-xs">
            Save one Figma file, prototype, board, or slide for this project.
          </p>
        </div>
      </IntegrationEditForm>
    ) : (
      <div className="space-y-4">
        <IntegrationSummaryFields
          fields={[
            {
              label: 'Project link',
              value: savedUrl ?? 'Not configured',
            },
          ]}
        />

        <div className="flex flex-wrap items-center justify-end gap-2">
          {savedUrl ? (
            <Button asChild type="button" variant="outline" size="sm">
              <a href={savedUrl} target="_blank" rel="noopener noreferrer">
                <ExternalLink data-icon="inline-start" />
                Open Figma
              </a>
            </Button>
          ) : null}
          {canEditProject ? (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setIsEditing(true)}
                disabled={isSaving}
              >
                <Edit data-icon="inline-start" />
                Edit link
              </Button>
              {savedUrl ? (
                <Button
                  type="button"
                  variant="destructive"
                  size="sm"
                  onClick={handleRemove}
                  disabled={isSaving}
                >
                  <Trash2 data-icon="inline-start" />
                  Remove link
                </Button>
              ) : null}
            </>
          ) : null}
        </div>
      </div>
    );

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader className="space-y-3">
        <IntegrationIdentity
          name={FIGMA_CATALOG_ITEM.name}
          websiteUrl={FIGMA_CATALOG_ITEM.websiteUrl}
          variant="card"
          statusLabel={savedUrl ? 'Linked' : undefined}
        />
        <CardDescription className="text-muted-foreground text-sm">
          {FIGMA_CATALOG_ITEM.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner message={message} isError={isError} />
        {body}
      </CardContent>
    </Card>
  );
}
