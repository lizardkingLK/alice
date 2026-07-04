/** Client-safe helpers for optional public env (no build-time throw). */

function readPublicEnv(key: string): string | undefined {
  const raw = process.env[key];
  if (!raw) {
    return undefined;
  }

  const trimmed = raw.trim();
  if (trimmed.length === 0 || /^YOUR_|^your-/i.test(trimmed)) {
    return undefined;
  }

  return trimmed;
}

export function hasNovuConfig(): boolean {
  return Boolean(
    readPublicEnv('NEXT_PUBLIC_NOVU_APP_ID') &&
    readPublicEnv('NEXT_PUBLIC_NOVU_SUBSCRIBER_ID')
  );
}

export function getNovuAppId(): string | undefined {
  return readPublicEnv('NEXT_PUBLIC_NOVU_APP_ID');
}

export function getNovuSubscriberId(): string | undefined {
  return readPublicEnv('NEXT_PUBLIC_NOVU_SUBSCRIBER_ID');
}
