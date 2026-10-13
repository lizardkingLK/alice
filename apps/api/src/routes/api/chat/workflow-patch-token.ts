import { createHash, randomBytes } from 'node:crypto';
import { utcNow } from '@repo/types';
import type { WorkflowConfigEnvelope } from '@repo/types/api/v1';
import {
  signJsonHmac,
  verifyJsonHmac,
} from '../../../lib/secrets/hmac-payload';

export const WORKFLOW_PATCH_TOKEN_TTL_MS = 10 * 60 * 1000;
const HMAC_PURPOSE = 'workflow patch confirmation (HMAC)';
const INVALID_TOKEN = 'Invalid workflow patch confirmation token.';

export type WorkflowPatchTokenPayload = {
  readonly userId: string;
  readonly projectId: string;
  readonly configHash: string;
  readonly nonce: string;
  readonly exp: number;
};

/** Stable hash of a proposed workflow envelope for token binding. */
export function hashWorkflowConfig(config: WorkflowConfigEnvelope): string {
  return createHash('sha256').update(JSON.stringify(config)).digest('hex');
}

function isWorkflowPatchTokenPayload(
  value: unknown
): value is WorkflowPatchTokenPayload {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as WorkflowPatchTokenPayload;
  return (
    typeof candidate.userId === 'string' &&
    typeof candidate.projectId === 'string' &&
    typeof candidate.configHash === 'string' &&
    typeof candidate.nonce === 'string' &&
    typeof candidate.exp === 'number'
  );
}

export function createWorkflowPatchToken(
  userId: string,
  projectId: string,
  config: WorkflowConfigEnvelope,
  ttlMs = WORKFLOW_PATCH_TOKEN_TTL_MS
): string {
  const payload: WorkflowPatchTokenPayload = {
    userId,
    projectId,
    configHash: hashWorkflowConfig(config),
    nonce: randomBytes(16).toString('hex'),
    exp: utcNow().getTime() + ttlMs,
  };
  return signJsonHmac(payload, HMAC_PURPOSE);
}

export function verifyWorkflowPatchToken(
  token: string,
  expected: {
    readonly userId: string;
    readonly projectId: string;
    readonly config: WorkflowConfigEnvelope;
  }
): WorkflowPatchTokenPayload {
  const parsed = verifyJsonHmac(token, HMAC_PURPOSE, INVALID_TOKEN);
  if (!isWorkflowPatchTokenPayload(parsed)) {
    throw new TypeError(INVALID_TOKEN);
  }

  if (utcNow().getTime() > parsed.exp) {
    throw new Error(
      'This workflow proposal has expired. Ask Alice for a new proposal.'
    );
  }

  if (parsed.userId !== expected.userId) {
    throw new Error('Workflow patch token does not match the current user.');
  }
  if (parsed.projectId !== expected.projectId) {
    throw new Error('Workflow patch token does not match this project.');
  }
  if (parsed.configHash !== hashWorkflowConfig(expected.config)) {
    throw new Error(
      'Workflow proposal no longer matches the confirmation token.'
    );
  }

  return parsed;
}
