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
import {
  Edit,
  ExternalLink,
  Loader2,
  Plug,
  RefreshCw,
  Trash2,
  Unplug,
} from '@repo/ui/lib/icons';
import { IntegrationIdentity } from '@/app/settings/_components/settings-integration-identity';
import { WORKSPACE_INTEGRATIONS } from '@/app/settings/_components/settings-integration-catalog';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import {
  IntegrationEditForm,
  IntegrationFeedbackBanner,
  IntegrationSummaryFields,
} from '@/app/projects/_components/project-details/integration-settings-shared';
import { useIntegrationSettingsSave } from '@/app/projects/_hooks/use-integration-settings-save';
import { useFigmaConnection } from '@/app/projects/_hooks/use-figma-connection';
import type { FigmaConnectionStatusDto } from '@/app/projects/_services/projects.figma.mutations.client';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

const FIGMA_CATALOG_ITEM = WORKSPACE_INTEGRATIONS.find(
  (integration) => integration.id === 'figma'
);

export type FigmaSettingsCardProps = {
  readonly project: Project;
  readonly canEditProject: boolean;
};

function figmaConnectionLabel(
  isLoading: boolean,
  connection: FigmaConnectionStatusDto | null
): string {
  if (isLoading) return 'Checking...';
  if (connection?.connected) return 'Connected';
  return 'Not connected';
}

function figmaAccessLabel(
  savedUrl: string | null,
  connection: FigmaConnectionStatusDto | null
): string {
  if (!savedUrl) return 'No saved design link';
  if (connection?.design_access_verified) return 'Verified';
  return 'Not verified';
}

type FigmaConnectionPanelProps = {
  readonly connection: FigmaConnectionStatusDto | null;
  readonly savedUrl: string | null;
  readonly canEditProject: boolean;
  readonly isLoading: boolean;
  readonly isConnecting: boolean;
  readonly isVerifying: boolean;
  readonly isDisconnecting: boolean;
  readonly onConnect: () => void;
  readonly onVerify: () => Promise<boolean>;
  readonly onDisconnect: () => Promise<void>;
};

function VerifyFigmaButton({
  busy,
  verifying,
  onVerify,
}: Readonly<{
  busy: boolean;
  verifying: boolean;
  onVerify: () => Promise<boolean>;
}>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={() => void onVerify()}
      disabled={busy}
    >
      {verifying ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <RefreshCw className="mr-1 h-3.5 w-3.5" />
      )}
      Verify design access
    </Button>
  );
}

function ConnectFigmaButton({
  busy,
  connecting,
  connected,
  onConnect,
}: Readonly<{
  busy: boolean;
  connecting: boolean;
  connected: boolean;
  onConnect: () => void;
}>) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      onClick={onConnect}
      disabled={busy}
    >
      {connecting ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Plug className="mr-1 h-3.5 w-3.5" />
      )}
      {connected ? 'Reconnect Figma' : 'Connect Figma'}
    </Button>
  );
}

function DisconnectFigmaButton({
  busy,
  disconnecting,
  onDisconnect,
}: Readonly<{
  busy: boolean;
  disconnecting: boolean;
  onDisconnect: () => Promise<void>;
}>) {
  return (
    <Button
      type="button"
      variant="destructive"
      size="sm"
      onClick={() => void onDisconnect()}
      disabled={busy}
    >
      {disconnecting ? (
        <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
      ) : (
        <Unplug className="mr-1 h-3.5 w-3.5" />
      )}
      Disconnect
    </Button>
  );
}

function FigmaConnectionPanel({
  connection,
  savedUrl,
  canEditProject,
  isLoading,
  isConnecting,
  isVerifying,
  isDisconnecting,
  onConnect,
  onVerify,
  onDisconnect,
}: Readonly<FigmaConnectionPanelProps>) {
  const busy = isConnecting || isVerifying || isDisconnecting;
  const fields = [
    {
      label: 'Connection',
      value: figmaConnectionLabel(isLoading, connection),
    },
    {
      label: 'Design access',
      value: figmaAccessLabel(savedUrl, connection),
    },
    ...(connection?.authorized_by_name
      ? [{ label: 'Authorized by', value: connection.authorized_by_name }]
      : []),
    ...(connection?.verified_file_name
      ? [{ label: 'Verified design', value: connection.verified_file_name }]
      : []),
  ];

  return (
    <>
      <IntegrationSummaryFields fields={fields} />
      {canEditProject ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {connection?.connected && savedUrl ? (
            <VerifyFigmaButton
              busy={busy}
              verifying={isVerifying}
              onVerify={onVerify}
            />
          ) : null}
          <ConnectFigmaButton
            busy={busy}
            connecting={isConnecting}
            connected={Boolean(connection?.connected)}
            onConnect={onConnect}
          />
          {connection?.connected ? (
            <DisconnectFigmaButton
              busy={busy}
              disconnecting={isDisconnecting}
              onDisconnect={onDisconnect}
            />
          ) : null}
        </div>
      ) : null}
    </>
  );
}

export function FigmaSettingsCard({
  project,
  canEditProject,
}: Readonly<FigmaSettingsCardProps>) {
  const [savedUrl, setSavedUrl] = useState(project.figma_url ?? null);
  const [figmaUrl, setFigmaUrl] = useState(project.figma_url ?? '');
  const [isEditing, setIsEditing] = useState(!project.figma_url);
  const {
    connection,
    isLoading: isLoadingConnection,
    isConnecting,
    isVerifying,
    isDisconnecting,
    loadError,
    refresh: refreshConnection,
    verify: verifyDesignAccess,
    disconnect,
    handleConnect,
  } = useFigmaConnection(project.id);

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
      if (connection?.connected) {
        await verifyDesignAccess();
      } else {
        refreshConnection();
      }
    }
  };

  const handleRemove = async () => {
    if (await save({ figma_url: null })) {
      setSavedUrl(null);
      setFigmaUrl('');
      setIsEditing(true);
      refreshConnection();
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
        <IntegrationFeedbackBanner message={loadError} isError={true} />
        <FigmaConnectionPanel
          connection={connection}
          savedUrl={savedUrl}
          canEditProject={canEditProject}
          isLoading={isLoadingConnection}
          isConnecting={isConnecting}
          isVerifying={isVerifying}
          isDisconnecting={isDisconnecting}
          onConnect={handleConnect}
          onVerify={verifyDesignAccess}
          onDisconnect={disconnect}
        />
        {body}
      </CardContent>
    </Card>
  );
}
