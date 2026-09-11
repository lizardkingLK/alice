'use client';

import { useState, useMemo, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { Badge } from '@repo/ui/components/ui/badge';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
import { ScrollArea } from '@repo/ui/components/ui/scroll-area';
import { RotateCcw, CheckCircle2, SlidersHorizontal } from '@repo/ui/lib/icons';
import { apiFetch } from '@/lib/api/api-fetch.reads.use.client';
import {
  findWorkItemsWithFieldValues,
  type WorkItemFieldValueMatch,
} from '@/app/work-items/_helpers/work-item-dynamic-fields';
import { ProjectFieldsErrorDialog } from './project-fields-error-dialog';
import {
  TEMPLATE_FIELD_OPTIONS,
  DEFAULT_STARTER_KEYS,
} from './load-template-dialog.data';

export {
  TEMPLATE_FIELD_OPTIONS,
  DEFAULT_STARTER_KEYS,
  type TemplateFieldItem,
} from './load-template-dialog.data';

export interface WorkItemSummaryItem {
  id: string;
  title?: string;
  description?: unknown;
}

/* eslint-disable no-unused-vars */
export interface LoadTemplateDialogProps {
  readonly open: boolean;
  readonly onOpenChange: (open: boolean) => void;
  readonly projectId?: string;
  readonly existingProperties?: Record<string, unknown>;
  readonly workItems?: WorkItemSummaryItem[];
  readonly onAddTemplates?: (selectedFields: Record<string, unknown>) => void;
  readonly onApplyTemplates?: (
    fieldsToAdd: Record<string, unknown>,
    keysToRemove: string[]
  ) => void;
}
/* eslint-enable no-unused-vars */

export function LoadTemplateDialog({
  open,
  onOpenChange,
  projectId,
  existingProperties = {},
  workItems,
  onAddTemplates,
  onApplyTemplates,
}: Readonly<LoadTemplateDialogProps>) {
  const existingKeySet = useMemo(() => {
    return new Set(Object.keys(existingProperties));
  }, [existingProperties]);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [loadedWorkItems, setLoadedWorkItems] = useState<WorkItemSummaryItem[]>(
    workItems || []
  );

  // Fetch work items with descriptions if not provided
  useEffect(() => {
    if (workItems) {
      setLoadedWorkItems(workItems);
      return;
    }

    if (!open || !projectId) return;

    let isMounted = true;
    async function fetchItems() {
      try {
        const res = await apiFetch<{
          workItems: WorkItemSummaryItem[];
        }>(
          `/api/workItems?projectId=${projectId}&includeDescription=true&limit=100`
        );
        if (isMounted && res?.workItems) {
          setLoadedWorkItems(res.workItems);
        }
      } catch {
        // Silently fallback if workItems query fails
      }
    }

    fetchItems();
    return () => {
      isMounted = false;
    };
  }, [open, projectId, workItems]);

  // Reset/sync selection when dialog opens
  useEffect(() => {
    if (open) {
      if (existingKeySet.size === 0) {
        // If project has no fields at all, default-select the core starter fields
        setSelectedKeys(new Set(DEFAULT_STARTER_KEYS));
      } else {
        // Pre-select whatever templates are currently in the project
        const inProject = TEMPLATE_FIELD_OPTIONS.filter((t) =>
          existingKeySet.has(t.key)
        ).map((t) => t.key);
        setSelectedKeys(new Set(inProject));
      }
    }
  }, [open, existingKeySet]);

  const [confirmDialog, setConfirmDialog] = useState<{
    open: boolean;
    title: string;
    description: string;
    note: string;
    onConfirm: () => void;
  }>({
    open: false,
    title: '',
    description: '',
    note: '',
    onConfirm: () => {},
  });

  const availableCount = TEMPLATE_FIELD_OPTIONS.length;

  const alreadyAddedCount = useMemo(() => {
    return TEMPLATE_FIELD_OPTIONS.filter((t) => existingKeySet.has(t.key))
      .length;
  }, [existingKeySet]);

  const handleToggle = (key: string) => {
    if (selectedKeys.has(key)) {
      // User is UNSELECTING this field
      const isAlreadyInProject = existingKeySet.has(key);
      if (isAlreadyInProject) {
        // Check if any work item has values for this template field
        const matches = findWorkItemsWithFieldValues(loadedWorkItems, key);
        if (matches.length > 0) {
          const item = TEMPLATE_FIELD_OPTIONS.find((t) => t.key === key);
          const title = item?.property.title || key;
          setConfirmDialog({
            open: true,
            title: `Remove Field Template: ${title}`,
            description:
              'Work item values will be removed under this template. Existing values assigned in work items for this field will no longer be available once this template is unselected and saved.',
            note:
              `Field: ${title} (key: ${key})\n\n` +
              `Note: The following work item values under this template will be removed:\n` +
              matches.map((m) => `• ${m.title}: ${m.value}`).join('\n') +
              `\n\nClick OK to confirm unselecting this template, or Cancel to keep it.`,
            onConfirm: () => {
              setSelectedKeys((prev) => {
                const next = new Set(prev);
                next.delete(key);
                return next;
              });
              setConfirmDialog((prev) => ({ ...prev, open: false }));
            },
          });
          return;
        }
      }

      // No work item values; unselect directly
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.delete(key);
        return next;
      });
    } else {
      // User is SELECTING this field
      setSelectedKeys((prev) => {
        const next = new Set(prev);
        next.add(key);
        return next;
      });
    }
  };

  const handleSelectAllAvailable = () => {
    const all = TEMPLATE_FIELD_OPTIONS.map((t) => t.key);
    setSelectedKeys(new Set(all));
  };

  const handleDeselectAll = () => {
    // Check if any of the currently selected fields in the project have work item values
    const affectedFields: Array<{
      title: string;
      key: string;
      matches: WorkItemFieldValueMatch[];
    }> = [];

    for (const key of selectedKeys) {
      if (existingKeySet.has(key)) {
        const matches = findWorkItemsWithFieldValues(loadedWorkItems, key);
        if (matches.length > 0) {
          const item = TEMPLATE_FIELD_OPTIONS.find((t) => t.key === key);
          affectedFields.push({
            title: item?.property.title || key,
            key,
            matches,
          });
        }
      }
    }

    if (affectedFields.length > 0) {
      const noteLines = affectedFields.map(
        (f) =>
          `Field: ${f.title} (key: ${f.key})\n` +
          f.matches.map((m) => `  • ${m.title}: ${m.value}`).join('\n')
      );

      setConfirmDialog({
        open: true,
        title: 'Remove Field Templates',
        description:
          'Work item values will be removed under these templates. Existing values assigned in work items for these fields will no longer be available once these templates are unselected and saved.',
        note:
          `Note: Work item values under the following templates will be removed:\n\n` +
          `${noteLines.join('\n\n')}\n\nClick OK to confirm unselecting all templates, or Cancel to keep them.`,
        onConfirm: () => {
          setSelectedKeys(new Set());
          setConfirmDialog((prev) => ({ ...prev, open: false }));
        },
      });
      return;
    }

    setSelectedKeys(new Set());
  };

  const canApply = useMemo(() => {
    if (selectedKeys.size > 0) return true;
    // If 0 selected, can apply if there were template fields in the project (to remove them)
    return TEMPLATE_FIELD_OPTIONS.some((t) => existingKeySet.has(t.key));
  }, [selectedKeys, existingKeySet]);

  const handleConfirm = () => {
    if (!canApply) return;

    const fieldsToAdd: Record<string, unknown> = {};
    const keysToRemove: string[] = [];

    for (const item of TEMPLATE_FIELD_OPTIONS) {
      if (selectedKeys.has(item.key)) {
        fieldsToAdd[item.key] = item.property;
      } else if (existingKeySet.has(item.key)) {
        keysToRemove.push(item.key);
      }
    }

    if (onApplyTemplates) {
      onApplyTemplates(fieldsToAdd, keysToRemove);
    } else if (onAddTemplates) {
      onAddTemplates(fieldsToAdd);
    }
    onOpenChange(false);
  };

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="flex max-h-[85vh] flex-col gap-0 overflow-hidden p-0 sm:max-w-2xl">
          <DialogHeader className="border-border/60 shrink-0 border-b p-6 pb-4">
            <div className="flex items-center gap-2">
              <div className="bg-primary/10 text-primary rounded-md p-1.5">
                <RotateCcw className="size-4" />
              </div>
              <DialogTitle>Load Field Templates</DialogTitle>
            </div>
            <DialogDescription>
              Select standard field templates to add or keep in this project.
              Unselect any templates you do not want to use.
            </DialogDescription>

            <div className="flex items-center justify-between pt-3 text-xs">
              <div className="flex items-center gap-2">
                <span className="text-foreground font-medium">
                  {selectedKeys.size} selected
                </span>
                <span className="text-muted-foreground">•</span>
                <span className="text-muted-foreground">
                  {availableCount} available templates
                </span>
                {alreadyAddedCount > 0 && (
                  <>
                    <span className="text-muted-foreground">•</span>
                    <span className="text-muted-foreground">
                      {alreadyAddedCount} currently in project
                    </span>
                  </>
                )}
              </div>

              <div className="flex items-center gap-1.5">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={handleSelectAllAvailable}
                  className="h-7 px-2 text-xs"
                >
                  Select All
                </Button>
                {selectedKeys.size > 0 && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={handleDeselectAll}
                    className="text-muted-foreground hover:text-foreground h-7 px-2 text-xs"
                  >
                    Clear Selection
                  </Button>
                )}
              </div>
            </div>
          </DialogHeader>

          <ScrollArea className="max-h-[50vh] flex-1 overflow-y-auto p-6">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {TEMPLATE_FIELD_OPTIONS.map((item) => {
                const isAlreadyAdded = existingKeySet.has(item.key);
                const isSelected = selectedKeys.has(item.key);

                const cardStyle = isSelected
                  ? 'border-primary/60 bg-primary/5 hover:border-primary cursor-pointer ring-1 ring-primary/20'
                  : 'border-border/60 bg-card/60 hover:border-border cursor-pointer';

                return (
                  <label
                    key={item.key}
                    htmlFor={`template-checkbox-${item.key}`}
                    className={`flex flex-col justify-between rounded-lg border p-3.5 transition-all select-none ${cardStyle}`}
                  >
                    <div>
                      <div className="mb-1.5 flex items-start justify-between gap-2">
                        <div className="flex min-w-0 items-center gap-2">
                          <Checkbox
                            id={`template-checkbox-${item.key}`}
                            checked={isSelected}
                            onCheckedChange={() => handleToggle(item.key)}
                            className="shrink-0"
                          />
                          <span className="text-foreground truncate text-sm font-semibold">
                            {item.property.title}
                          </span>
                        </div>

                        {isAlreadyAdded && isSelected ? (
                          <Badge
                            variant="outline"
                            className="shrink-0 border-emerald-500/30 bg-emerald-500/10 text-[10px] font-normal text-emerald-700 dark:text-emerald-400"
                          >
                            <CheckCircle2 className="mr-1 size-3" />
                            Added
                          </Badge>
                        ) : (
                          <Badge
                            variant="secondary"
                            className="shrink-0 font-mono text-[10px]"
                          >
                            {item.property.format
                              ? `${item.property.type}:${item.property.format}`
                              : item.property.type}
                          </Badge>
                        )}
                      </div>

                      <div className="text-muted-foreground mb-1.5 pl-6 font-mono text-[11px]">
                        key: {item.key}
                      </div>

                      <p className="text-muted-foreground line-clamp-2 pl-6 text-xs">
                        {item.property.description}
                      </p>
                    </div>

                    <div className="text-muted-foreground flex items-center justify-between pt-2 pl-6 text-[11px]">
                      <span className="text-muted-foreground/80 text-[10px] font-medium">
                        {item.category}
                      </span>
                      {item.property.enum && (
                        <span className="text-muted-foreground/70 text-[10px]">
                          {item.property.enum.length} options
                        </span>
                      )}
                    </div>
                  </label>
                );
              })}
            </div>
          </ScrollArea>

          <DialogFooter className="border-border/60 bg-muted/20 m-0 flex shrink-0 flex-row items-center justify-end gap-3 border-t px-6 py-4">
            <div className="text-muted-foreground mr-auto hidden text-xs sm:block">
              {selectedKeys.size}{' '}
              {selectedKeys.size === 1 ? 'template' : 'templates'} selected
            </div>

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onOpenChange(false)}
              className="px-4 shadow-sm"
            >
              Cancel
            </Button>

            <Button
              type="button"
              size="sm"
              disabled={!canApply}
              onClick={handleConfirm}
              className="bg-primary text-primary-foreground hover:bg-primary/90 min-w-32 px-4 shadow-sm"
            >
              <SlidersHorizontal className="mr-1.5 size-3.5" />
              Add Selected{' '}
              {selectedKeys.size > 0 ? `(${selectedKeys.size})` : ''}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Warning popup when unselecting template with work item values */}
      <ProjectFieldsErrorDialog
        open={confirmDialog.open}
        title={confirmDialog.title}
        description={confirmDialog.description}
        error={confirmDialog.note}
        showCancel={true}
        cancelText="Cancel"
        confirmText="OK"
        onConfirm={confirmDialog.onConfirm}
        onClose={() => setConfirmDialog((prev) => ({ ...prev, open: false }))}
        onOpenChange={(openVal) => {
          if (!openVal) {
            setConfirmDialog((prev) => ({ ...prev, open: false }));
          }
        }}
      />
    </>
  );
}
