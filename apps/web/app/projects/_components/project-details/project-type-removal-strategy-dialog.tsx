'use client';

import { useEffect, useMemo, useState } from 'react';
import type { WorkItemType, WorkItemStatus } from '@repo/types';
import type {
  WorkItemTypeRemovalPreviewGroup,
  WorkItemTypeRemovalPreviewResponse,
  WorkItemTypeRemovalStrategy,
} from '@repo/types/api/v1';
import { Badge } from '@repo/ui/components/ui/badge';
import { Button } from '@repo/ui/components/ui/button';
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from '@repo/ui/components/ui/collapsible';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { AlertTriangle, ChevronDown, Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { WorkItemStatusBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-status';
import { WorkItemTypeBadge } from '@/app/work-items/_components/work-item-badge/work-item-badge-type';

type StrategyDraft = {
  action: 'delete' | 'migrate';
  migrateTo?: WorkItemType;
};

type ProjectTypeRemovalStrategyDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  readonly preview: WorkItemTypeRemovalPreviewResponse | null;
  readonly previewLoading: boolean;
  readonly previewError: string | null;
  readonly migrateTargets: readonly WorkItemType[];
  readonly isSubmitting: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onConfirm: (strategies: WorkItemTypeRemovalStrategy[]) => void;
};

function GroupStrategyPanel({
  group,
  migrateTargets,
  draft,
  onDraftChange,
}: Readonly<{
  group: WorkItemTypeRemovalPreviewGroup;
  migrateTargets: readonly WorkItemType[];
  draft: StrategyDraft | undefined;
  // eslint-disable-next-line no-unused-vars
  onDraftChange: (next: StrategyDraft) => void;
}>) {
  const [open, setOpen] = useState(group.count > 0);
  const action = draft?.action ?? 'migrate';
  const migrateTo = draft?.migrateTo ?? migrateTargets[0];

  return (
    <Collapsible
      open={open}
      onOpenChange={setOpen}
      className="border-border rounded-lg border"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3 text-left"
        >
          <div className="flex min-w-0 items-center gap-2">
            <WorkItemTypeBadge type={group.type} />
            <span className="text-sm font-semibold">{group.type}</span>
            <Badge variant="secondary">{group.count}</Badge>
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border space-y-4 border-t px-4 py-3">
        {group.childSlotParents.length > 0 ? (
          <div className="flex items-start gap-2 rounded-md border border-amber-700/30 bg-amber-100 p-3 text-sm text-amber-950 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100">
            <AlertTriangle className="mt-0.5 size-4 shrink-0" />
            <p>
              Parent links from{' '}
              <span className="font-semibold">
                {group.childSlotParents.join(', ')}
              </span>{' '}
              to {group.type} will be detached before this change is applied.
            </p>
          </div>
        ) : null}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium">
            How should these be handled?
          </legend>
          <div className="flex items-start gap-3">
            <input
              id={`strategy-delete-${group.type}`}
              type="radio"
              name={`strategy-${group.type}`}
              className="mt-1"
              checked={action === 'delete'}
              onChange={() => onDraftChange({ action: 'delete' })}
            />
            <label
              htmlFor={`strategy-delete-${group.type}`}
              className="cursor-pointer text-sm"
            >
              <span className="font-medium">Delete permanently</span>
              <span className="text-muted-foreground block">
                Removes these work items. Archive is not offered because
                restoring would reintroduce a disallowed type.
              </span>
            </label>
          </div>
          <div className="flex items-start gap-3">
            <input
              id={`strategy-migrate-${group.type}`}
              type="radio"
              name={`strategy-${group.type}`}
              className="mt-1"
              checked={action === 'migrate'}
              onChange={() =>
                onDraftChange({
                  action: 'migrate',
                  migrateTo: migrateTo ?? migrateTargets[0],
                })
              }
            />
            <label
              htmlFor={`strategy-migrate-${group.type}`}
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2 text-sm"
            >
              <span className="font-medium">Convert to another type</span>
              <div className="flex max-w-xs flex-col gap-1">
                <Label htmlFor={`migrate-to-${group.type}`} className="sr-only">
                  Target type
                </Label>
                <Select
                  value={migrateTo}
                  disabled={action !== 'migrate' || migrateTargets.length === 0}
                  onValueChange={(value) =>
                    onDraftChange({
                      action: 'migrate',
                      migrateTo: value as WorkItemType,
                    })
                  }
                >
                  <SelectTrigger id={`migrate-to-${group.type}`}>
                    <SelectValue placeholder="Select type" />
                  </SelectTrigger>
                  <SelectContent>
                    {migrateTargets.map((target) => (
                      <SelectItem key={target} value={target}>
                        {target}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </label>
          </div>
        </fieldset>

        {group.items.length === 0 ? (
          <p className="text-muted-foreground text-sm">
            No work items of this type.
          </p>
        ) : (
          <div className="border-border max-h-56 overflow-auto rounded-md border">
            <table className="w-full text-left text-sm">
              <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                <tr>
                  <th className="px-3 py-2 font-medium">Title</th>
                  <th className="px-3 py-2 font-medium">Status</th>
                  <th className="px-3 py-2 font-medium">Record</th>
                  <th className="px-3 py-2 font-medium">Parent</th>
                </tr>
              </thead>
              <tbody>
                {group.items.map((item) => (
                  <tr key={item.id} className="border-border border-t">
                    <td className="px-3 py-2">
                      <TruncatedText className="max-w-48 font-medium">
                        {item.title}
                      </TruncatedText>
                      {item.jira_issue_key ? (
                        <span className="text-muted-foreground block text-xs">
                          {item.jira_issue_key}
                        </span>
                      ) : null}
                    </td>
                    <td className="px-3 py-2">
                      <WorkItemStatusBadge
                        status={item.status as WorkItemStatus}
                      />
                    </td>
                    <td className="text-muted-foreground px-3 py-2 capitalize">
                      {item.record_status}
                    </td>
                    <td className="px-3 py-2">
                      <TruncatedText className="text-muted-foreground max-w-36 text-xs">
                        {item.parent_title ?? '—'}
                      </TruncatedText>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {group.count > group.items.length ? (
              <p className="text-muted-foreground border-border border-t px-3 py-2 text-xs">
                Showing {group.items.length} of {group.count}
              </p>
            ) : null}
          </div>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}

export function ProjectTypeRemovalStrategyDialog({
  open,
  onOpenChange,
  preview,
  previewLoading,
  previewError,
  migrateTargets,
  isSubmitting,
  onConfirm,
}: Readonly<ProjectTypeRemovalStrategyDialogProps>) {
  const affectedGroups = useMemo(
    () => (preview?.groups ?? []).filter((group) => group.count > 0),
    [preview]
  );

  const [drafts, setDrafts] = useState<
    Partial<Record<WorkItemType, StrategyDraft>>
  >({});

  useEffect(() => {
    if (!open || affectedGroups.length === 0) {
      return;
    }
    const defaults: Partial<Record<WorkItemType, StrategyDraft>> = {};
    for (const group of affectedGroups) {
      defaults[group.type] = {
        action: 'migrate',
        migrateTo: migrateTargets[0],
      };
    }
    setDrafts(defaults);
  }, [open, affectedGroups, migrateTargets]);

  const allReady =
    affectedGroups.length > 0 &&
    affectedGroups.every((group) => {
      const draft = drafts[group.type];
      if (!draft) {
        return false;
      }
      if (draft.action === 'delete') {
        return true;
      }
      return Boolean(draft.migrateTo);
    });

  const handleConfirm = () => {
    const strategies: WorkItemTypeRemovalStrategy[] = affectedGroups.map(
      (group) => {
        const draft = drafts[group.type]!;
        if (draft.action === 'delete') {
          return { type: group.type, action: 'delete' };
        }
        return {
          type: group.type,
          action: 'migrate',
          migrateTo: draft.migrateTo!,
        };
      }
    );
    onConfirm(strategies);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0">
        <DialogHeader className="border-border space-y-2 border-b px-6 py-4">
          <DialogTitle>Resolve removed work-item types</DialogTitle>
          <DialogDescription>
            Choose how to handle existing work items (active and archived) for
            each type you are removing. Parent links that would become invalid
            are detached first.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-3 overflow-y-auto px-6 py-4">
          {previewLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading affected work items…
            </div>
          ) : null}
          {previewError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border p-3 text-sm">
              {previewError}
            </div>
          ) : null}
          {!previewLoading && !previewError
            ? affectedGroups.map((group) => (
                <GroupStrategyPanel
                  key={group.type}
                  group={group}
                  migrateTargets={migrateTargets}
                  draft={drafts[group.type]}
                  onDraftChange={(next) =>
                    setDrafts((prev) => ({ ...prev, [group.type]: next }))
                  }
                />
              ))
            : null}
        </div>

        <DialogFooter className="border-border border-t px-6 py-4">
          <Button
            type="button"
            variant="outline"
            disabled={isSubmitting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            disabled={
              !allReady ||
              isSubmitting ||
              previewLoading ||
              Boolean(previewError)
            }
            onClick={handleConfirm}
          >
            {isSubmitting ? (
              <Loader2 className="mr-2 size-4 animate-spin" />
            ) : null}
            Apply and save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
