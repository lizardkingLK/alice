'use client';

import { useEffect, useState, type FormEvent } from 'react';
import { useRouter } from 'next/navigation';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import { Button } from '@repo/ui/components/ui/button';
import { Edit, Loader2, Plug, Unplug } from '@repo/ui/lib/icons';
import { REPORT_CARD_CLASS } from '@/app/projects/_components/project-details/project-details-shared';
import { GitHubLogo } from '@/app/projects/_components/project-details/integration-brand-logos';
import {
  IntegrationEditForm,
  IntegrationFeedbackBanner,
  IntegrationSummaryFields,
} from '@/app/projects/_components/project-details/integration-settings-shared';
import { GithubConnectionFields } from '@/app/projects/_components/github-connection-fields';
import { useGithubConnectionPicker } from '@/app/projects/_hooks/use-github-connection-picker';
import { deleteGithubConnection } from '@/app/projects/_services/projects.github.mutations.client';
import { useIntegrationSettingsSave } from '@/app/projects/_hooks/use-integration-settings-save';
import {
  formatGithubRepoPath,
  parseGithubRepoPath,
} from '@/lib/projects/github-repo-path';
import { errorMessage } from '@/lib/errors/error-message';
import type { GithubConnectionDto } from '@/app/projects/_services/projects.github.mutations.client';
import type { Project } from '@/app/projects/_services/projects.mutations.client';

export type GithubSettingsCardProps = {
  readonly project: Project;
  readonly currentUserId?: string | null;
  readonly currentUserRole?: string | null;
  readonly canEditProject?: boolean;
};

function validateSingleRepo(repoPath: string | null): string | null {
  if (!repoPath) return null;
  const parts = repoPath.split('/');
  if (
    parts.length !== 2 ||
    !parts[0]?.trim() ||
    !parts[1]?.trim() ||
    repoPath.includes(',') ||
    repoPath.includes(' ')
  ) {
    return 'Only one GitHub repository is allowed per project (format: owner/repo).';
  }
  return null;
}

function resolveAuthSummary(
  activeConnection: GithubConnectionDto | null,
  hasGithubToken?: boolean
): string {
  if (activeConnection) {
    return activeConnection.account_login
      ? `@${activeConnection.account_login} (OAuth 2.1)`
      : `${activeConnection.name} (OAuth 2.1)`;
  }
  if (hasGithubToken) {
    return 'Legacy PAT (OAuth recommended)';
  }
  return 'Not connected (Public repos only)';
}

type GithubSummaryViewProps = {
  project: Project;
  activeConnection: GithubConnectionDto | null;
  canManage: boolean;
  disconnectingId: string | null;
  isConnecting: boolean;
  onEdit: () => void;
  // eslint-disable-next-line no-unused-vars
  onDisconnect: (id: string) => void;
  onConnect: () => void;
};

function GithubSummaryView({
  project,
  activeConnection,
  canManage,
  disconnectingId,
  isConnecting,
  onEdit,
  onDisconnect,
  onConnect,
}: Readonly<GithubSummaryViewProps>) {
  return (
    <div className="space-y-4">
      <IntegrationSummaryFields
        fields={[
          {
            label: 'GitHub Repository',
            value: project.github_repo || 'Not configured',
          },
          {
            label: 'GitHub Account',
            value: resolveAuthSummary(
              activeConnection,
              project.has_github_token
            ),
            mono: false,
          },
          {
            label: 'OAuth Status',
            value: activeConnection ? 'Connected' : 'Not Connected',
          },
        ]}
      />

      {canManage ? (
        <div className="flex flex-wrap items-center gap-2 pt-2">
          <Button type="button" variant="outline" size="sm" onClick={onEdit}>
            <Edit className="mr-2 h-4 w-4" />
            Modify GitHub Settings
          </Button>
          {activeConnection ? (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => onDisconnect(activeConnection.id)}
              disabled={disconnectingId === activeConnection.id}
              className="text-destructive hover:text-destructive"
            >
              {disconnectingId === activeConnection.id ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <Unplug className="mr-1 h-3.5 w-3.5" />
              )}
              Disconnect
            </Button>
          ) : (
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
              Connect GitHub
            </Button>
          )}
        </div>
      ) : null}
    </div>
  );
}

