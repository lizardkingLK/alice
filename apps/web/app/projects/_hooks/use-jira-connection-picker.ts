'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  listJiraConnectionProjects,
  listJiraConnections,
  startJiraOAuth,
  type JiraCloudProject,
  type JiraConnection,
} from '../_services/jira.service';

const OAUTH_WINDOW_NAME = 'alice-jira-oauth';

export type UseJiraConnectionPickerResult = {
  connections: JiraConnection[];
  jiraProjects: JiraCloudProject[];
  isLoadingConnections: boolean;
  isLoadingProjects: boolean;
  isConnecting: boolean;
  loadError: string | null;
  clearError: () => void;
  // eslint-disable-next-line no-unused-vars
  setLoadError: (message: string | null) => void;
  refreshConnections: () => void;
  handleConnectJira: () => void;
};

/**
 * Shared load/connect state for Jira OAuth connection + project pickers
 * (create wizard Imports step and project details Integrations card).
 *
 * Connect opens Atlassian consent in a **new tab/window** so modal create
 * dialogs stay open; connections refresh when this window regains focus.
 */
export function useJiraConnectionPicker(
  jiraConnectionId: string
): UseJiraConnectionPickerResult {
  const [connections, setConnections] = useState<JiraConnection[]>([]);
  const [jiraProjects, setJiraProjects] = useState<JiraCloudProject[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const oauthWindowRef = useRef<Window | null>(null);

  const refreshConnections = useCallback(() => {
    setIsLoadingConnections(true);
    listJiraConnections()
      .then((rows) => {
        setConnections(rows.filter((row) => row.status === 'active'));
      })
      .catch((err: unknown) => {
        setLoadError(
          err instanceof Error ? err.message : 'Failed to load Jira connections'
        );
      })
      .finally(() => {
        setIsLoadingConnections(false);
      });
  }, []);

  useEffect(() => {
    refreshConnections();
  }, [refreshConnections]);

  // After OAuth in another tab, reload connections when the user returns here.
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

  // Clear "connecting" when the OAuth tab is closed.
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

  useEffect(() => {
    if (!jiraConnectionId) {
      setJiraProjects([]);
      return;
    }

    let cancelled = false;
    setIsLoadingProjects(true);

    listJiraConnectionProjects(jiraConnectionId)
      .then((projects) => {
        if (!cancelled) {
          setJiraProjects(projects);
        }
      })
      .catch((err: unknown) => {
        if (!cancelled) {
          setJiraProjects([]);
          setLoadError(
            err instanceof Error
              ? err.message
              : 'Failed to load Jira projects for this site'
          );
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoadingProjects(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [jiraConnectionId]);

  const handleConnectJira = () => {
    setIsConnecting(true);
    setLoadError(null);

    // Open synchronously on the click gesture so popup blockers stay quiet,
    // then navigate once the authorize URL is ready.
    const popup = window.open('about:blank', OAUTH_WINDOW_NAME);
    oauthWindowRef.current = popup;

    if (!popup) {
      setIsConnecting(false);
      setLoadError(
        'Could not open a new tab for Jira. Allow popups for this site, then try again.'
      );
      return;
    }

    startJiraOAuth()
      .then((url) => {
        popup.location.href = url;
      })
      .catch((err: unknown) => {
        popup.close();
        oauthWindowRef.current = null;
        setIsConnecting(false);
        setLoadError(
          err instanceof Error ? err.message : 'Failed to start Jira OAuth'
        );
      });
  };

  return {
    connections,
    jiraProjects,
    isLoadingConnections,
    isLoadingProjects,
    isConnecting,
    loadError,
    clearError: () => setLoadError(null),
    setLoadError,
    refreshConnections,
    handleConnectJira,
  };
}
