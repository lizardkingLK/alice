'use client';

import { useGithubRepoUrl } from '../_hooks/use-github-repo-url';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Badge } from '@repo/ui/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from '@repo/ui/components/ui/avatar';
import {
  CheckCircle2,
  Loader2,
  Plug,
  RefreshCw,
  Unplug,
} from '@repo/ui/lib/icons';
import type {
  GithubConnectionDto,
  GithubRepoOption,
} from '@/app/projects/_services/projects.github.mutations.client';
import { parseGithubRepoPath } from '@/lib/projects/github-repo-path';

type GithubUnlinkedCardProps = {
  emptyHint: string;
  isConnecting: boolean;
  onConnect: () => void;
  showConnectChrome: boolean;
  canManage?: boolean;
};

function GithubUnlinkedCard({
  emptyHint,
  isConnecting,
  onConnect,
  showConnectChrome,
  canManage = true,
}: Readonly<GithubUnlinkedCardProps>) {
  return (
    <div className="border-border/60 bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <span className="h-2 w-2 rounded-full bg-amber-500" />
          <span className="text-muted-foreground text-xs font-medium">
            Status: Not connected
          </span>
        </div>
        {showConnectChrome && canManage ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onConnect}
            disabled={isConnecting}
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
        ) : null}
      </div>
      <p className="text-muted-foreground text-xs">{emptyHint}</p>
    </div>
  );
}

type GithubLinkedCardProps = {
  activeConnection: GithubConnectionDto;
  isConnecting: boolean;
  onConnect: () => void;
  // eslint-disable-next-line no-unused-vars
  onDisconnect?: (connectionId: string) => void;
  isDisconnecting: boolean;
  showConnectChrome: boolean;
  canManage?: boolean;
};

function GithubLinkedCard({
  activeConnection,
  isConnecting,
  onConnect,
  onDisconnect,
  isDisconnecting,
  showConnectChrome,
  canManage = true,
}: Readonly<GithubLinkedCardProps>) {
  const accountLabel = activeConnection.account_login
    ? `@${activeConnection.account_login}`
    : activeConnection.name;

  const fallbackLetters = (
    activeConnection.account_login ||
    activeConnection.name ||
    'GH'
  )
    .slice(0, 2)
    .toUpperCase();

  const isRestrictedAdminOwned =
    activeConnection.is_admin_owned && !activeConnection.can_manage;
  const isManageable = canManage && !isRestrictedAdminOwned;

  return (
    <div className="border-border/60 bg-muted/20 space-y-3 rounded-lg border p-3">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <Avatar size="sm" className="h-8 w-8 border">
            {activeConnection.account_avatar_url ? (
              <AvatarImage
                src={activeConnection.account_avatar_url}
                alt={activeConnection.account_login || activeConnection.name}
              />
            ) : null}
            <AvatarFallback>{fallbackLetters}</AvatarFallback>
          </Avatar>
          <div className="min-w-0 leading-tight">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold">
                {accountLabel}
              </span>
              <Badge
                variant="outline"
                className="h-4 border-emerald-500/30 bg-emerald-500/10 px-1.5 text-[10px] font-medium text-emerald-600"
              >
                <CheckCircle2 className="mr-1 h-2.5 w-2.5" />
                Connected
              </Badge>
            </div>
            <p className="text-muted-foreground truncate text-[11px]">
              {activeConnection.name}
            </p>
          </div>
        </div>

        {showConnectChrome && isManageable ? (
          <div className="flex items-center gap-2">
            {onDisconnect ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => onDisconnect(activeConnection.id)}
                disabled={isDisconnecting}
                className="text-destructive hover:text-destructive h-8 px-2 text-xs"
              >
                {isDisconnecting ? (
                  <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Unplug className="mr-1 h-3.5 w-3.5" />
                )}
                Disconnect
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={onConnect}
              disabled={isConnecting}
              className="h-8 px-2 text-xs"
              title="Switch account or reconnect"
            >
              {isConnecting ? (
                <Loader2 className="mr-1 h-3.5 w-3.5 animate-spin" />
              ) : (
                <RefreshCw className="mr-1 h-3.5 w-3.5" />
              )}
              Switch Account
            </Button>
          </div>
        ) : null}
      </div>

      {isRestrictedAdminOwned ? (
        <div className="rounded border border-amber-500/20 bg-amber-500/10 p-2.5 text-xs text-amber-700 dark:text-amber-300">
          This GitHub connection was established by an administrator (@{activeConnection.account_login}). Only that administrator can modify or disconnect this connection.
        </div>
      ) : null}
    </div>
  );
}

