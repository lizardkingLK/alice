/**
 * Member preferred chat agent id.
 * Cookie-backed (like chat history sidebar) so `/chat` SSR can seed
 * `initialAgentId` without a client catalog fetch. localStorage mirrors the
 * same id for same-tab updates / prefer-star subscriptions.
 */

export const PREFERRED_CHAT_AGENT_COOKIE_NAME = 'chat_preferred_agent_id';
export const PREFERRED_CHAT_AGENT_COOKIE_MAX_AGE = 60 * 60 * 24 * 365;
const PREFERRED_AGENT_ID_KEY = 'alice.chat.preferred-agent-id.v1';
const PREFERRED_AGENT_CHANGED_EVENT = 'alice-chat-preferred-agent-changed';

const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isBrowser(): boolean {
  return typeof window !== 'undefined';
}

export function isPreferredChatAgentId(
  value: string | null | undefined
): value is string {
  return typeof value === 'string' && UUID_RE.test(value.trim());
}

export function parsePreferredChatAgentCookie(
  value: string | undefined
): string | null {
  if (!isPreferredChatAgentId(value)) {
    return null;
  }
  return value.trim();
}

function writePreferredChatAgentCookie(agentId: string | null): void {
  if (typeof document === 'undefined') {
    return;
  }
  if (!agentId) {
    document.cookie = `${PREFERRED_CHAT_AGENT_COOKIE_NAME}=; path=/; max-age=0`;
    return;
  }
  document.cookie = `${PREFERRED_CHAT_AGENT_COOKIE_NAME}=${agentId}; path=/; max-age=${PREFERRED_CHAT_AGENT_COOKIE_MAX_AGE}`;
}

export function getPreferredChatAgentId(): string | null {
  if (!isBrowser()) {
    return null;
  }
  try {
    const raw = window.localStorage.getItem(PREFERRED_AGENT_ID_KEY);
    if (isPreferredChatAgentId(raw)) {
      return raw.trim();
    }
  } catch {
    // Fall through to cookie.
  }
  const match = document.cookie
    .split(';')
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${PREFERRED_CHAT_AGENT_COOKIE_NAME}=`));
  if (!match) {
    return null;
  }
  return parsePreferredChatAgentCookie(
    decodeURIComponent(match.slice(PREFERRED_CHAT_AGENT_COOKIE_NAME.length + 1))
  );
}

export function setPreferredChatAgentId(agentId: string | null): void {
  if (!isBrowser()) {
    return;
  }
  const next = isPreferredChatAgentId(agentId) ? agentId.trim() : null;
  try {
    if (!next) {
      window.localStorage.removeItem(PREFERRED_AGENT_ID_KEY);
    } else {
      window.localStorage.setItem(PREFERRED_AGENT_ID_KEY, next);
    }
  } catch {
    // Cookie still updated below.
  }
  writePreferredChatAgentCookie(next);
  window.dispatchEvent(new Event(PREFERRED_AGENT_CHANGED_EVENT));
}

/** Prefer this agent when Chat is opened without `?agentId=`. */
export function rememberPreferredChatAgent(agentId: string): void {
  setPreferredChatAgentId(agentId);
}

export function subscribePreferredChatAgent(
  onStoreChange: () => void
): () => void {
  if (!isBrowser()) {
    return () => undefined;
  }
  const onStorage = (event: StorageEvent) => {
    if (event.key === PREFERRED_AGENT_ID_KEY || event.key === null) {
      onStoreChange();
    }
  };
  window.addEventListener('storage', onStorage);
  window.addEventListener(PREFERRED_AGENT_CHANGED_EVENT, onStoreChange);
  return () => {
    window.removeEventListener('storage', onStorage);
    window.removeEventListener(PREFERRED_AGENT_CHANGED_EVENT, onStoreChange);
  };
}
