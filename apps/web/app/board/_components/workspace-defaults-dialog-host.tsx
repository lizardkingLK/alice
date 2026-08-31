'use client';

import { BoardDefaultsDialog } from '@/app/board/_components/board-defaults-dialog';
import type { BoardDefaultsPreference } from '@/app/board/_helpers/board-defaults-storage';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import type { Sprint } from '@/app/sprints/_services/sprints.mutations.client';

/** Dialog fields returned by board/backlog defaults hooks. */
export type WorkspaceDefaultsDialogController = {
  readonly defaultsDialogOpen: boolean;
  // eslint-disable-next-line no-unused-vars -- Dialog open-change callback signature
  readonly setDefaultsDialogOpen: (open: boolean) => void;
  readonly allowSkipInDialog: boolean;
  readonly dialogInitialPreference: BoardDefaultsPreference | null;
  readonly canClearDefaults: boolean;
  // eslint-disable-next-line no-unused-vars -- Save callback signature
  readonly handleSaveDefaults: (preference: BoardDefaultsPreference) => void;
  readonly handleSkipDefaults: () => void;
  readonly handleClearDefaults: () => void;
};

/** Pick dialog-host fields from a board/backlog defaults hook return. */
export function pickWorkspaceDefaultsDialogController(
  source: WorkspaceDefaultsDialogController
): WorkspaceDefaultsDialogController {
  return {
    defaultsDialogOpen: source.defaultsDialogOpen,
    setDefaultsDialogOpen: source.setDefaultsDialogOpen,
    allowSkipInDialog: source.allowSkipInDialog,
    dialogInitialPreference: source.dialogInitialPreference,
    canClearDefaults: source.canClearDefaults,
    handleSaveDefaults: source.handleSaveDefaults,
    handleSkipDefaults: source.handleSkipDefaults,
    handleClearDefaults: source.handleClearDefaults,
  };
}

type WorkspaceDefaultsDialogHostProps = {
  readonly enabled: boolean;
  readonly projects: readonly Project[];
  readonly sprints: readonly Sprint[];
  readonly defaults: WorkspaceDefaultsDialogController;
  readonly showAllProjectsOption?: boolean;
};

/** Renders {@link BoardDefaultsDialog} when `enabled` (shared board/backlog/work-items wiring). */
export function WorkspaceDefaultsDialogHost({
  enabled,
  projects,
  sprints,
  defaults,
  showAllProjectsOption,
}: Readonly<WorkspaceDefaultsDialogHostProps>) {
  if (!enabled) {
    return null;
  }

  return (
    <BoardDefaultsDialog
      open={defaults.defaultsDialogOpen}
      onOpenChange={defaults.setDefaultsDialogOpen}
      projects={projects}
      sprints={sprints}
      initialPreference={defaults.dialogInitialPreference}
      onSave={defaults.handleSaveDefaults}
      onSkip={defaults.handleSkipDefaults}
      onClear={defaults.handleClearDefaults}
      canClear={defaults.canClearDefaults}
      allowSkip={defaults.allowSkipInDialog}
      showAllProjectsOption={showAllProjectsOption}
    />
  );
}
