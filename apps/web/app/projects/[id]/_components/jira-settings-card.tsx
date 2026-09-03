'use client';

import { useEffect, useState, type FormEvent, type ReactNode } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Edit, Loader2, Plug, RefreshCw, Unplug } from '@repo/ui/lib/icons';
import { REPORT_CARD_CLASS } from '@/app/projects/[id]/_components/project-details-shared';
import { JiraLogo } from '@/app/projects/[id]/_components/integration-brand-logos';
import {
  IntegrationEditForm,
  IntegrationFeedbackBanner,
  IntegrationSummaryFields,
} from '@/app/projects/[id]/_components/integration-settings-shared';
import {
  connectionLabel,
  deleteJiraConnection,
  importJiraIssues,
  type JiraConnection,
} from '@/app/projects/_services/projects.jira.mutations.client';
import { useJiraConnectionPicker } from '@/app/projects/_hooks/use-jira-connection-picker';
import { useIntegrationSettingsSave } from '@/app/projects/_hooks/use-integration-settings-save';
import { JiraConnectionFields } from '@/app/projects/_components/jira-connection-fields';
import { errorMessage } from '@/lib/errors/error-message';
import type { Project } from '../../_services/projects.mutations.client';

function linkedConnectionSite(
  connections: JiraConnection[],
  connectionId: string | null | undefined
): string | null {
  if (!connectionId) {
    return null;
  }
  const match = connections.find((row) => row.id === connectionId);
  return match ? connectionLabel(match) : null;
}

function JiraConnectionsPanel({
  connections,
  isLoadingConnections,
  isConnecting,
  disconnectingId,
  onConnect,
  onDisconnect,
}: Readonly<{
  connections: JiraConnection[];
  isLoadingConnections: boolean;
  isConnecting: boolean;
  disconnectingId: string | null;
  onConnect: () => void;
  // eslint-disable-next-line no-unused-vars -- disconnect handler
  onDisconnect: (connectionId: string) => void;
}>) {
  let body: ReactNode = null;
  if (isLoadingConnections) {
    body = (
      <div className="text-muted-foreground flex items-center gap-2 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Loading connections...
      </div>
    );
  } else if (connections.length === 0) {
    body = (
      <p className="text-muted-foreground text-xs">
        No Jira sites connected yet. Connect with OAuth to get started.
      </p>
    );
  } else {
    body = (
      <ul className="space-y-2">
        {connections.map((connection) => {
          const isDisconnecting = disconnectingId === connection.id;
          return (
            <li
              key={connection.id}
              className="bg-muted/20 flex items-center justify-between gap-2 rounded-md px-3 py-2 text-sm"
            >
              <span className="min-w-0 truncate">
                {connectionLabel(connection)}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(connection.id)}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive shrink-0"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="mr-1 h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            </li>
          );
        })}
      </ul>
    );
  }

  return (
    <div className="border-border/40 space-y-3 rounded-lg border p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm font-medium">Atlassian connections</p>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={onConnect}
          disabled={isConnecting}
        >
          {isConnecting ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Plug className="mr-2 h-4 w-4" />
          )}
          Connect Jira
        </Button>
      </div>
      {body}
    </div>
  );
}

export type JiraSettingsCardProps = {
  readonly project: Project;
};

