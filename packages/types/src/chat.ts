import { toNameCase } from './string.js';

/** App-facing chat message roles (Storage / UI). */
export const ChatRoles = {
  User: 'user',
  Assistant: 'assistant',
} as const;

export type ChatRole = (typeof ChatRoles)[keyof typeof ChatRoles];

/**
 * Internal ChatService turn roles used by the tool loop.
 * Provider strategies map these to their wire formats (Gemini `model`,
 * OpenAI `assistant`, etc.).
 */
export const ChatTurnRoles = {
  User: 'user',
  Model: 'model',
} as const;

export type ChatTurnRole = (typeof ChatTurnRoles)[keyof typeof ChatTurnRoles];

/**
 * Normalize an unknown role to a stored ChatRole.
 * Only exact `user` stays User; everything else (incl. turn `model`) → Assistant.
 */
export function parseChatRole(value: unknown): ChatRole {
  return value === ChatRoles.User || value === 'user'
    ? ChatRoles.User
    : ChatRoles.Assistant;
}

/** Map app / client roles onto ChatService turn roles. */
export function toChatTurnRole(value: unknown): ChatTurnRole {
  return value === ChatRoles.Assistant ||
    value === ChatTurnRoles.Model ||
    value === 'assistant'
    ? ChatTurnRoles.Model
    : ChatTurnRoles.User;
}

/** Display label for a stored chat role (`user` → `User`). */
export function getRoleName(role: ChatRole): string {
  return toNameCase(role);
}

export * from './api/v1/chat.js';
