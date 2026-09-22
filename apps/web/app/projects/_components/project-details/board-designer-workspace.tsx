'use client';

import { useEffect, useMemo, useState, type DragEvent } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import {
  boardConfigSchema,
  type BoardColumn,
  type BoardConfig,
  type WorkItemStatusTransition,
} from '@repo/types/api/v1';
import type { MemberCheckboxOption } from '@/components/member-checkbox-list';
import { Button } from '@repo/ui/components/ui/button';
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@repo/ui/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { toast } from '@repo/ui/components/ui/sonner';
import {
  ArrowLeftRight,
  Columns3,
  GripVertical,
  Kanban,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  DEFAULT_BOARD_COLUMNS,
  STATUS_META,
} from '@/app/work-items/_helpers/work-item-status';
import { formatLabelWithSpace } from '@/app/_shared/utility';
import {
  updateProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { FormAlertMessage } from '@/components/form-alert-message';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';
import {
  parseBoardDesignerSection,
  type BoardDesignerSection,
} from '@/lib/search-params';
import {
  BoardMovementRulesDialog,
  type BoardRuleTeamOption,
} from '@/app/projects/_components/project-details/board-movement-rules-dialog';
import {
  StatusTransitionRulesDialog,
  type StatusTransitionRuleKey,
} from '@/app/projects/_components/project-details/status-transition-rules-dialog';

type BoardDesignerWorkspaceProps = {
  readonly project: Project;
  readonly canEdit: boolean;
  readonly currentUserId?: string | null;
  readonly teams?: readonly BoardRuleTeamOption[];
  readonly members?: readonly MemberCheckboxOption[];
};

const BOARD_SECTION_TABS = [
  { id: 'columns' as const, label: 'Columns', icon: Columns3 },
  { id: 'rules' as const, label: 'Transition rules', icon: ArrowLeftRight },
] as const;

const NEW_COLUMN_DEFAULT_NAME = 'New column';

function cloneConfig(config: BoardConfig): BoardConfig {
  const columns = config.columns.map((column) => ({ ...column }));
  if (config.version === '1') return { version: '1', columns };
  return {
    version: '2',
    columns,
    transitions: config.transitions.map((transition) => ({
      ...transition,
      allowAnyOf: transition.allowAnyOf.map((matcher) => ({ ...matcher })),
    })),
    ...(config.statusTransitions
      ? {
          statusTransitions: config.statusTransitions.map((transition) => ({
            ...transition,
            allowAnyOf: transition.allowAnyOf.map((matcher) => ({
              ...matcher,
            })),
          })),
        }
      : {}),
  };
}

function defaultConfig(): BoardConfig {
  return {
    version: '1',
    columns: DEFAULT_BOARD_COLUMNS.map((column) => ({ ...column })),
  };
}

function validationMessage(config: BoardConfig): string | null {
  const parsed = boardConfigSchema.safeParse(config);
  return parsed.success
    ? null
    : (parsed.error.issues[0]?.message ?? 'Board configuration is invalid.');
}

function columnStatusWashStyle(status: BoardColumn['status']) {
  const meta = STATUS_META[status];
  if (!meta) return undefined;
  return {
    backgroundImage: `linear-gradient(90deg, color-mix(in oklab, ${meta.color} 10%, transparent), transparent 55%)`,
  } as const;
}

function movementRuleCount(config: BoardConfig, columnId: string): number {
  if (config.version !== '2') return 0;
  return config.transitions.filter((rule) => rule.toColumnId === columnId)
    .length;
}

export function BoardDesignerWorkspace({
  project,
  canEdit,
  currentUserId,
  teams = [],
  members = [],
}: Readonly<BoardDesignerWorkspaceProps>) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlBoardSection = parseBoardDesignerSection(
    searchParams.get('boardSection')
  );
  const [boardSection, setBoardSectionState] =
    useState<BoardDesignerSection>(urlBoardSection);
  const { handleMutationError } = useOptimisticLock();
  const initial = useMemo(() => {
    const parsed = boardConfigSchema.safeParse(project.workflow_config);
    if (parsed.success) {
      const config = cloneConfig(parsed.data);
      return {
        config,
        savedConfig: config,
        usesDefault: false,
        invalidPersistedConfig: false,
      };
    }
    return {
      config: defaultConfig(),
      savedConfig: null,
      usesDefault: project.workflow_config == null,
      invalidPersistedConfig: project.workflow_config != null,
    };
  }, [project.workflow_config]);
  const [draft, setDraft] = useState<BoardConfig>(() =>
    cloneConfig(initial.config)
  );
  const [baseline, setBaseline] = useState<BoardConfig>(() =>
    cloneConfig(initial.config)
  );
  const [savedConfig, setSavedConfig] = useState<BoardConfig | null>(
    initial.savedConfig
  );
  const [usesDefault, setUsesDefault] = useState(initial.usesDefault);
  const [invalidPersistedConfig, setInvalidPersistedConfig] = useState(
    initial.invalidPersistedConfig
  );
  const [updatedAt, setUpdatedAt] = useState(project.updated_at);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [messageIsError, setMessageIsError] = useState(false);
  const [deleteColumn, setDeleteColumn] = useState<BoardColumn | null>(null);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [discardDialogOpen, setDiscardDialogOpen] = useState(false);
  const [ruleToRemove, setRuleToRemove] =
    useState<WorkItemStatusTransition | null>(null);
  const [rulesTargetColumn, setRulesTargetColumn] =
    useState<BoardColumn | null>(null);
  const [statusRuleDialogOpen, setStatusRuleDialogOpen] = useState(false);
  const [statusRuleToEdit, setStatusRuleToEdit] =
    useState<StatusTransitionRuleKey | null>(null);
  const [draggedColumnId, setDraggedColumnId] = useState<string | null>(null);
  const [activeDropColumnId, setActiveDropColumnId] = useState<string | null>(
    null
  );
  const [aliceDraftLoaded, setAliceDraftLoaded] = useState(false);
  const [aliceDeletionWarningOpen, setAliceDeletionWarningOpen] =
    useState(false);
  /** Freshly added columns stay pending until renamed away from the default. */
  const [pendingNewColumnIds, setPendingNewColumnIds] = useState(
    () => new Set<string>()
  );

  const draftChanged = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirty = invalidPersistedConfig || draftChanged || aliceDraftLoaded;
  const persistedIds = useMemo(
    () => new Set(savedConfig?.columns.map((column) => column.id) ?? []),
    [savedConfig]
  );
  const currentValidationMessage = validationMessage(draft);
  const feedbackMessage = message ?? (dirty ? currentValidationMessage : null);
  const feedbackIsError = message ? messageIsError : Boolean(feedbackMessage);
  const removedPersistedColumns = useMemo(
    () =>
      savedConfig?.columns.filter(
        (column) =>
          !draft.columns.some((candidate) => candidate.id === column.id)
      ) ?? [],
    [draft.columns, savedConfig]
  );
  const statusTransitions =
    draft.version === '2' ? (draft.statusTransitions ?? []) : [];

  useEffect(() => {
    setBoardSectionState(urlBoardSection);
  }, [urlBoardSection]);

  useEffect(() => {
    const storageKey = `board_draft_${project.id}`;
    const storedDraft = sessionStorage.getItem(storageKey);
    if (!storedDraft) return;

    try {
      const parsed = boardConfigSchema.safeParse(JSON.parse(storedDraft));
      if (parsed.success) {
        setDraft(cloneConfig(parsed.data));
        setAliceDraftLoaded(true);
      }
    } catch {
      // Invalid ephemeral drafts are discarded; the saved/default board stays.
    } finally {
      sessionStorage.removeItem(storageKey);
    }
  }, [project.id]);

  const updateColumn = (id: string, patch: Partial<BoardColumn>) => {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === id ? { ...column, ...patch } : column
      ),
    }));
    if (
      typeof patch.name === 'string' &&
      patch.name.trim() !== NEW_COLUMN_DEFAULT_NAME
    ) {
      setPendingNewColumnIds((current) => {
        if (!current.has(id)) return current;
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
    setMessage(null);
  };

  const setBoardSection = (next: BoardDesignerSection) => {
    setBoardSectionState(next);
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'board');
    if (next === 'columns') {
      params.delete('boardSection');
    } else {
      params.set('boardSection', next);
    }
    const query = params.toString();
    router.push(query ? `${pathname}?${query}` : pathname);
  };

  const addColumn = () => {
    const id = crypto.randomUUID();
    setDraft((current) => ({
      ...current,
      columns: [
        {
          id,
          name: NEW_COLUMN_DEFAULT_NAME,
          status: 'New',
        },
        ...current.columns,
      ],
    }));
    setPendingNewColumnIds((current) => new Set(current).add(id));
    setMessage(null);
    setBoardSection('columns');
  };

  const openAddStatusRule = () => {
    setBoardSection('rules');
    openStatusRuleDialog(null);
  };

  const handlePrimaryAdd = () => {
    if (boardSection === 'rules') {
      openAddStatusRule();
      return;
    }
    addColumn();
  };

  const handleColumnDragStart = (
    event: DragEvent<HTMLElement>,
    columnId: string
  ) => {
    if (!canEdit || isSaving) {
      event.preventDefault();
      return;
    }
    event.dataTransfer.setData('text/plain', columnId);
    event.dataTransfer.effectAllowed = 'move';
    setDraggedColumnId(columnId);
  };

  const handleColumnDragOver = (
    event: DragEvent<HTMLDivElement>,
    columnId: string
  ) => {
    if (!canEdit || isSaving || !draggedColumnId) return;
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
    setActiveDropColumnId(draggedColumnId === columnId ? null : columnId);
  };

  const clearColumnDragState = () => {
    setDraggedColumnId(null);
    setActiveDropColumnId(null);
  };

  const handleColumnDrop = (
    event: DragEvent<HTMLDivElement>,
    targetColumnId: string
  ) => {
    event.preventDefault();
    const sourceColumnId =
      event.dataTransfer.getData('text/plain') || draggedColumnId;

    if (
      canEdit &&
      !isSaving &&
      sourceColumnId &&
      sourceColumnId !== targetColumnId
    ) {
      setDraft((current) => {
        const sourceIndex = current.columns.findIndex(
          (column) => column.id === sourceColumnId
        );
        const targetIndex = current.columns.findIndex(
          (column) => column.id === targetColumnId
        );
        if (sourceIndex < 0 || targetIndex < 0) return current;

        const columns = [...current.columns];
        const [column] = columns.splice(sourceIndex, 1);
        if (!column) return current;
        columns.splice(targetIndex, 0, column);
        return { ...current, columns };
      });
      setMessage(null);
    }

    clearColumnDragState();
  };

  const removeColumn = (column: BoardColumn) => {
    setDraft((current) => {
      const columns = current.columns.filter(
        (candidate) => candidate.id !== column.id
      );
      if (current.version === '1') return { ...current, columns };
      return {
        ...current,
        columns,
        transitions: current.transitions.filter(
          (transition) =>
            transition.fromColumnId !== column.id &&
            transition.toColumnId !== column.id
        ),
      };
    });
    setPendingNewColumnIds((current) => {
      if (!current.has(column.id)) return current;
      const next = new Set(current);
      next.delete(column.id);
      return next;
    });
    setDeleteColumn(null);
    setMessage(null);
  };

  const requestDeleteColumn = (column: BoardColumn) => {
    if (persistedIds.has(column.id)) setDeleteColumn(column);
    else removeColumn(column);
  };

  const openStatusRuleDialog = (rule: StatusTransitionRuleKey | null) => {
    setStatusRuleToEdit(rule);
    setStatusRuleDialogOpen(true);
  };

  const removeStatusTransition = (rule: WorkItemStatusTransition) => {
    setDraft((current) => {
      if (current.version === '1') return current;
      return {
        ...current,
        statusTransitions: (current.statusTransitions ?? []).filter(
          (candidate) =>
            candidate.fromStatus !== rule.fromStatus ||
            candidate.toStatus !== rule.toStatus
        ),
      };
    });
    setRuleToRemove(null);
    setMessage(null);
  };

  const discardChanges = () => {
    setDraft(cloneConfig(baseline));
    setPendingNewColumnIds(new Set());
    setAliceDraftLoaded(false);
    setMessage(null);
    setDiscardDialogOpen(false);
  };

  const saveWorkflowConfig = async (workflowConfig: BoardConfig | null) => {
    const existingConfig =
      typeof project.workflow_config === 'object' &&
      project.workflow_config !== null
        ? (project.workflow_config as Record<string, unknown>)
        : {};

    const mergedWorkflowConfig = workflowConfig
      ? {
          ...existingConfig,
          ...workflowConfig,
        }
      : null;

    const pendingFields = { workflow_config: mergedWorkflowConfig };
    return runLockedMutationOrThrow({
      mutate: () => updateProject(project.id, pendingFields, updatedAt),
      handleMutationError,
      entityType: 'project',
      entityId: project.id,
      expectedUpdatedAt: updatedAt,
      pendingFields,
      currentUserId,
    });
  };

  const performSave = async () => {
    if (!canEdit || isSaving) return;
    const parsed = boardConfigSchema.safeParse(draft);
    if (!parsed.success) {
      setMessage(validationMessage(draft));
      setMessageIsError(true);
      return;
    }
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await saveWorkflowConfig(parsed.data);
      if (!result) return;
      const saved = cloneConfig(parsed.data);
      setDraft(cloneConfig(saved));
      setBaseline(cloneConfig(saved));
      setSavedConfig(cloneConfig(saved));
      setUsesDefault(false);
      setInvalidPersistedConfig(false);
      setAliceDraftLoaded(false);
      setPendingNewColumnIds(new Set());
      setUpdatedAt(result.updated_at);
      setMessage('Board configuration saved.');
      setMessageIsError(false);
      toast.success('Board configuration saved.');
      router.refresh();
    } catch (error) {
      const detail =
        error instanceof Error
          ? error.message
          : 'Failed to save board configuration.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSave = async () => {
    if (aliceDraftLoaded && removedPersistedColumns.length > 0) {
      setAliceDeletionWarningOpen(true);
      return;
    }
    await performSave();
  };

  const handleReset = async () => {
    if (!canEdit || isSaving || usesDefault) return;
    setIsSaving(true);
    setMessage(null);
    try {
      const result = await saveWorkflowConfig(null);
      if (!result) return;
      const nextDefault = defaultConfig();
      setDraft(cloneConfig(nextDefault));
      setBaseline(cloneConfig(nextDefault));
      setSavedConfig(null);
      setUsesDefault(true);
      setInvalidPersistedConfig(false);
      setAliceDraftLoaded(false);
      setPendingNewColumnIds(new Set());
      setUpdatedAt(result.updated_at);
      setResetDialogOpen(false);
      setMessage('The project now uses the default board.');
      setMessageIsError(false);
      toast.success('Reset to the default board.');
      router.refresh();
    } catch (error) {
      const detail =
        error instanceof Error ? error.message : 'Failed to reset the board.';
      setMessage(detail);
      setMessageIsError(true);
      toast.error(detail);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <div className="flex items-center gap-2">
          <Kanban className="text-primary size-5" />
          <h2 className="text-foreground text-xl font-semibold tracking-tight">
            Board configuration
          </h2>
        </div>
        <p className="text-muted-foreground mt-1 max-w-3xl text-sm leading-relaxed">
          Name, map, and order the columns shown on this project board. Every
          normal work-item status must remain represented.
        </p>
      </div>
      {!canEdit && (
        <div className="border-border bg-muted/40 text-muted-foreground flex items-center gap-3 rounded-lg border p-3 text-sm">
          <Lock className="size-4 shrink-0 text-amber-500" />
          <span>
            You have view-only access. Only project managers and administrators
            can edit and save this board configuration.
          </span>
        </div>
      )}
      {invalidPersistedConfig && (
        <FormAlertMessage
          message="The saved board configuration is invalid. The safe default is shown; reset or save a valid configuration to repair it."
          isError
        />
      )}
      {aliceDraftLoaded && (
        <div className="border-primary/20 bg-primary/5 text-foreground rounded-lg border p-3 text-sm">
          Draft generated by Alice. Review it carefully, then save when ready.
        </div>
      )}
      <FormAlertMessage message={feedbackMessage} isError={feedbackIsError} />
      <div className="flex flex-wrap items-center justify-between gap-3">
        <RegistryTabSwitcher
          tabs={BOARD_SECTION_TABS}
          value={boardSection}
          onChange={setBoardSection}
          aria-label="Board configuration section"
        />
        {canEdit ? (
          <div className="flex items-center gap-1.5">
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              title="Reset to default board"
              aria-label="Reset to default board"
              onClick={() => setResetDialogOpen(true)}
              disabled={isSaving || usesDefault}
            >
              <RotateCcw className="size-4" />
            </Button>
            {draftChanged ? (
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8"
                title="Discard unsaved changes"
                aria-label="Discard"
                onClick={() => setDiscardDialogOpen(true)}
                disabled={isSaving}
              >
                <Undo2 className="size-4" />
              </Button>
            ) : null}
            <Button
              type="button"
              variant="outline"
              size="icon"
              className="size-8"
              title="Save board configuration"
              aria-label="Save changes"
              onClick={handleSave}
              disabled={isSaving || !dirty}
            >
              <Save className="size-4" />
            </Button>
            <Button
              type="button"
              size="icon"
              className="size-8"
              title={boardSection === 'rules' ? 'Add rule' : 'Add column'}
              aria-label={boardSection === 'rules' ? 'Add rule' : 'Add column'}
              onClick={handlePrimaryAdd}
              disabled={isSaving}
            >
              <Plus className="size-4" />
            </Button>
          </div>
        ) : null}
      </div>
      {boardSection === 'columns' ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Columns</CardTitle>
            <CardDescription>
              Column IDs are stable and stay unchanged when renamed or
              reordered.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {draft.columns.map((column, index) => {
              const isPendingNew = pendingNewColumnIds.has(column.id);
              const ruleCount = movementRuleCount(draft, column.id);
              return (
                <div
                  key={column.id}
                  style={
                    isPendingNew
                      ? undefined
                      : columnStatusWashStyle(column.status)
                  }
                  className={cn(
                    'grid gap-3 rounded-lg border p-3 transition-colors md:grid-cols-[auto_minmax(0,1fr)_minmax(12rem,0.6fr)_auto] md:items-end',
                    isPendingNew
                      ? 'border-primary/60 bg-muted/30 border-dashed'
                      : cn(
                          'border-border',
                          STATUS_META[column.status]?.borderClass
                        ),
                    activeDropColumnId === column.id &&
                      'border-primary/50 border-dashed'
                  )}
                  onDragOver={(event) => handleColumnDragOver(event, column.id)}
                  onDrop={(event) => handleColumnDrop(event, column.id)}
                >
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    title={`Drag ${column.name} to reorder`}
                    aria-label={`Drag ${column.name} to reorder`}
                    draggable={canEdit && !isSaving}
                    onDragStart={(event) =>
                      handleColumnDragStart(event, column.id)
                    }
                    onDragEnd={clearColumnDragState}
                    disabled={!canEdit || isSaving}
                    className="text-muted-foreground cursor-grab self-center active:cursor-grabbing disabled:cursor-not-allowed md:mb-0.5"
                  >
                    <GripVertical />
                  </Button>
                  <div className="space-y-1.5">
                    <Label htmlFor={'board-column-name-' + column.id}>
                      Column name
                    </Label>
                    <Input
                      id={'board-column-name-' + column.id}
                      aria-label={'Column name ' + (index + 1)}
                      value={column.name}
                      onChange={(event) =>
                        updateColumn(column.id, { name: event.target.value })
                      }
                      disabled={!canEdit || isSaving}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={'board-column-status-' + column.id}>
                      Status
                    </Label>
                    <Select
                      value={column.status}
                      onValueChange={(status) =>
                        updateColumn(column.id, {
                          status: status as BoardColumn['status'],
                        })
                      }
                      disabled={!canEdit || isSaving}
                    >
                      <SelectTrigger
                        id={'board-column-status-' + column.id}
                        aria-label={'Status for ' + column.name}
                        title={'Status for ' + column.name}
                        className="w-full"
                      >
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {BOARD_WORK_ITEM_STATUSES.map((status) => (
                          <SelectItem key={status} value={status}>
                            {status}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex items-center gap-1">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      title={`Movement rules for ${column.name}`}
                      aria-label={`${ruleCount} rules for ${column.name}`}
                      onClick={() => setRulesTargetColumn(column)}
                      disabled={
                        !canEdit || isSaving || draft.columns.length < 2
                      }
                    >
                      {ruleCount} {ruleCount === 1 ? 'rule' : 'rules'}
                    </Button>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      title={`Delete ${column.name}`}
                      aria-label={`Delete ${column.name}`}
                      onClick={() => requestDeleteColumn(column)}
                      disabled={!canEdit || isSaving}
                      className="text-destructive hover:text-destructive"
                    >
                      <Trash2 />
                    </Button>
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Status transition rules</CardTitle>
            <CardDescription>
              Restrict who may change a work item from one status to another.
              These rules are separate from movement between board columns.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {statusTransitions.length === 0 ? (
              <p className="text-muted-foreground text-sm">
                No status transition rules are configured. Use Add to create
                one.
              </p>
            ) : (
              statusTransitions.map((rule) => {
                const fromLabel = formatLabelWithSpace(rule.fromStatus);
                const toLabel = formatLabelWithSpace(rule.toStatus);
                return (
                  <div
                    key={`${rule.fromStatus}:${rule.toStatus}`}
                    className="border-border bg-muted/20 flex flex-wrap items-center justify-between gap-3 rounded-lg border p-3"
                  >
                    <div>
                      <p className="text-sm font-medium">
                        {fromLabel} → {toLabel}
                      </p>
                      <p className="text-muted-foreground text-xs">
                        {rule.allowAnyOf.length} allowed role, team, or
                        individual
                        {rule.allowAnyOf.length === 1 ? '' : 's'}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        title={`Edit status transition ${fromLabel} to ${toLabel}`}
                        aria-label={`Edit status transition ${fromLabel} to ${toLabel}`}
                        onClick={() => openStatusRuleDialog(rule)}
                        disabled={!canEdit || isSaving}
                      >
                        Edit
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        title={`Remove status transition ${fromLabel} to ${toLabel}`}
                        aria-label={`Remove status transition ${fromLabel} to ${toLabel}`}
                        onClick={() => setRuleToRemove(rule)}
                        disabled={!canEdit || isSaving}
                        className="text-destructive hover:text-destructive"
                      >
                        Remove
                      </Button>
                    </div>
                  </div>
                );
              })
            )}
          </CardContent>
        </Card>
      )}
      <Dialog
        open={Boolean(deleteColumn)}
        onOpenChange={(open) => !open && setDeleteColumn(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete saved board column?</DialogTitle>
            <DialogDescription>
              Work items saved in this column will fall back to the first
              remaining column mapped to the same status. No work-item records
              will be changed by this deletion.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDeleteColumn(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() => deleteColumn && removeColumn(deleteColumn)}
            >
              Delete column
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reset to the default board?</DialogTitle>
            <DialogDescription>
              This saves a null workflow configuration. Existing work items are
              not modified and stale column IDs continue to use the safe
              fallback.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setResetDialogOpen(false)}
            >
              Cancel
            </Button>
            <Button type="button" onClick={handleReset} disabled={isSaving}>
              Reset board
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog open={discardDialogOpen} onOpenChange={setDiscardDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Discard unsaved changes?</DialogTitle>
            <DialogDescription>
              Your column and rule edits since the last save will be lost.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setDiscardDialogOpen(false)}
            >
              Keep editing
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={discardChanges}
            >
              Discard
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={Boolean(ruleToRemove)}
        onOpenChange={(open) => !open && setRuleToRemove(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Remove status transition rule?</DialogTitle>
            <DialogDescription>
              {ruleToRemove
                ? `Anyone will be able to move items from ${formatLabelWithSpace(ruleToRemove.fromStatus)} to ${formatLabelWithSpace(ruleToRemove.toStatus)} unless another rule applies.`
                : null}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setRuleToRemove(null)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={() =>
                ruleToRemove && removeStatusTransition(ruleToRemove)
              }
            >
              Remove rule
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <Dialog
        open={aliceDeletionWarningOpen}
        onOpenChange={setAliceDeletionWarningOpen}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Save a draft that removes saved columns?</DialogTitle>
            <DialogDescription>
              The Alice draft removes{' '}
              {removedPersistedColumns.map((column) => column.name).join(', ')}.
              Work items in those columns will use the existing safe status
              fallback. No work-item records will be changed by this save.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setAliceDeletionWarningOpen(false)}
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={async () => {
                setAliceDeletionWarningOpen(false);
                await performSave();
              }}
            >
              Save board draft
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      <BoardMovementRulesDialog
        config={draft}
        targetColumn={rulesTargetColumn}
        teams={teams}
        members={members}
        open={Boolean(rulesTargetColumn)}
        disabled={!canEdit || isSaving}
        onOpenChange={(open) => !open && setRulesTargetColumn(null)}
        onConfigChange={(config) => {
          setDraft(config);
          setMessage(null);
        }}
      />
      <StatusTransitionRulesDialog
        config={draft}
        ruleToEdit={statusRuleToEdit}
        teams={teams}
        members={members}
        open={statusRuleDialogOpen}
        disabled={!canEdit || isSaving}
        onOpenChange={(open) => {
          setStatusRuleDialogOpen(open);
          if (!open) setStatusRuleToEdit(null);
        }}
        onConfigChange={(config) => {
          setDraft(config);
          setMessage(null);
        }}
      />
    </div>
  );
}
