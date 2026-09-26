'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Label } from '@repo/ui/components/ui/label';
import {
  GitHubLogo,
  JiraLogo,
} from '@/app/projects/_components/project-details/integration-brand-logos';
import { useJiraConnectionPicker } from '@/app/projects/_hooks/use-jira-connection-picker';
import { JiraConnectionFields } from '@/app/projects/_components/jira-connection-fields';
import { useGithubConnectionPicker } from '@/app/projects/_hooks/use-github-connection-picker';
import { deleteGithubConnection } from '@/app/projects/_services/projects.github.mutations.client';
import { GithubConnectionFields } from '@/app/projects/_components/github-connection-fields';
import { parseGithubRepoPath } from '@/lib/projects/github-repo-path';

function IntegrationProviderOption({
  id,
  checked,
  onCheckedChange,
  logo,
  title,
  description,
  children,
}: Readonly<{
  id: string;
  checked: boolean;
  // eslint-disable-next-line no-unused-vars
  onCheckedChange: (checked: boolean) => void;
  logo: ReactNode;
  title: string;
  description: string;
  children?: ReactNode;
}>) {
  return (
    <div className="space-y-3">
      <div className="border-border bg-muted/20 flex items-start gap-3 rounded-lg border p-4">
        <Checkbox
          id={id}
          checked={checked}
          onCheckedChange={(value) => onCheckedChange(value === true)}
          className="mt-0.5 cursor-pointer"
        />
        <div className="flex min-w-0 flex-1 items-start gap-3">
          <div className="bg-background flex size-9 shrink-0 items-center justify-center rounded-md border">
            {logo}
          </div>
          <div className="grid min-w-0 gap-1 leading-none">
            <Label
              htmlFor={id}
              className="cursor-pointer text-sm font-semibold select-none"
            >
              {title}
            </Label>
            <p className="text-muted-foreground text-xs">{description}</p>
          </div>
        </div>
      </div>
      {checked ? children : null}
    </div>
  );
}

/* eslint-disable no-unused-vars */
export interface Step2ImportsProps {
  importFromJira: boolean;
  handleJiraCheckboxChange: (_checked: boolean) => void;
  jiraConnectionId: string;
  setJiraConnectionId: (_id: string) => void;
  jiraProjectKey: string;
  setJiraProjectKey: (_key: string) => void;
}
/* eslint-enable no-unused-vars */

export function Step2Imports({
  importFromJira,
  handleJiraCheckboxChange,
  jiraConnectionId,
  setJiraConnectionId,
  jiraProjectKey,
  setJiraProjectKey,
}: Readonly<Step2ImportsProps>) {
  const {
    connections,
    jiraProjects,
    isLoadingConnections,
    isLoadingProjects,
    isConnecting,
    loadError,
    handleConnectJira,
  } = useJiraConnectionPicker(jiraConnectionId);

  const handleConnectionChange = (id: string) => {
    setJiraConnectionId(id);
    setJiraProjectKey('');
  };

  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="space-y-1">
        <p className="text-sm font-medium">Import sources</p>
        <p className="text-muted-foreground text-xs">
          Choose product management systems to import work items from. More
          options can be added over time.
        </p>
      </div>

      {loadError ? (
        <p className="text-destructive text-xs font-medium">{loadError}</p>
      ) : null}

      <ul className="space-y-3">
        <li>
          <IntegrationProviderOption
            id="importFromJira"
            checked={importFromJira}
            onCheckedChange={handleJiraCheckboxChange}
            logo={<JiraLogo />}
            title="Jira"
            description="Import active issues from an Atlassian site you have connected via OAuth."
          >
            <div className="border-border/60 bg-muted/30 rounded-lg border p-4">
              {isLoadingConnections ? (
                <p className="text-muted-foreground text-xs">
                  Loading Jira connections...
                </p>
              ) : (
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
                  emptyHint="Authorize Atlassian once, then pick a Jira project to link on create."
                  footerHint="Issues import after the Alice project is created when this step is enabled."
                />
              )}
            </div>
          </IntegrationProviderOption>
        </li>
      </ul>
    </div>
  );
}

/* eslint-disable no-unused-vars */
export interface Step3SourceControlProps {
  enableGithub: boolean;
  setEnableGithub: (_enable: boolean) => void;
  githubOwner: string;
  setGithubOwner: (_owner: string) => void;
  githubRepoName: string;
  setGithubRepoName: (_repoName: string) => void;
  githubToken?: string;
  setGithubToken?: (_token: string) => void;
}
/* eslint-enable no-unused-vars */

export function Step3SourceControl({
  enableGithub,
  setEnableGithub,
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
}: Readonly<Step3SourceControlProps>) {
  const {
    connections,
    activeConnection,
    repositories,
    isLoadingConnections,
    isLoadingRepositories,
    isConnecting,
    loadError,
    handleConnectGithub,
    refreshConnections,
  } = useGithubConnectionPicker();

  const [isDisconnecting, setIsDisconnecting] = useState(false);

  useEffect(() => {
    if (activeConnection?.authorized_repo && !githubOwner && !githubRepoName) {
      const parts = parseGithubRepoPath(activeConnection.authorized_repo);
      setGithubOwner(parts.owner);
      setGithubRepoName(parts.repoName);
    }
  }, [
    activeConnection,
    githubOwner,
    githubRepoName,
    setGithubOwner,
    setGithubRepoName,
  ]);

  const isRestrictedAdminOwned = Boolean(
    activeConnection?.is_admin_owned && !activeConnection?.can_manage
  );
  const canManage = !isRestrictedAdminOwned;

  const handleDisconnect = async (connectionId: string) => {
    setIsDisconnecting(true);
    try {
      await deleteGithubConnection(connectionId);
      refreshConnections();
    } catch {
      // noop
    } finally {
      setIsDisconnecting(false);
    }
  };

  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-4 duration-300">
      <div className="space-y-1">
        <p className="text-sm font-medium">Source control</p>
        <p className="text-muted-foreground text-xs">
          Connect a repository host to link pull requests, commits, and
          branches. More SCMs can be added over time.
        </p>
      </div>

      {loadError ? (
        <p className="text-destructive text-xs font-medium">{loadError}</p>
      ) : null}

      <ul className="space-y-3">
        <li>
          <IntegrationProviderOption
            id="enableGithub"
            checked={enableGithub}
            onCheckedChange={setEnableGithub}
            logo={<GitHubLogo />}
            title="GitHub"
            description="Link pull requests, view commits, and track branches inside your tasks."
          >
            <div className="border-border/60 bg-muted/30 rounded-lg border p-4">
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
                isDisconnecting={isDisconnecting}
                canManage={canManage}
              />
            </div>
          </IntegrationProviderOption>
        </li>
      </ul>
    </div>
  );
}
