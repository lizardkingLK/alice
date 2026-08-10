import { toNameCase } from './string.js';

/** App-facing chat message roles (Storage / UI). Not Gemini wire roles. */
export const ChatRoles = {
  User: 'user',
  Assistant: 'assistant',
} as const;

export type ChatRole = (typeof ChatRoles)[keyof typeof ChatRoles];

/** Gemini generateContent turn roles. */
export const GeminiRoles = {
  User: 'user',
  Model: 'model',
} as const;

export type GeminiRole = (typeof GeminiRoles)[keyof typeof GeminiRoles];

/**
 * Normalize an unknown role to a stored ChatRole.
 * Only exact `user` stays User; everything else (incl. Gemini `model`) → Assistant.
 */
export function parseChatRole(value: unknown): ChatRole {
  return value === ChatRoles.User || value === 'user'
    ? ChatRoles.User
    : ChatRoles.Assistant;
}

/** Map app / client roles onto Gemini wire roles. */
export function toGeminiRole(value: unknown): GeminiRole {
  return value === ChatRoles.Assistant ||
    value === GeminiRoles.Model ||
    value === 'assistant'
    ? GeminiRoles.Model
    : GeminiRoles.User;
}

/** Display label for a stored chat role (`user` → `User`). */
export function getRoleName(role: ChatRole): string {
  return toNameCase(role);
}
