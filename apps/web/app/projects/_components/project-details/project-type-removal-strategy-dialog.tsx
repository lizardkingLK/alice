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
      className="border-border overflow-hidden rounded-lg border"
    >
      <CollapsibleTrigger asChild>
        <button
          type="button"
          className="hover:bg-muted/40 flex w-full items-center justify-between gap-3 px-4 py-3.5 text-left"
        >
          <div className="flex min-w-0 items-center gap-2.5">
            <WorkItemTypeBadge type={group.type} />
            <span className="text-sm font-semibold">{group.type}</span>
            <Badge variant="secondary" className="tabular-nums">
              {group.count}
            </Badge>
          </div>
          <ChevronDown
            className={cn(
              'text-muted-foreground size-4 shrink-0 transition-transform',
              open && 'rotate-180'
            )}
          />
        </button>
      </CollapsibleTrigger>
      <CollapsibleContent className="border-border space-y-5 border-t px-4 pt-4 pb-5">
        {group.childSlotParents.length > 0 ? (
          <div className="flex items-start gap-3 rounded-md border border-amber-700/30 bg-amber-100 px-3.5 py-3 text-sm leading-relaxed text-amber-950 dark:border-amber-500/40 dark:bg-amber-950 dark:text-amber-100">
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

        <fieldset className="space-y-4">
          <legend className="mb-1 text-sm font-medium">
            How should these be handled?
          </legend>
          <div className="flex items-start gap-3">
            <input
              id={`strategy-delete-${group.type}`}
              type="radio"
              name={`strategy-${group.type}`}
              className="mt-1 size-4 shrink-0"
              checked={action === 'delete'}
              onChange={() => onDraftChange({ action: 'delete' })}
            />
            <label
              htmlFor={`strategy-delete-${group.type}`}
              className="flex cursor-pointer flex-col gap-1 text-sm"
            >
              <span className="font-medium">Delete permanently</span>
              <span className="text-muted-foreground leading-relaxed">
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
              className="mt-1 size-4 shrink-0"
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
              className="flex min-w-0 flex-1 cursor-pointer flex-col gap-2.5 text-sm"
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
          <div className="border-border overflow-hidden rounded-md border">
            <div className="max-h-56 overflow-auto">
              <table className="w-full text-left text-sm">
                <thead className="bg-muted/40 text-muted-foreground sticky top-0">
                  <tr>
                    <th className="px-3.5 py-2.5 font-medium">Title</th>
                    <th className="px-3.5 py-2.5 font-medium">Status</th>
                    <th className="px-3.5 py-2.5 font-medium">Record</th>
                    <th className="px-3.5 py-2.5 font-medium">Parent</th>
                  </tr>
                </thead>
                <tbody>
                  {group.items.map((item) => (
                    <tr key={item.id} className="border-border border-t">
                      <td className="px-3.5 py-2.5">
                        <TruncatedText className="max-w-48 font-medium">
                          {item.title}
                        </TruncatedText>
                        {item.jira_issue_key ? (
                          <span className="text-muted-foreground mt-0.5 block text-xs">
                            {item.jira_issue_key}
                          </span>
                        ) : null}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <WorkItemStatusBadge
                          status={item.status as WorkItemStatus}
                        />
                      </td>
                      <td className="text-muted-foreground px-3.5 py-2.5 capitalize">
                        {item.record_status}
                      </td>
                      <td className="px-3.5 py-2.5">
                        <TruncatedText className="text-muted-foreground max-w-36 text-xs">
                          {item.parent_title ?? '—'}
                        </TruncatedText>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {group.count > group.items.length ? (
              <p className="text-muted-foreground border-border border-t px-3.5 py-2.5 text-xs">
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
      <DialogContent className="flex max-h-[90vh] max-w-3xl flex-col gap-0 overflow-hidden p-0 sm:max-w-3xl">
        <DialogHeader className="border-border space-y-2 border-b px-6 pt-5 pr-12 pb-4 text-left">
          <DialogTitle>Resolve removed work-item types</DialogTitle>
          <DialogDescription className="leading-relaxed">
            Choose how to handle existing work items (active and archived) for
            each type you are removing. Parent links that would become invalid
            are detached first.
          </DialogDescription>
        </DialogHeader>

        <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-6 py-5">
          {previewLoading ? (
            <div className="text-muted-foreground flex items-center justify-center gap-2 py-12 text-sm">
              <Loader2 className="size-4 animate-spin" />
              Loading affected work items…
            </div>
          ) : null}
          {previewError ? (
            <div className="border-destructive/30 bg-destructive/10 text-destructive rounded-md border px-3.5 py-3 text-sm leading-relaxed">
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

        <DialogFooter className="border-border m-0 shrink-0 gap-2 border-t px-6 pt-4 pb-5 sm:justify-end">
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