export function JiraSettingsCard({ project }: Readonly<JiraSettingsCardProps>) {
  const router = useRouter();
  const isLinked = Boolean(
    project.jira_connection_id && project.jira_project_key
  );
  const [isEditingJira, setIsEditingJira] = useState(!isLinked);
  const [jiraConnectionId, setJiraConnectionId] = useState(
    project.jira_connection_id || ''
  );
  const [jiraProjectKey, setJiraProjectKey] = useState(
    project.jira_project_key || ''
  );
  const {
    connections,
    jiraProjects,
    isLoadingConnections,
    isLoadingProjects,
    isConnecting,
    loadError,
    setLoadError,
    refreshConnections,
    handleConnectJira,
  } = useJiraConnectionPicker(jiraConnectionId);
  const [isSyncingJira, setIsSyncingJira] = useState(false);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const {
    isSaving: isSavingJira,
    message: jiraMessage,
    isError: isJiraError,
    setMessage: setJiraMessage,
    setIsError: setIsJiraError,
    clearFeedback,
    setFailure,
    save,
  } = useIntegrationSettingsSave({
    projectId: project.id,
    expectedUpdatedAt: project.updated_at,
    successMessage: 'Jira integration settings saved successfully!',
    logLabel: 'Failed to save Jira integration:',
    onSuccess: () => {
      setIsEditingJira(false);
    },
  });

  useEffect(() => {
    if (!loadError) {
      return;
    }
    setFailure(loadError);
    setLoadError(null);
  }, [loadError, setFailure, setLoadError]);

  const handleConnectionChange = (id: string) => {
    setJiraConnectionId(id);
    setJiraProjectKey('');
  };

  const handleCancelEdit = () => {
    setJiraConnectionId(project.jira_connection_id || '');
    setJiraProjectKey(project.jira_project_key || '');
    setIsEditingJira(false);
    clearFeedback();
  };

  const handleSaveJira = async (e: FormEvent) => {
    e.preventDefault();
    await save({
      jira_connection_id: jiraConnectionId || null,
      jira_project_key: jiraProjectKey.toUpperCase().trim() || null,
    });
  };

  const handleSyncJira = async () => {
    setIsSyncingJira(true);
    clearFeedback();

    try {
      setJiraMessage('Syncing tasks from Jira Cloud...');
      const res = await importJiraIssues(project.id);
      setJiraMessage(
        `Successfully imported/synced ${res.importedCount} tasks from Jira!`
      );
      setIsJiraError(false);
      router.refresh();
    } catch (err) {
      console.error('Jira sync failed:', errorMessage(err, ''));
      setFailure(errorMessage(err, 'Sync failed'));
    } finally {
      setIsSyncingJira(false);
    }
  };

  const handleDisconnect = async (connectionId: string) => {
    setDisconnectingId(connectionId);
    clearFeedback();

    try {
      await deleteJiraConnection(connectionId);
      if (jiraConnectionId === connectionId) {
        setJiraConnectionId('');
        setJiraProjectKey('');
      }
      setJiraMessage('Jira connection disconnected.');
      setIsJiraError(false);
      refreshConnections();
      router.refresh();
    } catch (err) {
      setFailure(errorMessage(err, 'Failed to disconnect Jira'));
    } finally {
      setDisconnectingId(null);
    }
  };

  const linkedSite =
    linkedConnectionSite(connections, project.jira_connection_id) ??
    'Linked site';

  const linkSection = isEditingJira ? (
    <IntegrationEditForm
      onSubmit={handleSaveJira}
      showCancel={isLinked}
      onCancel={handleCancelEdit}
      isSaving={isSavingJira}
      saveDisabled={
        !jiraConnectionId || !jiraProjectKey || connections.length === 0
      }
      saveLabel="Save Connection"
    >
      <JiraConnectionFields
        connections={connections}
        jiraConnectionId={jiraConnectionId}
        setJiraConnectionId={handleConnectionChange}
        jiraProjects={jiraProjects}
        isLoadingProjects={isLoadingProjects}
        jiraProjectKey={jiraProjectKey}
        setJiraProjectKey={setJiraProjectKey}
        isConnecting={isConnecting}
        onConnect={handleConnectJira}
        emptyHint="Connect a Jira site above before linking a project."
        showConnectChrome={false}
      />
    </IntegrationEditForm>
  ) : (
    <div className="space-y-4">
      <IntegrationSummaryFields
        fields={[
          { label: 'Linked site', value: linkedSite },
          {
            label: 'Project Key',
            value: project.jira_project_key || 'Not configured',
            mono: true,
          },
        ]}
      />

      <div className="flex items-center justify-between gap-2 pt-2">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => setIsEditingJira(true)}
          disabled={isSyncingJira}
        >
          <Edit className="mr-2 h-4 w-4" />
          Modify Connection
        </Button>

        <Button
          type="button"
          size="sm"
          onClick={handleSyncJira}
          disabled={isSyncingJira || !isLinked}
          className="animate-fade-in bg-emerald-600 text-white hover:bg-emerald-700"
        >
          {isSyncingJira ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <RefreshCw className="mr-2 h-4 w-4" />
          )}
          Sync / Import Tasks
        </Button>
      </div>
    </div>
  );

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
          <JiraLogo />
          Jira Cloud Integration
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Authorize Atlassian once, then link a Jira project to import and sync
          issues.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner
          message={jiraMessage}
          isError={isJiraError}
        />
        <JiraConnectionsPanel
          connections={connections}
          isLoadingConnections={isLoadingConnections}
          isConnecting={isConnecting}
          disconnectingId={disconnectingId}
          onConnect={handleConnectJira}
          onDisconnect={handleDisconnect}
        />
        {linkSection}
      </CardContent>
    </Card>
  );
}
