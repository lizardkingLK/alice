'use client';

import { useEffect, useMemo, useState } from 'react';
import type { IntegrationWire } from '@repo/types';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
} from '@repo/ui/components/ui/dialog';
import { ExternalLink, CheckCircle2, Loader2, Plug, Unplug } from '@repo/ui/lib/icons';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import { Badge } from '@repo/ui/components/ui/badge';
import { useGithubConnectionPicker } from '@/app/projects/_hooks/use-github-connection-picker';
import { deleteGithubConnection } from '@/app/projects/_services/projects.github.mutations.client';
import {
  CONFIGURABLE_CATALOG_PROVIDERS,
  integrationExternalHref,
  isConfigurableCatalog,
  type WorkspaceIntegration,
} from '@/app/settings/_components/settings-integration-catalog';
import { IntegrationConfigForm } from '@/app/settings/_components/settings-integration-config-form';
import {
  createFormStateForNewModel,
  createFormStateFromRow,
  createFormStateFromRows,
  defaultModelForProvider,
  integrationDialogStatusLabel,
  providerForCatalog,
  saveIntegrationModel,
  type IntegrationSaveFeedback,
} from '@/app/settings/_components/settings-integration-detail-dialog.helpers';
import { IntegrationSaveButton } from '@/app/settings/_components/settings-integration-save-button';
import {
  IntegrationHighlightsList,
  IntegrationIdentity,
} from '@/app/settings/_components/settings-integration-identity';

type IntegrationDetailDialogProps = {
  readonly integration: WorkspaceIntegration | null;
  readonly configuredRows: IntegrationWire[];
  readonly open: boolean;
  /* eslint-disable no-unused-vars -- callback param name documents the value */
  readonly onOpenChange: (open: boolean) => void;
  readonly onSaved: () => void;
  /* eslint-enable no-unused-vars */
};

