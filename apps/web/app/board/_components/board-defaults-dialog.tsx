'use client';

import { useEffect, useMemo, useState } from 'react';
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
import { SearchableSelect } from '@/components/searchable-select';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import { ALL_PROJECTS_ID } from '@/app/board/_helpers/board-defaults-storage';
import { resolveDefaultBoardSprint } from '@/app/board/_services/board-defaults';
import type { Project } from '@/app/projects/_services/projects.service.base';
import type { Sprint } from '@/app/sprints/_services/sprints.service';
import { preventDismissForComboboxPortal } from '@/lib/dialog-outside-events';

const ALL_SPRINTS = 'all';

type BoardDefaultsDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- Dialog open-change callback signature
  readonly onOpenChange: (open: boolean) => void;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly initialPreference: BoardDefaultsPreference | null;
  // eslint-disable-next-line no-unused-vars -- Save callback signature
  readonly onSave: (preference: BoardDefaultsPreference) => void;
  readonly onSkip: () => void;
  readonly allowSkip: boolean;
  readonly showAllProjectsOption?: boolean;
};

export function BoardDefaultsDialog({
  open,
  onOpenChange,
  projects,
  sprints,
  initialPreference,
  onSave,
  onSkip,
  allowSkip,
  showAllProjectsOption = true,
}: Readonly<BoardDefaultsDialogProps>) {
  const [projectId, setProjectId] = useState('');
  const [sprintId, setSprintId] = useState<string>(ALL_SPRINTS);

  useEffect(() => {
    if (!open) {
      return;
    }

    if (initialPreference?.projectId === ALL_PROJECTS_ID) {
      setProjectId(ALL_PROJECTS_ID);
      setSprintId(ALL_SPRINTS);
      return;
    }

    const nextProject =
      initialPreference?.projectId &&
      projects.some((project) => project.id === initialPreference.projectId)
        ? initialPreference.projectId
        : (projects[0]?.id ?? '');

    let nextSprint = ALL_SPRINTS;
    if (nextProject) {
      if (
        initialPreference?.sprintId &&
        sprints.some(
          (sprint) =>
            sprint.id === initialPreference.sprintId &&
            sprint.project?.id === nextProject
        )
      ) {
        nextSprint = initialPreference.sprintId;
      } else {
        const suggested = resolveDefaultBoardSprint(sprints, nextProject);
        nextSprint = suggested?.id ?? ALL_SPRINTS;
      }
    }

    setProjectId(nextProject);
    setSprintId(nextSprint);
  }, [open, initialPreference, projects, sprints]);

  const isAllProjects = projectId === ALL_PROJECTS_ID;

  const sprintOptions = useMemo(() => {
    if (!projectId || isAllProjects) {
      return [];
    }
    return sprints.filter((sprint) => sprint.project?.id === projectId);
  }, [isAllProjects, projectId, sprints]);

  const handleProjectChange = (nextProject: string) => {
    setProjectId(nextProject);
    if (nextProject === ALL_PROJECTS_ID) {
      setSprintId(ALL_SPRINTS);
      return;
    }
    const suggested = resolveDefaultBoardSprint(sprints, nextProject);
    setSprintId(suggested?.id ?? ALL_SPRINTS);
  };

  const handleSave = () => {
    if (!projectId) {
      return;
    }
    onSave({
      projectId,
      sprintId:
        projectId === ALL_PROJECTS_ID || sprintId === ALL_SPRINTS
          ? null
          : sprintId,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="sm:max-w-md"
        onPointerDownOutside={preventDismissForComboboxPortal}
        onInteractOutside={preventDismissForComboboxPortal}
      >
        <DialogHeader>
          <DialogTitle>Workspace defaults</DialogTitle>
          <DialogDescription>
            Choose the project and sprint to open by default when you visit the
            board, backlog, or work items list. Changing filters later will not
            update this preference.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col gap-4 py-2">
          <div className="space-y-2">
            <Label htmlFor="board-defaults-project">Project</Label>
            <SearchableSelect
              id="board-defaults-project"
              value={projectId}
              onValueChange={handleProjectChange}
              ariaLabel="Default project"
              placeholder="Search projects…"
              options={[
                ...(showAllProjectsOption
                  ? [{ value: ALL_PROJECTS_ID, label: 'All Projects' }]
                  : []),
                ...projects.map((project) => ({
                  value: project.id,
                  label: project.name,
                })),
              ]}
              emptyText="No matching projects."
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="board-defaults-sprint">Sprint</Label>
            <SearchableSelect
              id="board-defaults-sprint"
              value={sprintId}
              onValueChange={setSprintId}
              disabled={!projectId || isAllProjects}
              ariaLabel="Default sprint"
              placeholder="Search sprints…"
              options={[
                { value: ALL_SPRINTS, label: 'All Sprints' },
                ...sprintOptions.map((sprint) => ({
                  value: sprint.id,
                  label: sprint.name,
                })),
              ]}
              emptyText="No matching sprints."
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {allowSkip ? (
            <Button type="button" variant="ghost" onClick={onSkip}>
              Skip for now
            </Button>
          ) : (
            <Button
              type="button"
              variant="ghost"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
          )}
          <Button type="button" onClick={handleSave} disabled={!projectId}>
            Save defaults
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
