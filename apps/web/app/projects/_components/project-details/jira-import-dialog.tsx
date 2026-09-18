'use client';

import { useCallback, useEffect, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Info,
  Loader2,
  RefreshCw,
  Trash2,
} from '@repo/ui/lib/icons';
import {
  CANONICAL_HIERARCHY_ORDER,
  type WorkItemType,
  WorkItemTypeEnum,
} from '@repo/types';
import {
  JiraImportActionEnum,
  type JiraImportAction,
  type JiraImportConfig,
  type ProjectWorkflowConfig,
} from '@repo/types/api/v1';
import {
  importJiraIssues,
  previewJiraImport,
} from '@/app/projects/_services/projects.jira.mutations.client';
import type { Project } from '@/app/projects/_services/projects.mutations.client';
import { FormAlertMessage } from '@/components/form-alert-message';

interface JiraImportDialogProps {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- props callback
  readonly onOpenChange: (open: boolean) => void;
  readonly project: Project;
  // eslint-disable-next-line no-unused-vars -- props callback
  readonly onImportSuccess?: (importedCount: number) => void;
}

interface TypeMappingState {
  action: JiraImportAction;
  targetType: WorkItemType;
}

/* eslint-disable no-unused-vars */
export enum JiraKnownIssueType {
  Epic = 'epic',
  Feature = 'feature',
  Story = 'story',
  UserStory = 'user story',
  Task = 'task',
  Subtask = 'subtask',
  SubTaskHyphen = 'sub-task',
  Bug = 'bug',
  Defect = 'defect',
  Issue = 'issue',
}
/* eslint-enable no-unused-vars */

const DEFAULT_JIRA_TYPE_MAPPING: Readonly<Record<string, WorkItemType>> = {
  [JiraKnownIssueType.Epic]: WorkItemTypeEnum.Epic,
  [JiraKnownIssueType.Feature]: WorkItemTypeEnum.Feature,
  [JiraKnownIssueType.Story]: WorkItemTypeEnum.Story,
  [JiraKnownIssueType.UserStory]: WorkItemTypeEnum.Story,
  [JiraKnownIssueType.Task]: WorkItemTypeEnum.Task,
  [JiraKnownIssueType.Subtask]: WorkItemTypeEnum.Task,
  [JiraKnownIssueType.SubTaskHyphen]: WorkItemTypeEnum.Task,
  [JiraKnownIssueType.Bug]: WorkItemTypeEnum.Issue,
  [JiraKnownIssueType.Defect]: WorkItemTypeEnum.Issue,
  [JiraKnownIssueType.Issue]: WorkItemTypeEnum.Issue,
};

function guessDefaultMapping(jiraType: string): TypeMappingState {
  const normalized = jiraType.trim().toLowerCase();
  const targetType =
    DEFAULT_JIRA_TYPE_MAPPING[normalized] ?? WorkItemTypeEnum.Task;
  return {
    action: JiraImportActionEnum.Map,
    targetType,
  };
}

function hierarchyRecordToArray(
  record?: Record<string, string | null> | null
): WorkItemType[] | null {
  if (!record || Object.keys(record).length === 0) return null;
  const parents = Object.keys(record);
  const children = new Set(Object.values(record).filter(Boolean));
  let current: string | null =
    parents.find((p) => !children.has(p)) ?? parents[0] ?? null;
  const result: WorkItemType[] = [];
  const visited = new Set<string>();
  while (current && !visited.has(current)) {
    visited.add(current);
    if (CANONICAL_HIERARCHY_ORDER.includes(current as WorkItemType)) {
      result.push(current as WorkItemType);
    }
    current = record[current] ?? null;
  }
  return result.length > 0 ? result : null;
}