function GithubIntegrationDetailSection({
  onSaved,
}: Readonly<{
  onSaved: () => void;
}>) {
  const {
    activeConnection,
    isLoadingConnections,
    isConnecting,
    loadError,
    setLoadError,
    refreshConnections,
    handleConnectGithub,
  } = useGithubConnectionPicker();
  const [isDisconnecting, setIsDisconnecting] = useState(false);

  const handleDisconnect = async (connectionId: string) => {
    setIsDisconnecting(true);
    setLoadError(null);
    try {
      await deleteGithubConnection(connectionId);
      refreshConnections();
      onSaved();
    } catch (err) {
      setLoadError(
        err instanceof Error ? err.message : 'Failed to disconnect GitHub'
      );
    } finally {
      setIsDisconnecting(false);
    }
  };

  if (isLoadingConnections) {
    return (
      <div className="flex items-center justify-center py-8">
        <Loader2 className="text-muted-foreground size-5 animate-spin" />
      </div>
    );
  }

  const fallbackLetters = (
    activeConnection?.account_login ||
    activeConnection?.name ||
    'GH'
  )
    .slice(0, 2)
    .toUpperCase();

  return (
    <div className="space-y-4 py-2">
      {loadError ? (
        <div className="bg-destructive/10 text-destructive rounded-md p-3 text-xs">
          {loadError}
        </div>
      ) : null}

      {activeConnection ? (
        <div className="border-border/60 bg-muted/20 space-y-4 rounded-lg border p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-3">
              <Avatar size="sm" className="h-9 w-9 border">
                {activeConnection.account_avatar_url ? (
                  <AvatarImage
                    src={activeConnection.account_avatar_url}
                    alt={
                      activeConnection.account_login || activeConnection.name
                    }
                  />
                ) : null}
                <AvatarFallback>{fallbackLetters}</AvatarFallback>
              </Avatar>
              <div className="min-w-0 leading-tight">
                <div className="flex items-center gap-2">
                  <span className="truncate text-sm font-semibold">
                    {activeConnection.account_login
                      ? `@${activeConnection.account_login}`
                      : activeConnection.name}
                  </span>
                  <Badge
                    variant="outline"
                    className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-600"
                  >
                    <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                    Connected
                  </Badge>
                </div>
                <p className="text-muted-foreground truncate text-xs">
                  {activeConnection.name}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleConnectGithub}
                disabled={isConnecting || isDisconnecting}
                className="h-8 text-xs"
              >
                {isConnecting ? (
                  <>
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                    Updating...
                  </>
                ) : (
                  'Update Connection'
                )}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => handleDisconnect(activeConnection.id)}
                disabled={isConnecting || isDisconnecting}
                className="text-destructive hover:text-destructive h-8 px-2 text-xs"
              >
                {isDisconnecting ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="h-3.5 w-3.5" />
                )}
              </Button>
            </div>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Connected GitHub account is active for the workspace. Work items can link pull requests and commits from repositories you have access to.
          </p>
        </div>
      ) : (
        <div className="border-border/60 bg-muted/20 space-y-3 rounded-lg border p-4 text-center">
          <div className="flex items-center justify-center gap-2">
            <span className="h-2 w-2 rounded-full bg-amber-500" />
            <span className="text-muted-foreground text-xs font-medium">
              Status: Not connected
            </span>
          </div>
          <p className="text-muted-foreground text-xs leading-relaxed">
            Connect your GitHub account to enable linking pull requests, commits, and branches to Alice work items.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              onClick={handleConnectGithub}
              disabled={isConnecting}
              size="sm"
              className="h-8 text-xs"
            >
              {isConnecting ? (
                <>
                  <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  Connecting...
                </>
              ) : (
                <>
                  <Plug className="mr-1.5 h-3.5 w-3.5" />
                  Connect GitHub
                </>
              )}
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

function IntegrationVisitWebsiteButton({ href }: Readonly<{ href: string }>) {
  return (
    <Button type="button" variant="outline" asChild>
      <a href={href} target="_blank" rel="noopener noreferrer">
        Visit website
        <ExternalLink className="size-4" data-icon="inline-end" />
      </a>
    </Button>
  );
}

function IntegrationPlannedActions() {
  return (
    <>
      <Button type="button" disabled>
        Connect
      </Button>
      <Button type="button" variant="outline" disabled>
        Configure
      </Button>
    </>
  );
}

export function IntegrationDetailDialog({
  integration,
  configuredRows,
  open,
  onOpenChange,
  onSaved,
}: Readonly<IntegrationDetailDialogProps>) {
  const provider =
    (integration ? providerForCatalog(integration.id) : null) ?? 'gemini';
  const providerDefault = defaultModelForProvider(provider);

  const [selectedRowId, setSelectedRowId] = useState<string | null>(null);
  const [modelId, setModelId] = useState<string>(providerDefault.value);
  const [displayLabel, setDisplayLabel] = useState<string>(
    providerDefault.label
  );
  const [apiKey, setApiKey] = useState('');
  const [isDefault, setIsDefault] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [feedback, setFeedback] = useState<IntegrationSaveFeedback>({
    success: null,
    error: null,
  });

  const activeRows = useMemo(
    () => configuredRows.filter((row) => row.status === 'active'),
    [configuredRows]
  );

  const selectedRow = useMemo(
    () => activeRows.find((row) => row.id === selectedRowId) ?? null,
    [activeRows, selectedRowId]
  );

  useEffect(() => {
    if (!open || !integration) {
      return;
    }

    const nextState = createFormStateFromRows(activeRows, provider);
    setSelectedRowId(nextState.selectedRowId);
    setModelId(nextState.modelId);
    setDisplayLabel(nextState.displayLabel);
    setIsDefault(nextState.isDefault);
    setApiKey('');
    setFeedback({ success: null, error: null });
  }, [open, integration, activeRows, provider]);

  if (!integration) {
    return null;
  }

  const externalHref = integrationExternalHref(integration.websiteUrl);
  const canConfigure = isConfigurableCatalog(integration.id);
  const isGithub = integration.id === 'github';
  const dialogStatusLabel = integrationDialogStatusLabel(
    integration,
    activeRows
  );

  const resetFeedback = () => {
    setFeedback({ success: null, error: null });
  };

  const handleSelectRow = (row: IntegrationWire) => {
    const nextState = createFormStateFromRow(row);
    setSelectedRowId(nextState.selectedRowId);
    setModelId(nextState.modelId);
    setDisplayLabel(nextState.displayLabel);
    setIsDefault(nextState.isDefault);
    setApiKey('');
    resetFeedback();
  };

  const handleAddModel = () => {
    const nextState = createFormStateForNewModel(activeRows, provider);
    setSelectedRowId(nextState.selectedRowId);
    setModelId(nextState.modelId);
    setDisplayLabel(nextState.displayLabel);
    setIsDefault(nextState.isDefault);
    setApiKey('');
    resetFeedback();
  };

  const handleApplySuggestedModel = (
    nextModelId: string,
    nextDisplayLabel: string
  ) => {
    setModelId(nextModelId);
    setDisplayLabel(nextDisplayLabel);
    resetFeedback();
  };

  const handleSave = async () => {
    if (!canConfigure || !(integration.id in CONFIGURABLE_CATALOG_PROVIDERS)) {
      return;
    }

    setIsSaving(true);
    resetFeedback();

    const result = await saveIntegrationModel({
      catalogId: integration.id,
      selectedRow,
      modelId,
      displayLabel,
      apiKey,
      isDefault,
    });

    setFeedback(result);
    setIsSaving(false);

    if (result.success) {
      setApiKey('');
      onSaved();
    }
  };

  let detailSection: React.ReactNode = null;
  if (isGithub) {
    detailSection = <GithubIntegrationDetailSection onSaved={onSaved} />;
  } else if (canConfigure) {
    detailSection = (
      <IntegrationConfigForm
        provider={provider}
        activeRows={activeRows}
        selectedRowId={selectedRowId}
        selectedRow={selectedRow}
        displayLabel={displayLabel}
        modelId={modelId}
        apiKey={apiKey}
        isDefault={isDefault}
        feedback={feedback}
        onSelectRow={handleSelectRow}
        onAddModel={handleAddModel}
        onDisplayLabelChange={setDisplayLabel}
        onModelIdChange={setModelId}
        onApiKeyChange={setApiKey}
        onIsDefaultChange={setIsDefault}
        onApplySuggestedModel={handleApplySuggestedModel}
      />
    );
  }

  let actionButtons: React.ReactNode;
  if (isGithub) {
    actionButtons = (
      <Button
        type="button"
        variant="outline"
        onClick={() => onOpenChange(false)}
      >
        Done
      </Button>
    );
  } else if (canConfigure) {
    actionButtons = (
      <IntegrationSaveButton
        isSaving={isSaving}
        isEditingExistingRow={Boolean(selectedRow)}
        onSave={() => void handleSave()}
      />
    );
  } else {
    actionButtons = <IntegrationPlannedActions />;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader className="space-y-4 pr-8">
          <IntegrationIdentity
            name={integration.name}
            websiteUrl={integration.websiteUrl}
            variant="dialog"
            statusLabel={dialogStatusLabel}
          />
          <DialogDescription className="text-left text-sm leading-relaxed">
            {integration.description}
          </DialogDescription>
        </DialogHeader>

        {integration.highlights?.length ? (
          <IntegrationHighlightsList highlights={integration.highlights} />
        ) : null}

        {detailSection}

        <DialogFooter className="gap-2 sm:justify-between">
          <IntegrationVisitWebsiteButton href={externalHref} />
          <div className="flex flex-wrap gap-2">
            {actionButtons}
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
