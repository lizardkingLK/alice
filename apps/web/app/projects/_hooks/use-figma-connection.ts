'use client';

import { useCallback, useEffect, useState } from 'react';
import { IntegrationOAuthProvider } from '@/app/integrations/_types/oauth-completion.types';
import {
  disconnectFigma,
  getFigmaConnection,
  startFigmaOAuth,
  verifyFigmaDesign,
  type FigmaConnectionStatusDto,
} from '@/app/projects/_services/projects.figma.mutations.client';
import { errorMessage } from '@/lib/errors/error-message';
import { useOAuthPopupManager } from './use-oauth-popup-manager';

const OAUTH_WINDOW_NAME = 'alice-figma-oauth';

export function useFigmaConnection(projectId: string) {
  const [connection, setConnection] = useState<FigmaConnectionStatusDto | null>(
    null
  );
  const [isLoading, setIsLoading] = useState(true);
  const [isVerifying, setIsVerifying] = useState(false);
  const [isDisconnecting, setIsDisconnecting] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = useCallback(() => {
    setIsLoading(true);
    getFigmaConnection(projectId)
      .then((value) => {
        setConnection(value);
        setLoadError(null);
      })
      .catch((error: unknown) => {
        setLoadError(errorMessage(error, 'Failed to load Figma connection'));
      })
      .finally(() => setIsLoading(false));
  }, [projectId]);

  useEffect(() => refresh(), [refresh]);

  const beginOAuth = useCallback(() => startFigmaOAuth(projectId), [projectId]);
  const { isConnecting, handleConnect } = useOAuthPopupManager({
    provider: IntegrationOAuthProvider.Figma,
    providerName: 'Figma',
    windowName: OAUTH_WINDOW_NAME,
    startOAuth: beginOAuth,
    onRefresh: refresh,
    loadError,
    setLoadError,
  });

  const verify = useCallback(async (): Promise<boolean> => {
    setIsVerifying(true);
    setLoadError(null);
    try {
      const value = await verifyFigmaDesign(projectId);
      setConnection(value);
      if (!value.design_access_verified && value.verification_error) {
        setLoadError(value.verification_error);
      }
      return value.design_access_verified;
    } catch (error) {
      setLoadError(errorMessage(error, 'Failed to verify Figma design access'));
      return false;
    } finally {
      setIsVerifying(false);
    }
  }, [projectId]);

  const disconnect = useCallback(async (): Promise<void> => {
    setIsDisconnecting(true);
    setLoadError(null);
    try {
      await disconnectFigma(projectId);
      refresh();
    } catch (error) {
      setLoadError(errorMessage(error, 'Failed to disconnect Figma'));
    } finally {
      setIsDisconnecting(false);
    }
  }, [projectId, refresh]);

  return {
    connection,
    isLoading,
    isConnecting,
    isVerifying,
    isDisconnecting,
    loadError,
    clearError: () => setLoadError(null),
    refresh,
    verify,
    disconnect,
    handleConnect,
  };
}
