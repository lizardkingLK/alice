import type { WorkItemStatus, WorkItemType } from '@repo/types';
import { resolveWorkItemStatePickerModel } from '@/app/work-items/_helpers/workflow-state-options';

export type WorkItemStateColumnModel = {
  readonly label: string;
  /** Bridged legacy status for badge colors / icons. */
  readonly status: WorkItemStatus;
};

/**
 * Resolve the workflow State label for table / chart drilldown cells.
 * Falls back to legacy Status when the project has no workflow envelope.
 */
export function resolveWorkItemStateColumnModel(params: {
  readonly status: WorkItemStatus;
  readonly state?: unknown;
  readonly type?: WorkItemType | string;
  readonly workflowConfig?: unknown;
  readonly boardColumnId?: string | null;
}): WorkItemStateColumnModel {
  const picker = resolveWorkItemStatePickerModel({
    workflowConfig: params.workflowConfig,
    workItemType: params.type ?? 'Task',
    status: params.status,
    state: params.state,
    boardColumnId: params.boardColumnId,
  });

  const option =
    picker.options.find((entry) => entry.id === picker.currentStateId) ??
    picker.options.find((entry) => entry.status === params.status);

  return {
    label: picker.currentLabel,
    status: option?.status ?? params.status,
  };
}
