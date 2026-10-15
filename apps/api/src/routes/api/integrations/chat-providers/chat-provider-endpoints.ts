const INVALID_ENDPOINT_MESSAGE =
  'Invalid integration configuration. The chat provider endpoint is not approved.';

type SupportedChatProvider = 'gemini' | 'spacexai' | 'openai' | 'anthropic';

const PROVIDER_HOSTS: Readonly<Record<SupportedChatProvider, string>> = {
  gemini: 'generativelanguage.googleapis.com',
  spacexai: 'api.x.ai',
  openai: 'api.openai.com',
  anthropic: 'api.anthropic.com',
};

function isSupportedChatProvider(
  provider: string
): provider is SupportedChatProvider {
  return provider in PROVIDER_HOSTS;
}

function defaultChatProviderApiUrl(
  provider: SupportedChatProvider,
  model: string
): string {
  switch (provider) {
    case 'gemini':
      return `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`;
    case 'spacexai':
      return 'https://api.x.ai/v1/chat/completions';
    case 'openai':
      return 'https://api.openai.com/v1/chat/completions';
    case 'anthropic':
      return 'https://api.anthropic.com/v1/messages';
  }
}

function hasSafeUrlEnvelope(url: URL, provider: SupportedChatProvider) {
  return (
    url.protocol === 'https:' &&
    url.hostname === PROVIDER_HOSTS[provider] &&
    url.port === '' &&
    url.username === '' &&
    url.password === '' &&
    url.hash === ''
  );
}

function hasApprovedGeminiQuery(url: URL): boolean {
  if (url.search === '') {
    return true;
  }

  const entries = [...url.searchParams.entries()];
  return (
    entries.length === 1 && entries[0]?.[0] === 'key' && entries[0][1] === ''
  );
}

function hasApprovedPath(url: URL, provider: SupportedChatProvider): boolean {
  switch (provider) {
    case 'gemini':
      return (
        /^\/v1(?:beta)?\/models\/[^/]+:generateContent$/.test(url.pathname) &&
        hasApprovedGeminiQuery(url)
      );
    case 'spacexai':
    case 'openai':
      return url.pathname === '/v1/chat/completions' && url.search === '';
    case 'anthropic':
      return url.pathname === '/v1/messages' && url.search === '';
  }
}

/**
 * Resolve a chat API URL while keeping provider credentials on official hosts.
 * Redirects are separately disabled by provider fetch implementations.
 */
export function resolveApprovedChatProviderApiUrl(params: {
  readonly provider: string;
  readonly model: string;
  readonly configuredApiUrl?: string;
}): string {
  if (!isSupportedChatProvider(params.provider)) {
    throw new Error(
      'Invalid integration configuration. The chat provider is not supported.'
    );
  }

  const candidate =
    params.configuredApiUrl?.trim() ||
    defaultChatProviderApiUrl(params.provider, params.model);

  let url: URL;
  try {
    url = new URL(candidate);
  } catch {
    throw new Error(INVALID_ENDPOINT_MESSAGE);
  }

  if (
    !hasSafeUrlEnvelope(url, params.provider) ||
    !hasApprovedPath(url, params.provider)
  ) {
    throw new Error(INVALID_ENDPOINT_MESSAGE);
  }

  return url.toString();
}
