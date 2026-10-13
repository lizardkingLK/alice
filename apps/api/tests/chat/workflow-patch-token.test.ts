import { beforeEach, describe, expect, it, vi } from 'vitest';
import { createSeededDefaultWorkflowConfig } from '@repo/types/api/v1';

vi.hoisted(() => {
  process.env.GITHUB_ACTIONS = 'true';
});

import {
  createWorkflowPatchToken,
  hashWorkflowConfig,
  verifyWorkflowPatchToken,
} from '../../src/routes/api/chat/workflow-patch-token';

describe('workflow patch confirmation token', () => {
  const userId = '11111111-1111-4111-8111-111111111111';
  const projectId = '22222222-2222-4222-8222-222222222222';
  const config = createSeededDefaultWorkflowConfig();

  beforeEach(() => {
    vi.useRealTimers();
  });

  it('round-trips a valid token for the same user, project, and config', () => {
    const token = createWorkflowPatchToken(userId, projectId, config);
    const payload = verifyWorkflowPatchToken(token, {
      userId,
      projectId,
      config,
    });
    expect(payload.configHash).toBe(hashWorkflowConfig(config));
    expect(payload.userId).toBe(userId);
    expect(payload.projectId).toBe(projectId);
  });

  it('rejects a tampered token', () => {
    const token = createWorkflowPatchToken(userId, projectId, config);
    const [body] = token.split('.');
    expect(() =>
      verifyWorkflowPatchToken(`${body}.aaaa`, {
        userId,
        projectId,
        config,
      })
    ).toThrow(/Invalid workflow patch confirmation token/);
  });

  it('rejects when the proposed config hash no longer matches', () => {
    const token = createWorkflowPatchToken(userId, projectId, config);
    const other = createSeededDefaultWorkflowConfig();
    other.workflows[0]!.title = 'Renamed';
    expect(() =>
      verifyWorkflowPatchToken(token, {
        userId,
        projectId,
        config: other,
      })
    ).toThrow(/no longer matches/);
  });

  it('rejects expired tokens', () => {
    vi.useFakeTimers();
    const token = createWorkflowPatchToken(userId, projectId, config, 1000);
    vi.advanceTimersByTime(2000);
    expect(() =>
      verifyWorkflowPatchToken(token, { userId, projectId, config })
    ).toThrow(/expired/);
  });
});
