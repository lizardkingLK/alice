import type { ReactNode } from 'react';
import type { WorkItemStatus } from '@repo/types';

export function resolveShowParentPicker(
  lockParent: boolean,
  parentTypeLabel: string | null
): boolean {
  return !lockParent && parentTypeLabel !== null;
}

type WorkItemFormParentStatusSectionProps = {
  readonly lockStatus: boolean;
  readonly status: WorkItemStatus | '';
  readonly lockParent: boolean;
  readonly parentId: string;
  readonly parentTypeLabel: string | null;
  /** Visible locked-status UI (badge). Status hidden input is owned here. */
  readonly lockedStatusSlot?: ReactNode;
  /** Visible parent picker. Locked/empty parent_id hiddens are owned here. */
  readonly parentPickerSlot?: ReactNode;
};

/**
 * Shared status/parent FormData branching for classic + modern work-item forms.
 * Layouts pass visible slots; this component owns the hidden inputs.
 */
export function WorkItemFormParentStatusSection({
  lockStatus,
  status,
  lockParent,
  parentId,
  parentTypeLabel,
  lockedStatusSlot,
  parentPickerSlot,
}: Readonly<WorkItemFormParentStatusSectionProps>) {
  const showParentPicker = resolveShowParentPicker(lockParent, parentTypeLabel);

  return (
    <>
      {lockStatus && status ? (
        <>
          {lockedStatusSlot}
          <input type="hidden" name="status" value={status} />
        </>
      ) : null}

      {lockParent && parentId ? (
        <input type="hidden" name="parent_id" value={parentId} />
      ) : null}

      {showParentPicker ? parentPickerSlot : null}

      {!lockParent && !showParentPicker ? (
        <input type="hidden" name="parent_id" value="" />
      ) : null}
    </>
  );
}
