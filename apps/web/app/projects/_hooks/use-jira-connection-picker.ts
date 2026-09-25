'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  listJiraConnectionProjects,
  listJiraConnections,
  startJiraOAuth,
  type JiraCloudProject,
  type JiraConnection,
} from '@/app/projects/_services/projects.jira.mutations.client';
import { IntegrationOAuthProvider } from '@/app/integrations/_types/oauth-completion.types';
import { useOAuthPopupManager } from './use-oauth-popup-manager';

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
 * dialogs stay open; connections refresh when OAuth completes (or when this
 * window regains focus while connecting).
 */
export function useJiraConnectionPicker(
  jiraConnectionId: string
): UseJiraConnectionPickerResult {
  const [connections, setConnections] = useState<JiraConnection[]>([]);
  const [jiraProjects, setJiraProjects] = useState<JiraCloudProject[]>([]);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isLoadingProjects, setIsLoadingProjects] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

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

  const { isConnecting, handleConnect: handleConnectJira } =
    useOAuthPopupManager({
      provider: IntegrationOAuthProvider.Jira,
      providerName: 'Jira',
      windowName: OAUTH_WINDOW_NAME,
      startOAuth: startJiraOAuth,
      onRefresh: refreshConnections,
      loadError,
      setLoadError,
    });

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
