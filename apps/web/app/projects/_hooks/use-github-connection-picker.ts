'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listGithubConnections,
  listGithubRepositories,
  startGithubOAuth,
  type GithubConnectionDto,
  type GithubRepoOption,
} from '@/app/projects/_services/projects.github.mutations.client';
import { IntegrationOAuthProvider } from '@/app/integrations/_types/oauth-completion.types';
import { useOAuthPopupManager } from './use-oauth-popup-manager';

const OAUTH_WINDOW_NAME = 'alice-github-oauth';

export type UseGithubConnectionPickerResult = {
  connections: GithubConnectionDto[];
  activeConnection: GithubConnectionDto | null;
  repositories: GithubRepoOption[];
  isLoadingConnections: boolean;
  isLoadingRepositories: boolean;
  isConnecting: boolean;
  loadError: string | null;
  clearError: () => void;
  // eslint-disable-next-line no-unused-vars
  setLoadError: (message: string | null) => void;
  refreshConnections: () => void;
  handleConnectGithub: () => void;
};

/**
 * Shared load/connect state for GitHub OAuth connection + repository pickers
 * (create wizard Source Control step and project details Integrations card).
 *
 * Connect opens GitHub consent in a **new tab/window** so modal create
 * dialogs stay open; connections refresh when this window regains focus.
 */
export function useGithubConnectionPicker(
  selectedConnectionId?: string
): UseGithubConnectionPickerResult {
  const [connections, setConnections] = useState<GithubConnectionDto[]>([]);
  const [repositories, setRepositories] = useState<GithubRepoOption[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isLoadingRepositories, setIsLoadingRepositories] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshConnections = useCallback(() => {
    setIsLoadingConnections(true);
    listGithubConnections()
      .then((rows) => {
        setConnections(rows.filter((row) => row.status === 'active'));
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof Error
            ? err.message
            : 'Failed to load GitHub connections'
        );
      })
      .finally(() => {
        setIsLoadingConnections(false);
      });
  }, []);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  const { isConnecting, handleConnect: handleConnectGithub } =
    useOAuthPopupManager({
      provider: IntegrationOAuthProvider.GitHub,
      providerName: 'GitHub',
      windowName: OAUTH_WINDOW_NAME,
      startOAuth: startGithubOAuth,
      onRefresh: refreshConnections,
      loadError,
      setLoadError,
    });

  const activeConnection =
    (selectedConnectionId
      ? connections.find((c) => c.id === selectedConnectionId)
      : null) ??
    connections[0] ??
    null;

  useEffect(() => {
    if (!activeConnection) {
      setRepositories([]);
      return;
    }

    let cancelled = false;
    setIsLoadingRepositories(true);

    listGithubRepositories(activeConnection.id)
      .then((repos) => {
        if (!cancelled) {
          setRepositories(repos);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setRepositories([]);
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Failed to load GitHub repositories'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingRepositories(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeConnection]);

  return {
    connections,
    activeConnection,
    repositories,
    isLoadingConnections,
    isLoadingRepositories,
    isConnecting,
    loadError,
    clearError: () => setLoadError(null),
    setLoadError,
    refreshConnections,
    handleConnectGithub,
  };
}
