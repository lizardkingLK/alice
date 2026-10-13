'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  ALL_PROJECTS_ID,
  type BoardDefaultsPreference,
} from '@/app/board/_helpers/board-defaults-storage';
import {
  chartsSprintFieldOptions,
  type ChartsProjectOption,
  type ChartsSprintOption,
} from '@/app/charts/_components/charts-sample.data';
import type { ChartWidgetTypeId } from '@/app/charts/_components/charts.types';
import { requiresSprintOnCreate } from '@/app/charts/_helpers/charts-widget-scope';
import { SearchableSelect } from '@/components/searchable-select';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Label } from '@repo/ui/components/ui/label';
import { afterDialogClose } from '@/lib/dialog-close';

const ALL_SPRINTS_VALUE = 'all';

export type ChartsWidgetScopeSelection = {
  readonly projectId: string;
  readonly sprintId: string | null;
};

type ChartsWidgetScopeDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- controlled open
  readonly onOpenChange: (open: boolean) => void;
  readonly mode: 'create' | 'change';
  readonly typeId: ChartWidgetTypeId;
  readonly projects: readonly ChartsProjectOption[];
  readonly sprints: readonly ChartsSprintOption[];
  /** Prefill from workspace defaults (create) or current filters (change). */
  readonly initialScope?: ChartsWidgetScopeSelection | null;
  readonly insertPreference?: BoardDefaultsPreference | null;
  // eslint-disable-next-line no-unused-vars -- confirm callback
  readonly onConfirm: (scope: ChartsWidgetScopeSelection) => void;
};

function resolveInitialProjectId(
  initial: ChartsWidgetScopeSelection | null | undefined,
  preference: BoardDefaultsPreference | null | undefined,
  projects: readonly ChartsProjectOption[]
): string {
  const fromInitial = initial?.projectId?.trim();
  if (fromInitial && projects.some((project) => project.id === fromInitial)) {
    return fromInitial;
  }
  const fromPref = preference?.projectId?.trim();
  if (
    fromPref &&
    fromPref !== ALL_PROJECTS_ID &&
    projects.some((project) => project.id === fromPref)
  ) {
    return fromPref;
  }
  return projects[0]?.id ?? '';
}

function resolveInitialSprintId(
  initial: ChartsWidgetScopeSelection | null | undefined,
  preference: BoardDefaultsPreference | null | undefined,
  projectId: string,
  sprints: readonly ChartsSprintOption[],
  requireSprint: boolean
): string {
  const candidates = [
    initial?.sprintId?.trim(),
    preference?.sprintId?.trim(),
  ].filter((value): value is string => Boolean(value));

  for (const candidate of candidates) {
    if (
      sprints.some(
        (sprint) => sprint.id === candidate && sprint.projectId === projectId
      )
    ) {
      return candidate;
    }
  }

  if (requireSprint) {
    return (
      sprints.find((sprint) => sprint.projectId === projectId)?.id ??
      ALL_SPRINTS_VALUE
    );
  }
  return ALL_SPRINTS_VALUE;
}

/**
 * Create / Change scope for chart and burndown widgets.
 * Project is required; sprint is required for burndown, optional for chart.
 */
export function ChartsWidgetScopeDialog({
  open,
  onOpenChange,
  mode,
  typeId,
  projects,
  sprints,
  initialScope = null,
  insertPreference = null,
  onConfirm,
}: Readonly<ChartsWidgetScopeDialogProps>) {
  const requireSprint = requiresSprintOnCreate(typeId);
  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState(ALL_SPRINTS_VALUE);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return afterDialogClose(() => {
        setError(null);
      });
    }
    const nextProject = resolveInitialProjectId(
      initialScope,
      insertPreference,
      projects
    );
    setProjectId(nextProject);
    setSprintId(
      resolveInitialSprintId(
        initialScope,
        insertPreference,
        nextProject,
        sprints,
        requireSprint
      )
    );
    setError(null);
    return undefined;
  }, [open, initialScope, insertPreference, projects, sprints, requireSprint]);

  const sprintOptions = useMemo(
    () => chartsSprintFieldOptions(sprints, projectId),
    [projectId, sprints]
  );

  const projectOptions = useMemo(
    () =>
      projects.map((project) => ({
        value: project.id,
        label: project.name,
      })),
    [projects]
  );

  const handleProjectChange = (nextProjectId: string) => {
    setProjectId(nextProjectId);
    setSprintId(
      resolveInitialSprintId(null, null, nextProjectId, sprints, requireSprint)
    );
    setError(null);
  };

  const handleConfirm = () => {
    if (!projectId) {
      setError('Select a project.');
      return;
    }
    if (requireSprint && (!sprintId || sprintId === ALL_SPRINTS_VALUE)) {
      setError('Select a sprint for burndown.');
      return;
    }
    onConfirm({
      projectId,
      sprintId: !sprintId || sprintId === ALL_SPRINTS_VALUE ? null : sprintId,
    });
    onOpenChange(false);
  };

  const title = mode === 'change' ? 'Change scope' : 'Choose scope';
  let description =
    'Pick the project this widget belongs to. Scope stays locked in filters afterward.';
  if (mode === 'change') {
    description =
      'Changing scope resets status, assignee, type, and priority filters under the new project and sprint.';
  } else if (requireSprint) {
    description =
      'Pick project and sprint for this burndown. Scope stays locked in filters afterward.';
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-1">
          <div className="flex flex-col gap-2">
            <Label htmlFor="charts-widget-scope-project">Project</Label>
            <SearchableSelect
              id="charts-widget-scope-project"
              value={projectId}
              onValueChange={handleProjectChange}
              placeholder="Select project"
              ariaLabel="Project"
              options={projectOptions}
              emptyText="No matching projects."
            />
          </div>

          <div className="flex flex-col gap-2">
            <Label htmlFor="charts-widget-scope-sprint">
              Sprint{requireSprint ? '' : ' (optional)'}
            </Label>
            <SearchableSelect
              id="charts-widget-scope-sprint"
              value={sprintId}
              onValueChange={setSprintId}
              disabled={!projectId}
              placeholder={requireSprint ? 'Select sprint' : 'All sprints'}
              ariaLabel="Sprint"
              options={sprintOptions.map((option) => ({
                value: option.value,
                label: option.label,
              }))}
              emptyText="No matching sprints."
            />
          </div>

          {error ? (
            <p className="text-destructive text-sm" role="alert">
              {error}
            </p>
          ) : null}
        </div>

        <DialogFooter className="gap-2 sm:gap-2">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            onClick={handleConfirm}
            disabled={!projectId || projects.length === 0}
          >
            {mode === 'change' ? 'Apply scope' : 'Add widget'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
