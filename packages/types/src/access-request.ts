import { z } from 'zod';
import { accessAllowlistEmailValueSchema } from './access-allowlist.js';

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
