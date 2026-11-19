import { createHash, randomBytes } from 'node:crypto';
import { utcNow } from '@repo/types';
import {
  signJsonHmac,
  verifyJsonHmac,
} from '../../../lib/secrets/hmac-payload';

export const WORK_ITEM_AI_PROPOSAL_TOKEN_TTL_MS = 15 * 60 * 1000;
const HMAC_PURPOSE = 'work item ai proposal confirmation (HMAC)';
const INVALID_TOKEN = 'Invalid work-item proposal confirmation token.';

export type WorkItemAiProposalTokenErrorCode =
  | 'invalid_token'
  | 'expired'
  | 'user_mismatch'
  | 'item_mismatch'
  | 'content_mismatch'
  | 'stale';

export class WorkItemAiProposalTokenError extends Error {
  readonly code: WorkItemAiProposalTokenErrorCode;

  constructor(code: WorkItemAiProposalTokenErrorCode, message: string) {
    super(message);
    this.name = 'WorkItemAiProposalTokenError';
    this.code = code;
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

export type WorkItemAiProposalTokenPayload = {
  readonly userId: string;
  readonly workItemId: string;
  readonly titleHash: string;
  readonly descriptionHash: string;
  readonly baseUpdatedAt: string;
  readonly nonce: string;
  readonly exp: number;
};

export function hashProposalTitle(title: string): string {
  return createHash('sha256').update(title.trim()).digest('hex');
}

export function hashProposalDescription(description: unknown): string {
  return createHash('sha256').update(JSON.stringify(description)).digest('hex');
}

function isWorkItemAiProposalTokenPayload(
  value: unknown
): value is WorkItemAiProposalTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as WorkItemAiProposalTokenPayload;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.workItemId === 'string' &&
    typeof candidate.titleHash === 'string' &&
    typeof candidate.descriptionHash === 'string' &&
    typeof candidate.baseUpdatedAt === 'string' &&
    typeof candidate.nonce === 'string' &&
    typeof candidate.exp === 'number'
  );
}

export function createWorkItemAiProposalToken(options: {
  userId: string;
  workItemId: string;
  title: string;
  description: unknown;
  baseUpdatedAt: string;
  ttlMs?: number;
}): string {
  const payload: WorkItemAiProposalTokenPayload = {
    userId: options.userId,
    workItemId: options.workItemId,
    titleHash: hashProposalTitle(options.title),
    descriptionHash: hashProposalDescription(options.description),
    baseUpdatedAt: options.baseUpdatedAt,
    nonce: randomBytes(16).toString('hex'),
    exp:
      utcNow().getTime() +
      (options.ttlMs ?? WORK_ITEM_AI_PROPOSAL_TOKEN_TTL_MS),
  };
  return signJsonHmac(payload, HMAC_PURPOSE);
}

export function verifyWorkItemAiProposalToken(
  token: string,
  expected: {
    readonly userId: string;
    readonly workItemId: string;
    readonly title: string;
    readonly description: unknown;
    readonly baseUpdatedAt?: string;
  }
): WorkItemAiProposalTokenPayload {
  let parsed: unknown;
  try {
    parsed = verifyJsonHmac(token, HMAC_PURPOSE, INVALID_TOKEN);
  } catch {
    throw new WorkItemAiProposalTokenError('invalid_token', INVALID_TOKEN);
  }

  if (!isWorkItemAiProposalTokenPayload(parsed)) {
    throw new WorkItemAiProposalTokenError('invalid_token', INVALID_TOKEN);
  }

  if (utcNow().getTime() > parsed.exp) {
    throw new WorkItemAiProposalTokenError(
      'expired',
      'This suggestion proposal has expired. Request new suggestions.'
    );
  }

  if (parsed.userId !== expected.userId) {
    throw new WorkItemAiProposalTokenError(
      'user_mismatch',
      'Suggestion proposal token does not match the current user.'
    );
  }

  if (parsed.workItemId !== expected.workItemId) {
    throw new WorkItemAiProposalTokenError(
      'item_mismatch',
      'Suggestion proposal token does not match this work item.'
    );
  }

  if (parsed.titleHash !== hashProposalTitle(expected.title)) {
    throw new WorkItemAiProposalTokenError(
      'content_mismatch',
      'Suggestion title does not match the confirmation token.'
    );
  }

  if (
    parsed.descriptionHash !== hashProposalDescription(expected.description)
  ) {
    throw new WorkItemAiProposalTokenError(
      'content_mismatch',
      'Suggestion description does not match the confirmation token.'
    );
  }

  if (
    expected.baseUpdatedAt !== undefined &&
    parsed.baseUpdatedAt !== expected.baseUpdatedAt
  ) {
    throw new WorkItemAiProposalTokenError(
      'stale',
      'The work item has been modified since this suggestion was generated.'
    );
  }

  return parsed;
}
