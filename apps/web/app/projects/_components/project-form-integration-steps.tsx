'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { Label } from '@repo/ui/components/ui/label';
import type { ChatModelOption } from '@repo/types';
import {
  GitHubLogo,
  JiraLogo,
} from '@/app/projects/_components/project-details/integration-brand-logos';
import { ProjectAiModelsPicker } from '@/app/projects/_components/project-ai-models-picker';
import { useJiraConnectionPicker } from '@/app/projects/_hooks/use-jira-connection-picker';
import { JiraConnectionFields } from '@/app/projects/_components/jira-connection-fields';
import { useGithubConnectionPicker } from '@/app/projects/_hooks/use-github-connection-picker';
import { deleteGithubConnection } from '@/app/projects/_services/projects.github.mutations.client';
import { GithubConnectionFields } from '@/app/projects/_components/github-connection-fields';
import { parseGithubRepoPath } from '@/lib/projects/github-repo-path';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';
import { toggleAiBindingSelection } from '@/app/projects/_helpers/project-ai-bindings';

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

function ImportsSection({
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
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Import sources</p>
        <p className="text-muted-foreground text-xs">
          Choose product management systems to import work items from.
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

export function Step2Imports(props: Readonly<Step2ImportsProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
      <ImportsSection {...props} />
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
  /** OAuth connection id → `projects.vc_connection_id` on create/update. */
  setGithubConnectionId?: (_connectionId: string | null) => void;
}
/* eslint-enable no-unused-vars */

function SourceControlSection({
  enableGithub,
  setEnableGithub,
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
  setGithubConnectionId,
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
    if (!setGithubConnectionId) {
      return;
    }
    if (!enableGithub) {
      setGithubConnectionId(null);
      return;
    }
    setGithubConnectionId(activeConnection?.id ?? null);
  }, [activeConnection, enableGithub, setGithubConnectionId]);

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
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">Source control</p>
        <p className="text-muted-foreground text-xs">
          Connect a repository host to link pull requests, commits, and
          branches.
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

export function Step3SourceControl(props: Readonly<Step3SourceControlProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 duration-300">
      <SourceControlSection {...props} />
    </div>
  );
}

/* eslint-disable no-unused-vars */
export interface StepAiAgentsProps {
  aiBindingIds: string[];
  setAiBindingIds: (_ids: string[]) => void;
  defaultAiIntegrationId: string | null;
  setDefaultAiIntegrationId: (_id: string | null) => void;
}
/* eslint-enable no-unused-vars */

function AiAgentsSection({
  aiBindingIds,
  setAiBindingIds,
  defaultAiIntegrationId,
  setDefaultAiIntegrationId,
}: Readonly<StepAiAgentsProps>) {
  const [models, setModels] = useState<ChatModelOption[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setIsLoading(true);
    listChatModelsForChatClient()
      .then((next) => {
        if (!cancelled) {
          setModels(next);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setModels([]);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const toggleModel = (modelId: string, checked: boolean) => {
    const next = toggleAiBindingSelection(
      { aiBindingIds, defaultAiIntegrationId },
      modelId,
      checked
    );
    setAiBindingIds([...next.aiBindingIds]);
    setDefaultAiIntegrationId(next.defaultAiIntegrationId);
  };

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <p className="text-sm font-medium">AI agents</p>
        <p className="text-muted-foreground text-xs">
          Bind org chat models to this project. Configure new keys in{' '}
          <Link
            href={chatAiAgentsIntegrationsHref()}
            className="text-foreground underline underline-offset-2"
          >
            Settings → Integrations
          </Link>
          .
        </p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground text-xs">Loading chat models...</p>
      ) : (
        <ProjectAiModelsPicker
          models={models}
          aiBindingIds={aiBindingIds}
          defaultAiIntegrationId={defaultAiIntegrationId}
          idPrefix="ai-model"
          emptyMessage="No chat models are available yet. Add one under Settings → Integrations."
          onToggleModel={toggleModel}
          onSetDefault={setDefaultAiIntegrationId}
        />
      )}
    </div>
  );
}

export type StepIntegrationsProps = Step2ImportsProps &
  Step3SourceControlProps &
  StepAiAgentsProps & {
    /** AI bindings are create-wizard only (edit uses project details later). */
    showAiAgents?: boolean;
  };

export function StepIntegrations({
  importFromJira,
  handleJiraCheckboxChange,
  jiraConnectionId,
  setJiraConnectionId,
  jiraProjectKey,
  setJiraProjectKey,
  enableGithub,
  setEnableGithub,
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
  githubToken,
  setGithubToken,
  setGithubConnectionId,
  aiBindingIds,
  setAiBindingIds,
  defaultAiIntegrationId,
  setDefaultAiIntegrationId,
  showAiAgents = true,
}: Readonly<StepIntegrationsProps>) {
  return (
    <div className="animate-in fade-in slide-in-from-left-2 space-y-8 duration-300">
      <ImportsSection
        importFromJira={importFromJira}
        handleJiraCheckboxChange={handleJiraCheckboxChange}
        jiraConnectionId={jiraConnectionId}
        setJiraConnectionId={setJiraConnectionId}
        jiraProjectKey={jiraProjectKey}
        setJiraProjectKey={setJiraProjectKey}
      />
      <SourceControlSection
        enableGithub={enableGithub}
        setEnableGithub={setEnableGithub}
        githubOwner={githubOwner}
        setGithubOwner={setGithubOwner}
        githubRepoName={githubRepoName}
        setGithubRepoName={setGithubRepoName}
        githubToken={githubToken}
        setGithubToken={setGithubToken}
        setGithubConnectionId={setGithubConnectionId}
      />
      {showAiAgents ? (
        <AiAgentsSection
          aiBindingIds={aiBindingIds}
          setAiBindingIds={setAiBindingIds}
          defaultAiIntegrationId={defaultAiIntegrationId}
          setDefaultAiIntegrationId={setDefaultAiIntegrationId}
        />
      ) : null}
    </div>
  );
}
