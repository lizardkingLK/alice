import { describe, expect, it } from 'vitest';
import { applyProjectWorkflowUpdate } from '@/lib/soft-invalidate/soft-invalidate-project-row';
import { workflowConfigStamp } from '@/lib/soft-invalidate/workflow-config-stamp';

describe('workflowConfigStamp', () => {
  it('distinguishes null from an empty object', () => {
    expect(workflowConfigStamp(null)).not.toBe(workflowConfigStamp({}));
  });

  it('is stable for the same config', () => {
    const config = { schemaVersion: 1, workflows: [] };
    expect(workflowConfigStamp(config)).toBe(workflowConfigStamp(config));
  });
});

describe('applyProjectWorkflowUpdate', () => {
  const baseline = {
    stamp: workflowConfigStamp({ schemaVersion: 1 }),
    updatedAt: '2026-01-01T00:00:00.000Z',
  };

  it('does not invalidate when workflow_config is unchanged', () => {
    const result = applyProjectWorkflowUpdate({
      row: {
        workflow_config: { schemaVersion: 1 },
        updated_at: '2026-01-02T00:00:00.000Z',
        updated_by: 'other-user',
      },
      baseline,
      viewerUserId: 'viewer',
    });
    expect(result.shouldInvalidate).toBe(false);
    expect(result.nextBaseline.updatedAt).toBe('2026-01-02T00:00:00.000Z');
  });

  it('invalidates when another user changes workflow_config', () => {
    const result = applyProjectWorkflowUpdate({
      row: {
        workflow_config: { schemaVersion: 1, workflows: [{ id: 'w1' }] },
        updated_at: '2026-01-02T00:00:00.000Z',
        updated_by: 'other-user',
      },
      baseline,
      viewerUserId: 'viewer',
    });
    expect(result.shouldInvalidate).toBe(true);
  });

  it('silently updates baseline for the viewer’s own save', () => {
    const result = applyProjectWorkflowUpdate({
      row: {
        workflow_config: { schemaVersion: 1, workflows: [{ id: 'w1' }] },
        updated_at: '2026-01-02T00:00:00.000Z',
        updated_by: 'viewer',
      },
      baseline,
      viewerUserId: 'viewer',
    });
    expect(result.shouldInvalidate).toBe(false);
    expect(result.nextBaseline.stamp).toBe(
      workflowConfigStamp({ schemaVersion: 1, workflows: [{ id: 'w1' }] })
    );
  });
});
