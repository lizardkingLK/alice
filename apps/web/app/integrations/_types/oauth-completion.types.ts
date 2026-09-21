import { utcNow } from '@repo/types';

/* eslint-disable no-unused-vars */
export enum IntegrationOAuthProvider {
  Jira = 'jira',
  GitHub = 'github',
}

export enum OAuthCompletionStatus {
  Connected = 'connected',
  Denied = 'denied',
  Error = 'error',
}

export enum OAuthMessageType {
  OAuthComplete = 'alice:oauth_complete',
}
/* eslint-enable no-unused-vars */

export interface OAuthCompletionMessage {
  type: OAuthMessageType.OAuthComplete;
  provider: IntegrationOAuthProvider;
  status: OAuthCompletionStatus;
  error?: string | null;
  timestamp: string;
}

const STATUS_LOOKUP: Record<string, OAuthCompletionStatus> = {
  connected: OAuthCompletionStatus.Connected,
  success: OAuthCompletionStatus.Connected,
  denied: OAuthCompletionStatus.Denied,
  cancelled: OAuthCompletionStatus.Denied,
  canceled: OAuthCompletionStatus.Denied,
  error: OAuthCompletionStatus.Error,
  failed: OAuthCompletionStatus.Error,
};

export function parseOAuthCompletionStatus(
  raw: string | null
): OAuthCompletionStatus {
  if (!raw) {
    return OAuthCompletionStatus.Connected;
  }
  return STATUS_LOOKUP[raw.toLowerCase()] ?? OAuthCompletionStatus.Error;
}

export const OAUTH_CHANNEL_NAME = 'alice_oauth_channel';
export const OAUTH_STORAGE_KEY = 'alice_oauth_event';

export function createOAuthCompletionMessage(
  provider: IntegrationOAuthProvider,
  status: OAuthCompletionStatus,
  error?: string | null
): OAuthCompletionMessage {
  return {
    type: OAuthMessageType.OAuthComplete,
    provider,
    status,
    error: error ?? null,
    timestamp: utcNow().toISOString(),
  };
}

export function notifyOAuthCompletion(message: OAuthCompletionMessage): void {
  if (typeof window === 'undefined') {
    return;
  }

  // 1. PostMessage to window.opener if accessible
  if (window.opener && !window.opener.closed) {
    try {
      window.opener.postMessage(message, window.location.origin);
    } catch {
      // Ignored for cross-origin or blocked opener
    }
  }

  // 2. BroadcastChannel for same-origin tabs and windows
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      const channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
      channel.postMessage(message);
      channel.close();
    } catch {
      // BroadcastChannel unavailable
    }
  }

  // 3. localStorage event fallback
  try {
    localStorage.setItem(
      OAUTH_STORAGE_KEY,
      JSON.stringify({
        ...message,
        nonce:
          typeof crypto !== 'undefined' && crypto.randomUUID
            ? crypto.randomUUID()
            : utcNow().getTime().toString(36),
      })
    );
  } catch {
    // LocalStorage unavailable or blocked
  }
}

export function subscribeToOAuthCompletion(
  expectedProvider: IntegrationOAuthProvider,
  // eslint-disable-next-line no-unused-vars
  onComplete: (status: OAuthCompletionStatus, error?: string | null) => void
): () => void {
  if (typeof window === 'undefined') {
    return () => {};
  }

  const handleMessage = (event: MessageEvent) => {
    if (event.origin !== window.location.origin) {
      return;
    }
    const data = event.data;
    if (
      data &&
      data.type === OAuthMessageType.OAuthComplete &&
      data.provider === expectedProvider
    ) {
      onComplete(data.status, data.error);
    }
  };

  window.addEventListener('message', handleMessage);

  let channel: BroadcastChannel | null = null;
  if (typeof BroadcastChannel !== 'undefined') {
    try {
      channel = new BroadcastChannel(OAUTH_CHANNEL_NAME);
      channel.onmessage = (event) => {
        const data = event.data;
        if (
          data &&
          data.type === OAuthMessageType.OAuthComplete &&
          data.provider === expectedProvider
        ) {
          onComplete(data.status, data.error);
        }
      };
    } catch {
      channel = null;
    }
  }

  const handleStorage = (event: StorageEvent) => {
    if (event.key !== OAUTH_STORAGE_KEY || !event.newValue) {
      return;
    }
    try {
      const data = JSON.parse(event.newValue);
      if (
        data &&
        data.type === OAuthMessageType.OAuthComplete &&
        data.provider === expectedProvider
      ) {
        onComplete(data.status, data.error);
      }
    } catch {
      // Ignore JSON parse error
    }
  };

  window.addEventListener('storage', handleStorage);

  return () => {
    window.removeEventListener('message', handleMessage);
    window.removeEventListener('storage', handleStorage);
    if (channel) {
      channel.close();
    }
  };
}