type GithubConnectionStatusCardProps = {
  isLoading: boolean;
  activeConnection: GithubConnectionDto | null;
  hasConnections: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  // eslint-disable-next-line no-unused-vars
  onDisconnect?: (connectionId: string) => void;
  isDisconnecting: boolean;
  showConnectChrome: boolean;
  emptyHint: string;
  canManage?: boolean;
};

function GithubConnectionStatusCard({
  isLoading,
  activeConnection,
  hasConnections,
  isConnecting,
  onConnect,
  onDisconnect,
  isDisconnecting,
  showConnectChrome,
  emptyHint,
  canManage = true,
}: Readonly<GithubConnectionStatusCardProps>) {
  if (isLoading) {
    return (
      <div className="border-border/60 bg-muted/20 text-muted-foreground flex items-center gap-2 rounded-lg border p-3 text-xs">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        Checking GitHub connection status...
      </div>
    );
  }

  if (!hasConnections || !activeConnection) {
    return (
      <GithubUnlinkedCard
        emptyHint={emptyHint}
        isConnecting={isConnecting}
        onConnect={onConnect}
        showConnectChrome={showConnectChrome}
        canManage={canManage}
      />
    );
  }

  return (
    <GithubLinkedCard
      activeConnection={activeConnection}
      isConnecting={isConnecting}
      onConnect={onConnect}
      onDisconnect={onDisconnect}
      isDisconnecting={isDisconnecting}
      showConnectChrome={showConnectChrome}
      canManage={canManage}
    />
  );
}

type GithubRepositoryPickerProps = {
  repositories: GithubRepoOption[];
  selectedRepoFullName: string;
  isLoading: boolean;
  canManage?: boolean;
  // eslint-disable-next-line no-unused-vars
  onSelectRepo: (fullName: string) => void;
};

