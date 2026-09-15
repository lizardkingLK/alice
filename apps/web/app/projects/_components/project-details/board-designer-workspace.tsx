'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { BOARD_WORK_ITEM_STATUSES } from '@repo/types';
import {
  boardConfigSchema,
  type BoardColumn,
  type BoardConfig,
} from '@repo/types/api/v1';
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
  ArrowDown,
  ArrowUp,
  Kanban,
  Lock,
  Plus,
  RotateCcw,
  Save,
  Trash2,
  Undo2,
} from '@repo/ui/lib/icons';
import { DEFAULT_BOARD_COLUMNS } from '@/app/work-items/_helpers/work-item-status';
import {
  updateProject,
  type Project,
} from '@/app/projects/_services/projects.mutations.client';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { FormAlertMessage } from '@/components/form-alert-message';
import { runLockedMutationOrThrow } from '@/lib/optimistic-lock/run-locked-mutation';

type BoardDesignerWorkspaceProps = {
  readonly project: Project;
  readonly canEdit: boolean;
  readonly currentUserId?: string | null;
};

function cloneConfig(config: BoardConfig): BoardConfig {
  return {
    version: '1',
    columns: config.columns.map((column) => ({ ...column })),
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

export function BoardDesignerWorkspace({
  project,
  canEdit,
  currentUserId,
}: Readonly<BoardDesignerWorkspaceProps>) {
  const router = useRouter();
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

  const draftChanged = JSON.stringify(draft) !== JSON.stringify(baseline);
  const dirty = invalidPersistedConfig || draftChanged;
  const persistedIds = useMemo(
    () => new Set(savedConfig?.columns.map((column) => column.id) ?? []),
    [savedConfig]
  );
  const currentValidationMessage = validationMessage(draft);
  const feedbackMessage = message ?? (dirty ? currentValidationMessage : null);
  const feedbackIsError = message ? messageIsError : Boolean(feedbackMessage);

  const updateColumn = (id: string, patch: Partial<BoardColumn>) => {
    setDraft((current) => ({
      ...current,
      columns: current.columns.map((column) =>
        column.id === id ? { ...column, ...patch } : column
      ),
    }));
    setMessage(null);
  };

  const addColumn = () => {
    setDraft((current) => ({
      ...current,
      columns: [
        ...current.columns,
        { id: crypto.randomUUID(), name: 'New column', status: 'New' },
      ],
    }));
    setMessage(null);
  };

  const moveColumn = (index: number, offset: -1 | 1) => {
    setDraft((current) => {
      const destination = index + offset;
      if (destination < 0 || destination >= current.columns.length)
        return current;
      const columns = [...current.columns];
      const [column] = columns.splice(index, 1);
      if (!column) return current;
      columns.splice(destination, 0, column);
      return { ...current, columns };
    });
    setMessage(null);
  };

  const removeColumn = (column: BoardColumn) => {
    setDraft((current) => ({
      ...current,
      columns: current.columns.filter(
        (candidate) => candidate.id !== column.id
      ),
    }));
    setDeleteColumn(null);
    setMessage(null);
  };

  const requestDeleteColumn = (column: BoardColumn) => {
    if (persistedIds.has(column.id)) setDeleteColumn(column);
    else removeColumn(column);
  };

  const saveWorkflowConfig = async (workflowConfig: BoardConfig | null) => {
    const pendingFields = { workflow_config: workflowConfig };
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

  const handleSave = async () => {
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

  const discardChanges = () => {
    setDraft(cloneConfig(baseline));
    setMessage(null);
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
      <FormAlertMessage message={feedbackMessage} isError={feedbackIsError} />
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Columns</CardTitle>
          <CardDescription>
            Column IDs are stable and stay unchanged when renamed or reordered.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-3">
          {draft.columns.map((column, index) => (
            <div
              key={column.id}
              className="border-border bg-muted/20 grid gap-3 rounded-lg border p-3 md:grid-cols-[minmax(0,1fr)_minmax(12rem,0.6fr)_auto] md:items-end"
            >
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
                  size="icon-sm"
                  aria-label={'Move ' + column.name + ' up'}
                  onClick={() => moveColumn(index, -1)}
                  disabled={!canEdit || isSaving || index === 0}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="icon-sm"
                  aria-label={'Move ' + column.name + ' down'}
                  onClick={() => moveColumn(index, 1)}
                  disabled={
                    !canEdit || isSaving || index === draft.columns.length - 1
                  }
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon-sm"
                  aria-label={'Delete ' + column.name}
                  onClick={() => requestDeleteColumn(column)}
                  disabled={!canEdit || isSaving}
                  className="text-destructive hover:text-destructive"
                >
                  <Trash2 />
                </Button>
              </div>
            </div>
          ))}
          <Button
            type="button"
            variant="outline"
            onClick={addColumn}
            disabled={!canEdit || isSaving}
          >
            <Plus className="mr-1.5 size-4" />
            Add column
          </Button>
        </CardContent>
      </Card>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          type="button"
          variant="outline"
          onClick={() => setResetDialogOpen(true)}
          disabled={!canEdit || isSaving || usesDefault}
        >
          <RotateCcw className="mr-1.5 size-4" />
          Reset to default board
        </Button>
        <div className="flex gap-2">
          <Button
            type="button"
            variant="ghost"
            onClick={discardChanges}
            disabled={!canEdit || isSaving || !draftChanged}
          >
            <Undo2 className="mr-1.5 size-4" />
            Discard changes
          </Button>
          <Button
            type="button"
            onClick={handleSave}
            disabled={!canEdit || isSaving || !dirty}
          >
            <Save className="mr-1.5 size-4" />
            {isSaving ? 'Saving…' : 'Save changes'}
          </Button>
        </div>
      </div>
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
    </div>
  );
}