export function GithubSettingsCard({
  project,
  canEditProject = true,
}: Readonly<GithubSettingsCardProps>) {
  const router = useRouter();
  const initial = parseGithubRepoPath(project.github_repo);
  const [isEditingGithub, setIsEditingGithub] = useState(!project.github_repo);
  const [githubOwner, setGithubOwner] = useState(initial.owner);
  const [githubRepoName, setGithubRepoName] = useState(initial.repoName);
  const [disconnectingId, setDisconnectingId] = useState<string | null>(null);

  const {
    connections,
    activeConnection,
    repositories,
    isLoadingConnections,
    isLoadingRepositories,
    isConnecting,
    loadError,
    setLoadError,
    refreshConnections,
    handleConnectGithub,
  } = useGithubConnectionPicker();

  const isRestrictedAdminOwned = Boolean(
    activeConnection?.is_admin_owned && !activeConnection?.can_manage
  );
  const canManage = Boolean(canEditProject) && !isRestrictedAdminOwned;

  useEffect(() => {
    if (
      !project.github_repo &&
      activeConnection?.authorized_repo &&
      !githubOwner &&
      !githubRepoName
    ) {
      const parts = parseGithubRepoPath(activeConnection.authorized_repo);
      setGithubOwner(parts.owner);
      setGithubRepoName(parts.repoName);
    }
  }, [activeConnection, project.github_repo, githubOwner, githubRepoName]);

  const {
    isSaving: isSavingGithub,
    message: githubMessage,
    isError: isGithubError,
    setMessage: setGithubMessage,
    setIsError: setIsGithubError,
    clearFeedback,
    setFailure,
    save,
  } = useIntegrationSettingsSave({
    projectId: project.id,
    expectedUpdatedAt: project.updated_at,
    successMessage: 'GitHub integration settings saved successfully!',
    logLabel: 'Failed to save GitHub integration:',
    onSuccess: () => {
      setIsEditingGithub(false);
    },
  });

  useEffect(() => {
    if (!loadError) {
      return;
    }
    setFailure(loadError);
    setLoadError(null);
  }, [loadError, setFailure, setLoadError]);

  const handleCancelEdit = () => {
    const parts = parseGithubRepoPath(project.github_repo);
    setGithubOwner(parts.owner);
    setGithubRepoName(parts.repoName);
    setIsEditingGithub(false);
    clearFeedback();
  };

  const handleSaveGithub = async (e: FormEvent) => {
    e.preventDefault();
    const repoPath = formatGithubRepoPath(githubOwner, githubRepoName);
    const repoError = validateSingleRepo(repoPath);
    if (repoError) {
      setFailure(repoError);
      return;
    }
    const body: Record<string, unknown> = {
      github_repo: repoPath,
    };
    if (!repoPath) {
      body.github_token = null;
    }
    await save(body);
  };

  const handleDisconnect = async (connectionId: string) => {
    setDisconnectingId(connectionId);
    clearFeedback();

    try {
      await deleteGithubConnection(connectionId);
      setGithubMessage('GitHub connection disconnected.');
      setIsGithubError(false);
      refreshConnections();
      router.refresh();
    } catch (err) {
      setFailure(errorMessage(err, 'Failed to disconnect GitHub'));
    } finally {
      setDisconnectingId(null);
    }
  };

  return (
    <Card className={REPORT_CARD_CLASS}>
      <CardHeader>
        <CardTitle className="text-primary flex items-center gap-2 text-base font-semibold">
          <GitHubLogo />
          GitHub Integration
        </CardTitle>
        <CardDescription className="text-muted-foreground text-sm">
          Configure your GitHub repository to link Pull Requests, view commits,
          and track branches.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <IntegrationFeedbackBanner
          message={githubMessage}
          isError={isGithubError}
        />

        {isRestrictedAdminOwned ? (
          <div className="rounded border border-amber-500/20 bg-amber-500/10 p-3 text-xs text-amber-700 dark:text-amber-300">
            This GitHub connection was established by an administrator (@
            {activeConnection?.account_login}). Only that administrator can
            modify or disconnect this connection.
          </div>
        ) : null}

        {isEditingGithub && canManage ? (
          <IntegrationEditForm
            onSubmit={handleSaveGithub}
            showCancel={Boolean(project.github_repo)}
            onCancel={handleCancelEdit}
            isSaving={isSavingGithub}
            saveLabel="Save GitHub Configuration"
          >
            <GithubConnectionFields
              connections={connections}
              activeConnection={activeConnection}
              repositories={repositories}
              isLoadingConnections={isLoadingConnections}
              isLoadingRepositories={isLoadingRepositories}
              isConnecting={isConnecting}
              onConnect={handleConnectGithub}
              githubOwner={githubOwner}
              setGithubOwner={setGithubOwner}
              githubRepoName={githubRepoName}
              setGithubRepoName={setGithubRepoName}
              onDisconnect={handleDisconnect}
              isDisconnecting={disconnectingId !== null}
              canManage={canManage}
            />
          </IntegrationEditForm>
        ) : (
          <GithubSummaryView
            project={project}
            activeConnection={activeConnection}
            canManage={canManage}
            disconnectingId={disconnectingId}
            isConnecting={isConnecting}
            onEdit={() => setIsEditingGithub(true)}
            onDisconnect={handleDisconnect}
            onConnect={handleConnectGithub}
          />
        )}
      </CardContent>
    </Card>
  );
}
