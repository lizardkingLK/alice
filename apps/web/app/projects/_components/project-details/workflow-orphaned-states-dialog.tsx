'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  suggestRemapTargetState,
  type WorkflowOrphanedStatesConflict,
  type WorkflowStateRemap,
} from '@repo/types/api/v1';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { afterDialogClose } from '@/lib/dialog-close';

/* eslint-disable no-unused-vars -- callback parameter names document the payload */
type OrphanDialogOpenChangeHandler = (open: boolean) => void;
type OrphanDialogConfirmRemapHandler = (
  remaps: readonly WorkflowStateRemap[]
) => void;
/* eslint-enable no-unused-vars */

type WorkflowOrphanedStatesDialogProps = {
  readonly conflict: WorkflowOrphanedStatesConflict | null;
  readonly open: boolean;
  readonly isSaving: boolean;
  readonly onOpenChange: OrphanDialogOpenChangeHandler;
  readonly onDiscard: () => void;
  readonly onConfirmRemap: OrphanDialogConfirmRemapHandler;
};

function remapKey(workflowId: string, fromStateId: string): string {
  return `${workflowId}::${fromStateId}`;
}

function buildInitialSelections(
  conflict: WorkflowOrphanedStatesConflict
): Record<string, string> {
  const next: Record<string, string> = {};
  for (const group of conflict.groups) {
    const available =
      conflict.availableStatesByWorkflow[group.workflowId] ?? [];
    const suggested = suggestRemapTargetState(available, group.category);
    if (suggested) {
      next[remapKey(group.workflowId, group.stateId)] = suggested.id;
    }
  }
  return next;
}

export function WorkflowOrphanedStatesDialog({
  conflict,
  open,
  isSaving,
  onOpenChange,
  onDiscard,
  onConfirmRemap,
}: WorkflowOrphanedStatesDialogProps) {
  const [selections, setSelections] = useState<Record<string, string>>({});

  useEffect(() => {
    if (!open) {
      return afterDialogClose(() => {
        setSelections({});
      });
    }
    if (conflict) {
      setSelections(buildInitialSelections(conflict));
    }
    return undefined;
  }, [open, conflict]);

  const remaps = useMemo((): WorkflowStateRemap[] => {
    if (!conflict) {
      return [];
    }
    const next: WorkflowStateRemap[] = [];
    for (const group of conflict.groups) {
      const toStateId = selections[remapKey(group.workflowId, group.stateId)];
      if (!toStateId) {
        continue;
      }
      next.push({
        workflowId: group.workflowId,
        fromStateId: group.stateId,
        toStateId,
      });
    }
    return next;
  }, [conflict, selections]);

  const allMapped =
    conflict !== null && remaps.length === conflict.groups.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent data-testid="workflow-orphaned-states-dialog">
        <DialogHeader>
          <DialogTitle>Move work items before saving</DialogTitle>
          <DialogDescription>
            {conflict?.message ??
              'Some work items still use states you removed.'}
          </DialogDescription>
        </DialogHeader>

        {conflict ? (
          <ul className="space-y-4">
            {conflict.groups.map((group) => {
              const key = remapKey(group.workflowId, group.stateId);
              const available =
                conflict.availableStatesByWorkflow[group.workflowId] ?? [];
              return (
                <li
                  key={key}
                  className="border-border space-y-2 rounded-md border p-3"
                  data-testid={`workflow-orphan-group-${group.stateId}`}
                >
                  <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1 text-sm">
                    <span className="font-medium">{group.stateName}</span>
                    <span className="text-muted-foreground">
                      {group.workflowTitle}
                    </span>
                    <span className="text-muted-foreground">
                      {group.affectedCount} item
                      {group.affectedCount === 1 ? '' : 's'}
                    </span>
                  </div>
                  <div className="space-y-1.5">
                    <label
                      className="text-muted-foreground text-xs font-medium"
                      htmlFor={`orphan-remap-${key}`}
                    >
                      Move to
                    </label>
                    <Select
                      value={selections[key] ?? ''}
                      onValueChange={(value) => {
                        setSelections((current) => ({
                          ...current,
                          [key]: value,
                        }));
                      }}
                      disabled={isSaving || available.length === 0}
                    >
                      <SelectTrigger
                        id={`orphan-remap-${key}`}
                        className="w-full"
                      >
                        <SelectValue placeholder="Choose a state" />
                      </SelectTrigger>
                      <SelectContent>
                        {available.map((state) => (
                          <SelectItem key={state.id} value={state.id}>
                            {state.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                </li>
              );
            })}
          </ul>
        ) : null}

        <DialogFooter className="gap-2 sm:justify-between">
          <Button
            type="button"
            variant="outline"
            disabled={isSaving}
            onClick={onDiscard}
          >
            Discard changes
          </Button>
          <Button
            type="button"
            disabled={isSaving || !allMapped}
            onClick={() => {
              onConfirmRemap(remaps);
            }}
          >
            {isSaving ? 'Saving…' : 'Move and save'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
