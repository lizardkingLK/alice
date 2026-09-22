import { z } from 'zod';
import {
  accessAllowlistEmailValueSchema,
  normalizeAllowlistProjectKeys,
  parseAllowlistProjectKeys,
} from './access-allowlist.js';

/** Max contact submissions per email within {@link ACCESS_REQUEST_ROLLING_WINDOW_DAYS}. */
export const ACCESS_REQUEST_MAX_SUBMISSIONS = 3;

/** Rolling window for submission count (days). */
export const ACCESS_REQUEST_ROLLING_WINDOW_DAYS = 30;

/** Resubmitting inside this window updates message without incrementing count. */
export const ACCESS_REQUEST_IDEMPOTENCY_MS = 60 * 60 * 1000;

export const ACCESS_REQUEST_LIMIT_MESSAGE =
  'You have reached the access request limit. Try again later or contact an admin directly.';

export const ACCESS_REQUEST_ALREADY_GRANTED_MESSAGE =
  'Your email already has workspace access. Ask an admin if you need additional projects.';

export const ACCESS_REQUEST_TITLE = 'Access request';

/** Max project keys accepted on one access request submission. */
export const ACCESS_REQUEST_MAX_PROJECT_KEYS = 20;

export type AccessRequestStatus = 'pending' | 'granted' | 'denied';
export type AccessRequestKind = 'admission' | 'project_expansion';

export function isAccessRequestContactTitle(
  title: string | null | undefined
): boolean {
  if (!title) {
    return false;
  }
  return title.trim().toLowerCase() === ACCESS_REQUEST_TITLE.toLowerCase();
}

export function normalizeAccessRequestEmail(email: string): string | null {
  const parsed = accessAllowlistEmailValueSchema.safeParse(email);
  return parsed.success ? parsed.data : null;
}

/**
 * Normalize free-text or array project-key input from contact / access-denied forms.
 * Accepts comma, semicolon, or whitespace separators.
 */
export function parseRequestedProjectKeysInput(
  raw: string | readonly string[] | null | undefined
): string[] {
  if (raw == null) {
    return [];
  }
  const parts = Array.isArray(raw)
    ? raw.map(String)
    : String(raw).split(/[\s,;]+/);
  return normalizeAllowlistProjectKeys(parts).slice(
    0,
    ACCESS_REQUEST_MAX_PROJECT_KEYS
  );
}

/** Normalized keys stored on `access_requests.requested_project_keys`. */
export function accessRequestProjectKeysFromValue(value: unknown): string[] {
  return normalizeAllowlistProjectKeys(parseAllowlistProjectKeys(value));
}

export function accessRequestRollingWindowStart(now: Date = new Date()): Date {
  const start = new Date(now);
  start.setDate(start.getDate() - ACCESS_REQUEST_ROLLING_WINDOW_DAYS);
  return start;
}

export const accessRequestDenySchema = z.object({
  expectedUpdatedAt: z.string().optional(),
});

export type AccessRequestDenyInput = z.infer<typeof accessRequestDenySchema>;

export const accessRequestGrantSchema = z.object({
  requestId: z.string().uuid().optional(),
  expectedUpdatedAt: z.string().optional(),
});

export type AccessRequestGrantInput = z.infer<typeof accessRequestGrantSchema>;
