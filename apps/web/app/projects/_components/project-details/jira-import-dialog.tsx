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
} from '@repo/types';
import type {
  JiraImportAction,
  JiraImportConfig,
  ProjectWorkflowConfig,
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

function guessDefaultMapping(jiraType: string): TypeMappingState {
  const normalized = jiraType.trim().toLowerCase();
  if (normalized === 'epic') {
    return { action: 'map', targetType: 'Epic' };
  }
  if (normalized === 'feature') {
    return { action: 'map', targetType: 'Feature' };
  }
  if (normalized === 'story' || normalized === 'user story') {
    return { action: 'map', targetType: 'Story' };
  }
  if (normalized === 'task' || normalized === 'subtask' || normalized === 'sub-task') {
    return { action: 'map', targetType: 'Task' };
  }
  if (normalized === 'bug' || normalized === 'defect' || normalized === 'issue') {
    return { action: 'map', targetType: 'Issue' };
  }
  return { action: 'map', targetType: 'Task' };
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

  const [mappings, setMappings] = useState<Record<string, TypeMappingState>>({});
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
        | ProjectWorkflowConfig
        | null
        | undefined;
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

  const handleTargetTypeChange = (jiraType: string, targetType: WorkItemType) => {
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
            targetType: mapping.action === 'map' ? mapping.targetType : undefined,
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
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-xl font-bold">
            <RefreshCw className="text-primary h-5 w-5" />
            Jira Import & Hierarchy Mapping
          </DialogTitle>
          <DialogDescription>
            Map Jira issue types to ALICE work-item types and configure the target hierarchy for imported items.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-2">
          {isLoadingPreview && (
            <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
              <Loader2 className="text-primary h-8 w-8 animate-spin" />
              <p className="text-muted-foreground text-sm">
                Scanning issues from Jira project <span className="font-semibold">{project.jira_project_key}</span>...
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
                  <span className="font-mono font-bold text-foreground">
                    {project.jira_project_key}
                  </span>
                </div>
                <div className="text-muted-foreground text-xs">
                  Found <span className="font-semibold text-foreground">{issueCount}</span> issues across{' '}
                  <span className="font-semibold text-foreground">{issueTypes.length}</span> types
                </div>
              </div>

              {/* Type Mapping Section */}
              <div className="space-y-3">
                <div>
                  <h4 className="text-sm font-semibold">1. Issue Type Mappings</h4>
                  <p className="text-muted-foreground text-xs">
                    Choose how each Jira issue type is handled during import.
                  </p>
                </div>

                <div className="divide-border rounded-md border divide-y">
                  {issueTypes.map((jiraType) => {
                    const current = mappings[jiraType] ?? guessDefaultMapping(jiraType);
                    return (
                      <div
                        key={jiraType}
                        className="flex flex-col gap-3 p-3 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div className="min-w-36">
                          <span className="bg-muted rounded px-2 py-1 text-xs font-semibold text-foreground">
                            {jiraType}
                          </span>
                        </div>

                        <div className="flex flex-1 flex-wrap items-center gap-2">
                          <Select
                            value={current.action}
                            onValueChange={(val) =>
                              handleActionChange(jiraType, val as JiraImportAction)
                            }
                          >
                            <SelectTrigger className="h-8 w-44 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="map">Map to ALICE type</SelectItem>
                              <SelectItem value="ignore">Ignore (Skip)</SelectItem>
                              <SelectItem value="drop">Drop type (Fallback to Issue)</SelectItem>
                            </SelectContent>
                          </Select>

                          {current.action === 'map' && (
                            <div className="flex items-center gap-1.5">
                              <ArrowRight className="text-muted-foreground h-3.5 w-3.5" />
                              <Select
                                value={current.targetType}
                                onValueChange={(val) =>
                                  handleTargetTypeChange(jiraType, val as WorkItemType)
                                }
                              >
                                <SelectTrigger className="h-8 w-32 text-xs">
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

                          {current.action === 'ignore' && (
                            <span className="text-muted-foreground text-xs italic">
                              Issues skipped; children have parent cleared.
                            </span>
                          )}

                          {current.action === 'drop' && (
                            <span className="text-muted-foreground text-xs italic">
                              Imported as Issue with parent cleared.
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
                    <h4 className="text-sm font-semibold">2. ALICE Target Hierarchy</h4>
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
                    <span className="text-muted-foreground font-medium">Hierarchy Preview: </span>
                    {hierarchy.map((type, idx) => (
                      <span key={type} className="inline-flex items-center gap-1">
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
                          <span className="font-semibold text-foreground">
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
                <div className="space-y-1 text-muted-foreground">
                  <p>
                    <strong className="text-foreground">Hierarchy rules: </strong>
                    Parent-child links are established strictly according to the configured hierarchy.
                    If a parent issue is ignored or of an invalid type, its children will be imported with their parent link cleared (<code className="text-[11px]">parent_id = null</code>).
                  </p>
                </div>
              </div>

              {importError && (
                <FormAlertMessage message={importError} isError={true} />
              )}
            </>
          )}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
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
