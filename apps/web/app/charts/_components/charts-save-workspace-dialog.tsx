'use client';

import { useEffect, useMemo, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Checkbox } from '@repo/ui/components/ui/checkbox';
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
  ChartsDescriptionField,
  useChartsAliceDescriptionSuggest,
} from '@/app/charts/_components/charts-description-field';
import {
  chartsSprintFieldOptions,
  type ChartsProjectOption,
  type ChartsSprintOption,
} from '@/app/charts/_components/charts-sample.data';
import type { ChartWorkspaceScope } from '@/app/charts/_components/charts.types';
import { SearchableSelect } from '@/components/searchable-select';

export type ChartsSaveWorkspacePayload = {
  readonly title: string;
  readonly description: string | null;
  /** When set, workspace is locked to this project + sprint. */
  readonly scope?: ChartWorkspaceScope | null;
};

type ChartsSaveWorkspaceDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  readonly defaultTitle: string;
  readonly defaultDescription?: string | null;
  /** Create a new workspace vs rename/save the current one. */
  readonly mode?: 'create' | 'save';
  /** Optional board summary for Alice suggest (widget list, etc.). */
  readonly aliceContext?: unknown;
  /** Projects/sprints for create-time scope lock (create mode only). */
  readonly projects?: readonly ChartsProjectOption[];
  readonly sprints?: readonly ChartsSprintOption[];
  readonly onSave: (
    // eslint-disable-next-line no-unused-vars
    payload: ChartsSaveWorkspacePayload
  ) => void | Promise<void>;
};

export function ChartsSaveWorkspaceDialog({
  open,
  onOpenChange,
  defaultTitle,
  defaultDescription = null,
  mode = 'save',
  aliceContext,
  projects = [],
  sprints = [],
  onSave,
}: Readonly<ChartsSaveWorkspaceDialogProps>) {
  const [title, setTitle] = useState(defaultTitle);
  const [description, setDescription] = useState(defaultDescription ?? '');
  const [pending, setPending] = useState(false);
  const [lockScope, setLockScope] = useState(false);
  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState('');
  const [scopeError, setScopeError] = useState<string | null>(null);
  const { suggesting, suggestError, suggest, resetSuggestError } =
    useChartsAliceDescriptionSuggest({
      scope: 'workspace',
      title,
      description,
      onDescriptionChange: setDescription,
      context: aliceContext,
    });
  const isCreate = mode === 'create';
  const confirmLabel = (() => {
    if (pending) {
      return isCreate ? 'Creating…' : 'Saving…';
    }
    return isCreate ? 'Create' : 'Save';
  })();

  useEffect(() => {
    if (!open) {
      return;
    }
    setTitle(defaultTitle);
    setDescription(defaultDescription ?? '');
    setPending(false);
    setLockScope(false);
    setProjectId(projects[0]?.id ?? '');
    setSprintId('');
    setScopeError(null);
    resetSuggestError();
  }, [open, defaultTitle, defaultDescription, projects, resetSuggestError]);

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    [projects]
  );

  const sprintOptions = useMemo(
    () =>
      chartsSprintFieldOptions(sprints, projectId).filter(
        (option) => option.value !== 'all'
      ),
    [projectId, sprints]
  );

  useEffect(() => {
    if (!lockScope || !projectId) {
      return;
    }
    const stillValid = sprintOptions.some(
      (option) => option.value === sprintId
    );
    if (!stillValid) {
      setSprintId(sprintOptions[0]?.value ?? '');
    }
  }, [lockScope, projectId, sprintId, sprintOptions]);

  const handleConfirm = () => {
    const trimmedTitle = title.trim();
    if (!trimmedTitle) {
      return;
    }

    let scope: ChartWorkspaceScope | null = null;
    if (isCreate && lockScope) {
      if (!projectId) {
        setScopeError('Select a project.');
        return;
      }
      if (!sprintId) {
        setScopeError('Select a sprint.');
        return;
      }
      scope = { projectId, sprintId };
    }

    setPending(true);
    Promise.resolve(
      onSave({
        title: trimmedTitle,
        description: description.trim() || null,
        ...(isCreate ? { scope } : {}),
      })
    )
      .then(() => {
        onOpenChange(false);
      })
      .catch(() => {
        setPending(false);
      });
  };

  const createDisabled =
    !title.trim() ||
    pending ||
    suggesting ||
    (lockScope && (!projectId || !sprintId || projects.length === 0));

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (pending || suggesting) {
          return;
        }
        onOpenChange(next);
      }}
    >
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {isCreate ? 'New workspace' : 'Save option'}
          </DialogTitle>
          <DialogDescription>
            {isCreate
              ? 'Name the workspace. Optionally lock it to one project and sprint so every widget inherits that scope.'
              : 'Update the name and description for this chart workspace.'}
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-col gap-4 py-2">
          <div className="flex flex-col gap-2">
            <Label htmlFor="chart-workspace-title">Name</Label>
            <Input
              id="chart-workspace-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Charts"
              autoFocus
              disabled={pending || suggesting}
            />
          </div>
          <ChartsDescriptionField
            id="chart-workspace-description"
            value={description}
            onChange={setDescription}
            title={title}
            suggesting={suggesting}
            suggestError={suggestError}
            onSuggest={() => {
              suggest().catch(() => {});
            }}
            placeholder="What this workspace is for…"
            disabled={pending}
          />
          {isCreate ? (
            <div className="flex flex-col gap-3">
              <label className="flex cursor-pointer items-start gap-2">
                <Checkbox
                  checked={lockScope}
                  onCheckedChange={(checked) => {
                    setLockScope(checked === true);
                    setScopeError(null);
                  }}
                  disabled={pending || suggesting || projects.length === 0}
                  className="mt-0.5"
                />
                <span className="space-y-0.5">
                  <span className="text-sm leading-none font-medium">
                    Lock to project and sprint
                  </span>
                  <span className="text-muted-foreground block text-xs">
                    Hides board Filter and project/sprint on widgets. You can
                    mark the workspace non-scoped later, but not change the
                    locked pair.
                  </span>
                </span>
              </label>
              {lockScope ? (
                <div className="flex flex-col gap-3 pl-6">
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="chart-workspace-scope-project">
                      Project
                    </Label>
                    <SearchableSelect
                      id="chart-workspace-scope-project"
                      value={projectId}
                      onValueChange={(next) => {
                        setProjectId(next);
                        setScopeError(null);
                      }}
                      placeholder="Select project"
                      ariaLabel="Project"
                      options={projectOptions}
                      emptyText="No matching projects."
                      disabled={pending || suggesting}
                    />
                  </div>
                  <div className="flex flex-col gap-2">
                    <Label htmlFor="chart-workspace-scope-sprint">Sprint</Label>
                    <SearchableSelect
                      id="chart-workspace-scope-sprint"
                      value={sprintId}
                      onValueChange={(next) => {
                        setSprintId(next);
                        setScopeError(null);
                      }}
                      disabled={!projectId || pending || suggesting}
                      placeholder="Select sprint"
                      ariaLabel="Sprint"
                      options={sprintOptions.map((option) => ({
                        value: option.value,
                        label: option.label,
                      }))}
                      emptyText="No matching sprints."
                    />
                  </div>
                  {scopeError ? (
                    <p className="text-destructive text-sm" role="alert">
                      {scopeError}
                    </p>
                  ) : null}
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={pending || suggesting}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={createDisabled}
            onClick={handleConfirm}
          >
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