export function JiraImportDialog({
  open,
  onOpenChange,
  project,
  onImportSuccess,
}: Readonly<JiraImportDialogProps>) {
  const [isLoadingPreview, setIsLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState<string | null>(null);
  const [isImporting, setIsImporting] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [issueTypes, setIssueTypes] = useState<string[]>([]);
  const [issueCount, setIssueCount] = useState<number>(0);

  const [mappings, setMappings] = useState<Record<string, TypeMappingState>>(
    {}
  );
  const [hierarchy, setHierarchy] = useState<WorkItemType[]>([]);

  const loadPreview = useCallback(async () => {
    setIsLoadingPreview(true);
    setPreviewError(null);
    setImportError(null);

    try {
      const preview = await previewJiraImport(project.id);
      const types = preview.issueTypes ?? [];
      setIssueTypes(types);
      setIssueCount(preview.issues?.length ?? 0);

      const initialMappings: Record<string, TypeMappingState> = {};
      types.forEach((type) => {
        initialMappings[type] = guessDefaultMapping(type);
      });
      setMappings(initialMappings);

      const existingConfig = project.workflow_config as
        ProjectWorkflowConfig | null | undefined;
      const parsedHierarchy = hierarchyRecordToArray(existingConfig?.hierarchy);
      let initialHierarchy: WorkItemType[];
      if (parsedHierarchy && parsedHierarchy.length > 0) {
        initialHierarchy = parsedHierarchy;
      } else if (
        existingConfig?.work_item_types &&
        existingConfig.work_item_types.length > 0
      ) {
        initialHierarchy = [...existingConfig.work_item_types];
      } else {
        initialHierarchy = [...CANONICAL_HIERARCHY_ORDER];
      }
      setHierarchy(initialHierarchy);
    } catch (err) {
      setPreviewError(
        err instanceof Error ? err.message : 'Failed to scan Jira project.'
      );
    } finally {
      setIsLoadingPreview(false);
    }
  }, [project.id, project.workflow_config]);

  useEffect(() => {
    if (!open) {
      return;
    }

    void loadPreview();
  }, [open, loadPreview]);

  const handleActionChange = (jiraType: string, action: JiraImportAction) => {
    setMappings((prev) => {
      const current = prev[jiraType] ?? guessDefaultMapping(jiraType);
      return {
        ...prev,
        [jiraType]: { ...current, action },
      };
    });
  };

  const handleTargetTypeChange = (
    jiraType: string,
    targetType: WorkItemType
  ) => {
    setMappings((prev) => {
      const current = prev[jiraType] ?? guessDefaultMapping(jiraType);
      return {
        ...prev,
        [jiraType]: { ...current, targetType },
      };
    });
  };

  const handleMoveHierarchyItem = (index: number, direction: 'up' | 'down') => {
    const targetIndex = direction === 'up' ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= hierarchy.length) return;
    const next = [...hierarchy];
    const item = next[index];
    const targetItem = next[targetIndex];
    if (item && targetItem) {
      next[index] = targetItem;
      next[targetIndex] = item;
      setHierarchy(next);
    }
  };

  const handleRemoveHierarchyItem = (index: number) => {
    if (hierarchy.length <= 1) return;
    setHierarchy(hierarchy.filter((_, i) => i !== index));
  };

  const handleAddHierarchyItem = (type: WorkItemType) => {
    if (hierarchy.includes(type)) return;
    setHierarchy([...hierarchy, type]);
  };

  const unusedHierarchyTypes = CANONICAL_HIERARCHY_ORDER.filter(
    (t) => !hierarchy.includes(t)
  );

  const handleStartImport = async () => {
    if (hierarchy.length === 0) {
      setImportError('At least one level must exist in the hierarchy.');
      return;
    }

    setIsImporting(true);
    setImportError(null);

    const config: JiraImportConfig = {
      typeMappings: Object.fromEntries(
        Object.entries(mappings).map(([jiraType, mapping]) => [
          jiraType,
          {
            action: mapping.action,
            targetType:
              mapping.action === 'map' ? mapping.targetType : undefined,
          },
        ])
      ),
      hierarchy,
    };

    try {
      const result = await importJiraIssues(project.id, config);
      onImportSuccess?.(result.importedCount);
      onOpenChange(false);
    } catch (err) {
      setImportError(
        err instanceof Error ? err.message : 'Jira import failed.'
      );
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex max-h-[90vh] w-full flex-col gap-0 overflow-hidden p-0 sm:max-w-4xl lg:max-w-5xl"
        dismissOnOutsideClick={false}
        onEscapeKeyDown={(e) => e.preventDefault()}
      >
        <DialogHeader className="shrink-0 border-b p-6 pb-4">
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <RefreshCw className="text-primary h-5 w-5" />
            Jira Import & Hierarchy Mapping
          </DialogTitle>
          <DialogDescription>
            Map Jira issue types to ALICE work-item types and configure the
            target hierarchy for imported items.
          </DialogDescription>
        </DialogHeader>

        <div className="no-scrollbar min-h-0 flex-1 space-y-5 overflow-y-auto p-6">
          {isLoadingPreview && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Scanning issues from Jira project{' '}
                <span className="font-semibold">
                  {project.jira_project_key}
                </span>
                ...
              </p>
            </div>
          )}

          {previewError && (
            <div className="space-y-3 py-4">
              <FormAlertMessage message={previewError} isError={true} />
              <Button
                variant="outline"
                size="sm"
                onClick={() => void loadPreview()}
                className="mt-2"
              >
                Retry
              </Button>
            </div>
          )}

          {!isLoadingPreview && !previewError && issueTypes.length === 0 && (
            <div className="rounded-md border p-6 text-center">
              <p className="text-muted-foreground text-sm">
                No issues found in Jira project {project.jira_project_key}.
              </p>
            </div>
          )}

          {!isLoadingPreview && !previewError && issueTypes.length > 0 && (
            <>
              <div className="bg-muted/30 flex items-center justify-between rounded-lg border p-3 text-sm">
                <div>
                  <span className="font-medium">Jira Project: </span>
                  <span className="text-foreground font-mono font-bold">
                    {project.jira_project_key}
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">
                  Found{' '}
                  <span className="text-foreground font-semibold">
                    {issueCount}
                  </span>{' '}
                  issues across{' '}
                  <span className="text-foreground font-semibold">
                    {issueTypes.length}
                  </span>{' '}
                  types
                </div>
              </div>

              {/* Type Mapping Section */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">
                    1. Issue Type Mappings
                  </h4>
                  <p className="text-muted-foreground text-xs">
                    Choose how each Jira issue type is handled during import.
                  </p>
                </div>

                <div className="divide-border divide-y rounded-md border">
                  {issueTypes.map((jiraType) => {
                    const current =
                      mappings[jiraType] ?? guessDefaultMapping(jiraType);
                    return (
                      <div
                        key={jiraType}
                        className="flex items-center justify-between gap-4 px-4 py-2.5"
                      >
                        <div className="min-w-36 shrink-0">
                          <span className="bg-muted text-foreground rounded px-2.5 py-1 text-xs font-semibold">
                            {jiraType}
                          </span>
                        </div>

                        <div className="flex shrink-0 items-center justify-end gap-3">
                          <Select
                            value={current.action}
                            onValueChange={(val) =>
                              handleActionChange(
                                jiraType,
                                val as JiraImportAction
                              )
                            }
                          >
                            <SelectTrigger className="h-8 w-48 shrink-0 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value={JiraImportActionEnum.Map}>
                                Map to ALICE type
                              </SelectItem>
                              <SelectItem value={JiraImportActionEnum.Ignore}>
                                Ignore (Skip)
                              </SelectItem>
                              <SelectItem value={JiraImportActionEnum.Drop}>
                                Drop type (Fallback to Issue)
                              </SelectItem>
                            </SelectContent>
                          </Select>

                          {current.action === JiraImportActionEnum.Map && (
                            <div className="flex shrink-0 items-center gap-2">
                              <ArrowRight className="text-muted-foreground h-3.5 w-3.5 shrink-0" />
                              <Select
                                value={current.targetType}
                                onValueChange={(val) =>
                                  handleTargetTypeChange(
                                    jiraType,
                                    val as WorkItemType
                                  )
                                }
                              >
                                <SelectTrigger className="h-8 w-36 shrink-0 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {CANONICAL_HIERARCHY_ORDER.map((t) => (
                                    <SelectItem key={t} value={t}>
                                      {t}
                                    </SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          )}

                          {current.action === JiraImportActionEnum.Ignore && (
                            <span className="text-muted-foreground w-44 shrink-0 text-right text-xs italic">
                              Skipped (parent cleared)
                            </span>
                          )}

                          {current.action === JiraImportActionEnum.Drop && (
                            <span className="text-muted-foreground w-44 shrink-0 text-right text-xs italic">
                              Issue (parent cleared)
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Hierarchy Configuration Section */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <div>
                    <h4 className="text-sm font-semibold">
                      2. ALICE Target Hierarchy
                    </h4>
                    <p className="text-muted-foreground text-xs">
                      Define the parent-to-child hierarchy for this project.
                    </p>
                  </div>
                  {unusedHierarchyTypes.length > 0 && (
                    <Select
                      onValueChange={(val) =>
                        handleAddHierarchyItem(val as WorkItemType)
                      }
                    >
                      <SelectTrigger className="h-8 w-32 text-xs">
                        <SelectValue placeholder="+ Add Level" />
                      </SelectTrigger>
                      <SelectContent>
                        {unusedHierarchyTypes.map((t) => (
                          <SelectItem key={t} value={t}>
                            + {t}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  )}
                </div>

                <div className="space-y-2 rounded-md border p-3">
                  <div className="flex flex-wrap items-center gap-1.5 pb-2 text-xs">
                    <span className="text-muted-foreground font-medium">
                      Hierarchy Preview:{' '}
                    </span>
                    {hierarchy.map((type, idx) => (
                      <span
                        key={type}
                        className="inline-flex items-center gap-1"
                      >
                        <span className="bg-primary/10 text-primary rounded px-2 py-0.5 font-semibold">
                          {type}
                        </span>
                        {idx < hierarchy.length - 1 && (
                          <ArrowRight className="text-muted-foreground h-3 w-3" />
                        )}
                      </span>
                    ))}
                  </div>

                  <div className="divide-border divide-y text-xs">
                    {hierarchy.map((type, idx) => (
                      <div
                        key={type}
                        className="flex items-center justify-between py-1.5"
                      >
                        <span className="flex items-center gap-2">
                          <span className="text-muted-foreground font-mono">
                            Level {idx + 1}:
                          </span>
                          <span className="text-foreground font-semibold">
                            {type}
                          </span>
                        </span>

                        <div className="flex items-center gap-1">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === 0}
                            onClick={() => handleMoveHierarchyItem(idx, 'up')}
                            className="h-6 w-6"
                            title="Move Up"
                          >
                            <ArrowUp className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={idx === hierarchy.length - 1}
                            onClick={() => handleMoveHierarchyItem(idx, 'down')}
                            className="h-6 w-6"
                            title="Move Down"
                          >
                            <ArrowDown className="h-3 w-3" />
                          </Button>
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            disabled={hierarchy.length <= 1}
                            onClick={() => handleRemoveHierarchyItem(idx)}
                            className="text-destructive hover:text-destructive h-6 w-6"
                            title="Remove Level"
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Rules Notice */}
              <div className="bg-muted/40 flex items-start gap-2.5 rounded-lg border p-3 text-xs">
                <Info className="text-primary mt-0.5 h-4 w-4 shrink-0" />
                <div className="text-muted-foreground space-y-1">
                  <p>
                    <strong className="text-foreground">
                      Hierarchy rules:
                    </strong>{' '}
                    Parent-child links are established strictly according to the
                    configured hierarchy. If a parent issue is ignored or of an
                    invalid type, its children will be imported with their
                    parent link cleared (
                    <code className="text-[11px]">parent_id = null</code>).
                  </p>
                </div>
              </div>

              {importError && (
                <FormAlertMessage message={importError} isError={true} />
              )}
            </>
          )}
        </div>

        <DialogFooter className="bg-background flex shrink-0 items-center justify-end gap-2 border-t p-4 sm:px-6">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isImporting}
          >
            Cancel
          </Button>
          <Button
            type="button"
            onClick={() => void handleStartImport()}
            disabled={
              isImporting ||
              isLoadingPreview ||
              Boolean(previewError) ||
              issueTypes.length === 0
            }
            className="bg-emerald-600 text-white hover:bg-emerald-700"
          >
            {isImporting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Importing...
              </>
            ) : (
              'Start Import'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