function GithubRepositoryPicker({
  repositories,
  selectedRepoFullName,
  isLoading,
  canManage = true,
  onSelectRepo,
}: Readonly<GithubRepositoryPickerProps>) {
  if (repositories.length === 0) {
    return null;
  }

  const placeholder = isLoading
    ? 'Loading repositories...'
    : 'Choose a repository from your account...';

  return (
    <div className="space-y-2">
      <Label htmlFor="githubRepoSelect" className="text-xs font-semibold">
        Select Repository
      </Label>
      <Select
        value={selectedRepoFullName || undefined}
        onValueChange={onSelectRepo}
        disabled={isLoading || !canManage}
      >
        <SelectTrigger
          id="githubRepoSelect"
          className="bg-background/50 h-9 text-sm"
        >
          <SelectValue placeholder={placeholder} />
        </SelectTrigger>
        <SelectContent>
          {repositories.map((repo) => (
            <SelectItem key={repo.id} value={repo.full_name}>
              {repo.full_name} {repo.private ? '(private)' : ''}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export type GithubConnectionFieldsProps = {
  connections: GithubConnectionDto[];
  activeConnection: GithubConnectionDto | null;
  repositories: GithubRepoOption[];
  isLoadingConnections: boolean;
  isLoadingRepositories: boolean;
  isConnecting: boolean;
  onConnect: () => void;
  githubOwner: string;
  // eslint-disable-next-line no-unused-vars
  setGithubOwner: (owner: string) => void;
  githubRepoName: string;
  // eslint-disable-next-line no-unused-vars
  setGithubRepoName: (repoName: string) => void;
  // eslint-disable-next-line no-unused-vars
  onDisconnect?: (connectionId: string) => void;
  isDisconnecting?: boolean;
  emptyHint?: string;
  footerHint?: string;
  showConnectChrome?: boolean;
  canManage?: boolean;
};

export function GithubConnectionFields({
  connections,
  activeConnection,
  repositories,
  isLoadingConnections,
  isLoadingRepositories,
  isConnecting,
  onConnect,
  githubOwner,
  setGithubOwner,
  githubRepoName,
  setGithubRepoName,
  onDisconnect,
  isDisconnecting = false,
  emptyHint = 'Authorize GitHub once to link repositories, pull requests, and commit activity.',
  footerHint,
  showConnectChrome = true,
  canManage = true,
}: Readonly<GithubConnectionFieldsProps>) {
  const isRestrictedAdminOwned = Boolean(
    activeConnection?.is_admin_owned && !activeConnection?.can_manage
  );
  const isEffectivelyManageable = canManage && !isRestrictedAdminOwned;

  const { githubUrl, handleUrlChange } = useGithubRepoUrl({
    githubOwner,
    setGithubOwner,
    githubRepoName,
    setGithubRepoName,
  });

  const handleSelectRepo = (selectedFullName: string) => {
    const repo = repositories.find((r) => r.full_name === selectedFullName);
    if (repo) {
      setGithubOwner(repo.owner.login);
      setGithubRepoName(repo.name);
      return;
    }
    const { owner, repoName } = parseGithubRepoPath(selectedFullName);
    setGithubOwner(owner);
    setGithubRepoName(repoName);
  };

  const selectedRepoFullName =
    githubOwner && githubRepoName ? `${githubOwner}/${githubRepoName}` : '';
  const hasDropdownOption = connections.length > 0 && repositories.length > 0;

  return (
    <div className="space-y-4">
      {/* OAuth Connection Status & Identity Card */}
      <GithubConnectionStatusCard
        isLoading={isLoadingConnections}
        activeConnection={activeConnection}
        hasConnections={connections.length > 0}
        isConnecting={isConnecting}
        onConnect={onConnect}
        onDisconnect={onDisconnect}
        isDisconnecting={isDisconnecting}
        showConnectChrome={showConnectChrome}
        emptyHint={emptyHint}
        canManage={isEffectivelyManageable}
      />

      {/* Repository Picker (dropdown when repositories available) */}
      {connections.length > 0 ? (
        <GithubRepositoryPicker
          repositories={repositories}
          selectedRepoFullName={selectedRepoFullName}
          isLoading={isLoadingRepositories}
          canManage={isEffectivelyManageable}
          onSelectRepo={handleSelectRepo}
        />
      ) : null}

      {/* GitHub Repository URL input (manual URL entry & fallback) */}
      <div className="space-y-2">
        <Label htmlFor="githubUrl" className="text-xs font-semibold">
          GitHub Repository URL
        </Label>
        <Input
          id="githubUrl"
          value={githubUrl}
          onChange={(e) => handleUrlChange(e.target.value)}
          placeholder="e.g. https://github.com/facebook/react"
          disabled={!isEffectivelyManageable}
          className="bg-background/50 h-9 text-sm"
        />
        <p className="text-muted-foreground text-[11px]">
          Enter or paste a GitHub repository URL (e.g.
          https://github.com/owner/repository)
          {hasDropdownOption ? ' or choose from the dropdown above' : ''}.
        </p>
      </div>

      {footerHint ? (
        <p className="text-muted-foreground text-xs">{footerHint}</p>
      ) : null}
    </div>
  );
}
