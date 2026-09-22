'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import {
  subscribeToOAuthCompletion,
  IntegrationOAuthProvider,
  OAuthCompletionStatus,
} from '@/app/integrations/_types/oauth-completion.types';

export type UseOAuthPopupManagerOptions = {
  provider: IntegrationOAuthProvider;
  providerName: string;
  windowName: string;
  startOAuth: () => Promise<string>;
  onRefresh: () => void;
  loadError?: string | null;
  // eslint-disable-next-line no-unused-vars
  setLoadError?: (error: string | null) => void;
};

export type UseOAuthPopupManagerResult = {
  isConnecting: boolean;
  // eslint-disable-next-line no-unused-vars
  setIsConnecting: (connecting: boolean) => void;
  loadError: string | null;
  // eslint-disable-next-line no-unused-vars
  setLoadError: (error: string | null) => void;
  clearError: () => void;
  handleConnect: () => void;
};

export function useOAuthPopupManager({
  provider,
  providerName,
  windowName,
  startOAuth,
  onRefresh,
  loadError: externalLoadError,
  setLoadError: externalSetLoadError,
}: Readonly<UseOAuthPopupManagerOptions>): UseOAuthPopupManagerResult {
  const [isConnecting, setIsConnecting] = useState(false);
  const [internalLoadError, setInternalLoadError] = useState<string | null>(
    null
  );
  const oauthWindowRef = useRef<Window | null>(null);

  const loadError = externalLoadError ?? internalLoadError;
  const setLoadError = externalSetLoadError ?? setInternalLoadError;

  // Direct notification from the OAuth completion window/tab
  useEffect(() => {
    return subscribeToOAuthCompletion(provider, (status, error) => {
      setIsConnecting(false);
      if (status === OAuthCompletionStatus.Connected) {
        onRefresh();
        setLoadError(null);
        return;
      }
      if (status === OAuthCompletionStatus.Denied) {
        setLoadError(`${providerName} authorization was cancelled.`);
        return;
      }
      setLoadError(error || `Failed to connect ${providerName}.`);
    });
  }, [provider, providerName, onRefresh, setLoadError]);

  // After OAuth in another tab, reload connections when the user returns here.
  useEffect(() => {
    const onVisibleOrFocus = () => {
      if (document.visibilityState === 'hidden') {
        return;
      }
      onRefresh();
      setIsConnecting(false);
    };

    window.addEventListener('focus', onVisibleOrFocus);
    document.addEventListener('visibilitychange', onVisibleOrFocus);
    return () => {
      window.removeEventListener('focus', onVisibleOrFocus);
      document.removeEventListener('visibilitychange', onVisibleOrFocus);
    };
  }, [onRefresh]);

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
        onRefresh();
        window.clearInterval(timer);
      }
    }, 800);

    return () => {
      window.clearInterval(timer);
    };
  }, [isConnecting, onRefresh]);

  const handleConnect = useCallback(() => {
    setIsConnecting(true);
    setLoadError(null);

    const popup = window.open('about:blank', windowName);
    oauthWindowRef.current = popup;

    if (!popup) {
      setIsConnecting(false);
      setLoadError(
        `Could not open a new tab for ${providerName}. Allow popups for this site, then try again.`
      );
      return;
    }

    startOAuth()
      .then((url) => {
        popup.location.href = url;
      })
      .catch((err: unknown) => {
        popup.close();
        oauthWindowRef.current = null;
        setIsConnecting(false);
        setLoadError(
          err instanceof Error
            ? err.message
            : `Failed to start ${providerName} OAuth`
        );
      });
  }, [windowName, providerName, startOAuth, setLoadError]);

  const clearError = useCallback(() => {
    setLoadError(null);
  }, [setLoadError]);

  return {
    isConnecting,
    setIsConnecting,
    loadError,
    setLoadError,
    clearError,
    handleConnect,
  };
}
