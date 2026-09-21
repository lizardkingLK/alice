'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listGithubConnections,
  listGithubRepositories,
  startGithubOAuth,
  type GithubConnectionDto,
  type GithubRepoOption,
} from '@/app/projects/_services/projects.github.mutations.client';
import {
  subscribeToOAuthCompletion,
  IntegrationOAuthProvider,
  OAuthCompletionStatus,
} from '@/app/integrations/_types/oauth-completion.types';

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
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const oauthWindowRef = useRef<Window | null>(null);

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

  // Direct notification from the OAuth completion window/tab
  useEffect(() => {
    return subscribeToOAuthCompletion(
      IntegrationOAuthProvider.GitHub,
      (status, error) => {
        setIsConnecting(false);
        if (status === OAuthCompletionStatus.Connected) {
          refreshConnections();
          setLoadError(null);
          return;
        }
        if (status === OAuthCompletionStatus.Denied) {
          setLoadError('GitHub authorization was cancelled.');
          return;
        }
        setLoadError(error || 'Failed to connect GitHub.');
      }
    );
  }, [refreshConnections]);

  // After OAuth in another tab, reload connections when user returns here.
  useEffect(() => {
    const onVisibleOrFocus = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      refreshConnections();
      setIsConnecting(false);
    };

    window.addEventListener('focus', onVisibleOrFocus);
    document.addEventListener('visibilitychange', onVisibleOrFocus);
    return () => {
      window.removeEventListener('focus', onVisibleOrFocus);
      document.removeEventListener('visibilitychange', onVisibleOrFocus);
    };
  }, [refreshConnections]);

  // Clear "connecting" when OAuth tab is closed.
  useEffect(() => {
    if (!isConnecting) {
      return;
    }

    const timer = window.setInterval(() => {
      const popup = oauthWindowRef.current;
      if (!popup || popup.closed) {
        oauthWindowRef.current = null;
        setIsConnecting(false);
        refreshConnections();
        window.clearInterval(timer);
      }
    }, 800);

    return () => {
      window.clearInterval(timer);
    };
  }, [isConnecting, refreshConnections]);

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

  const handleConnectGithub = () => {
    setIsConnecting(true);
    setLoadError(null);

    // Open synchronously on click gesture so popup blockers stay quiet,
    // then navigate once authorize URL is ready.
    const popup = window.open('about:blank', OAUTH_WINDOW_NAME);
    oauthWindowRef.current = popup;

    if (!popup) {
      setIsConnecting(false);
      setLoadError(
        'Could not open a new tab for GitHub. Allow popups for this site, then try again.'
      );
      return;
    }

    startGithubOAuth()
      .then((url) => {
        popup.location.href = url;
      })
      .catch((err: unknown) => {
        popup.close();
        oauthWindowRef.current = null;
        setIsConnecting(false);
        setLoadError(
          err instanceof Error ? err.message : 'Failed to start GitHub OAuth'
        );
      });
  };

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
