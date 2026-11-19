import { workflowConfigStamp } from './workflow-config-stamp';

export type SoftInvalidateProjectRow = {
  readonly id?: string;
  readonly updated_at?: string;
  readonly updated_by?: string | null;
  readonly workflow_config?: unknown;
};

export type SoftInvalidateProjectBaseline = {
  readonly stamp: string;
  readonly updatedAt: string;
};

/**
 * Decide whether a projects UPDATE should soft-invalidate workflow UI.
 * Own updates (updated_by === viewer) refresh the baseline silently.
 */
export function applyProjectWorkflowUpdate(options: {
  readonly row: SoftInvalidateProjectRow;
  readonly baseline: SoftInvalidateProjectBaseline;
  readonly viewerUserId: string | null;
}): {
  readonly nextBaseline: SoftInvalidateProjectBaseline;
  readonly shouldInvalidate: boolean;
} {
  const { row, baseline, viewerUserId } = options;
  const nextStamp = workflowConfigStamp(row.workflow_config);
  const nextUpdatedAt =
    typeof row.updated_at === 'string' && row.updated_at.length > 0
      ? row.updated_at
      : baseline.updatedAt;
  const nextBaseline: SoftInvalidateProjectBaseline = {
    stamp: nextStamp,
    updatedAt: nextUpdatedAt,
  };

  if (nextStamp === baseline.stamp) {
    return { nextBaseline, shouldInvalidate: false };
  }

  if (viewerUserId && row.updated_by === viewerUserId) {
    return { nextBaseline, shouldInvalidate: false };
  }

  return { nextBaseline, shouldInvalidate: true };
}
