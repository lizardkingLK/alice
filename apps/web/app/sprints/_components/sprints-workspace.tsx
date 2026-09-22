'use client';

import { useState, useTransition } from 'react';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import {
  Sprint,
  hardDeleteSprint,
} from '@/app/sprints/_services/sprints.mutations.client';
import { updateSprintStatusWithOptimisticLock } from '@/app/sprints/_helpers/update-sprint-status-with-lock';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Archive, CircleDot, Search, Plus, X } from '@repo/ui/lib/icons';
import type { Project } from '@/app/projects/_services/projects.mutations.shared';
import {
  SprintTabEnum,
  type SprintTab,
  SprintStatusEnum,
  UserRoleEnum,
  type DeleteSprintWorkItemsAction,
} from '@repo/types';
import { useOptimisticLock } from '@/components/optimistic-lock/optimistic-lock-provider';
import { RegistryTabSwitcher } from '@/components/registry-tab-switcher';
import { RegistryConfirmDialog } from '@/components/registry-confirm-dialog';
import { DismissibleError } from '@/components/dismissible-error';
import {
  QUERY_FILTER_ALL_VALUE,
  useQueryFilter,
} from '@/hooks/use-query-filter';
import { SprintsFilterDialog } from '@/app/sprints/_components/sprints-filter-dialog';
import { SprintDeleteConfirmDialog } from './sprint-delete-confirm-dialog';

const SPRINT_STATUS_TABS = [
  { id: SprintTabEnum.Active, label: 'Active', icon: CircleDot },
  { id: SprintTabEnum.Archived, label: 'Archived', icon: Archive },
] as const;

interface SprintsWorkspaceProps {
  readonly sprints: Sprint[];
  readonly pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  readonly projects: Project[];
  readonly filterTab: SprintTab;
  readonly projectFilter: string;
  readonly search: string;
  readonly error?: string | null;
  readonly userRole: string;
  readonly currentUserId?: string | null;
  /** When set, project is fixed (project details) and Active/Archived uses `sprintStatus`. */
  readonly lockedProjectId?: string;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildTabPath(
  pathname: string,
  searchParams: { toString: () => string },
  tab: SprintTab,
  options?: { readonly useSprintStatusParam?: boolean }
): string {
  const params = new URLSearchParams(searchParams.toString());
  if (options?.useSprintStatusParam) {
    if (tab === SprintTabEnum.Archived) {
      params.set('sprintStatus', SprintTabEnum.Archived);
    } else {
      params.delete('sprintStatus');
    }
  } else {
    params.set('tab', tab);
  }
  params.set('page', '1');
  return `${pathname}?${params.toString()}`;
}

function isSprintMovedFromTab(
  filterTab: SprintTab,
  status: Sprint['status']
): boolean {
  return (
    (filterTab === SprintTabEnum.Active &&
      status === SprintStatusEnum.Archived) ||
    (filterTab === SprintTabEnum.Archived &&
      status !== SprintStatusEnum.Archived)
  );
}

function SprintFormModal({
  isOpen,
  sprintToEdit,
  projects,
  currentUserId,
  lockedProjectId,
  onClose,
  onSprintUpdated,
}: {
  readonly isOpen: boolean;
  readonly sprintToEdit?: Sprint | null;
  readonly projects: Project[];
  readonly currentUserId?: string | null;
  readonly lockedProjectId?: string;
  readonly onClose: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onSprintUpdated: (sprint?: Sprint) => void;
}) {
  if (!isOpen) return null;
  return (
    <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
      <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
        <SprintForm
          projects={projects}
          sprintToEdit={sprintToEdit}
          onSprintUpdated={onSprintUpdated}
          onClose={onClose}
          onSuccess={onClose}
          currentUserId={currentUserId}
          lockedProjectId={lockedProjectId}
        />
      </div>
    </div>
  );
}

type HandleMutationError = ReturnType<
  typeof useOptimisticLock
>['handleMutationError'];

async function runLockedStatusUpdate(options: {
  readonly sprint: Sprint;
  readonly status: Sprint['status'];
  readonly handleMutationError: HandleMutationError;
  readonly currentUserId?: string | null;
  // eslint-disable-next-line no-unused-vars
  readonly onUpdated: (sprint: Sprint) => void;
  readonly failureMessage: string;
  // eslint-disable-next-line no-unused-vars
  readonly onFailure: (message: string) => void;
}): Promise<void> {
  try {
    const updated = await updateSprintStatusWithOptimisticLock({
      sprint: options.sprint,
      status: options.status,
      handleMutationError: options.handleMutationError,
      currentUserId: options.currentUserId,
    });
    if (updated) {
      options.onUpdated(updated);
    }
  } catch (error) {
    console.error(options.failureMessage, error);
    options.onFailure(getErrorMessage(error, options.failureMessage));
  }
}

function SprintsWorkspaceToolbar(props: {
  readonly searchQuery: string;
  // eslint-disable-next-line no-unused-vars
  readonly onSearchChange: (value: string) => void;
  readonly isProjectLocked: boolean;
  readonly projects: Project[];
  readonly projectValue: string;
  // eslint-disable-next-line no-unused-vars
  readonly onApplyProject: (value: string) => void;
  readonly filterTab: SprintTab;
  // eslint-disable-next-line no-unused-vars
  readonly onTabChange: (tab: SprintTab) => void;
  readonly isManagerOrAdmin: boolean;
  readonly onAddSprint: () => void;
}) {
  const showClearFilters = props.projectValue !== QUERY_FILTER_ALL_VALUE;

  return (
    <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative max-w-md flex-1">
          <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
          <Input
            type="text"
            placeholder="Search sprints by name or goal..."
            value={props.searchQuery}
            onChange={(e) => props.onSearchChange(e.target.value)}
            className="bg-background/50 h-10 py-2 pr-4 pl-10"
          />
        </div>

        {props.isProjectLocked ? null : (
          <>
            <SprintsFilterDialog
              projects={props.projects}
              projectValue={props.projectValue}
              hasActiveFilters={showClearFilters}
              onApplyProject={props.onApplyProject}
            />

            {showClearFilters ? (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => props.onApplyProject(QUERY_FILTER_ALL_VALUE)}
                className="text-muted-foreground hover:text-foreground h-9 px-3 text-xs"
              >
                Clear filters
                <X className="size-3.5" />
              </Button>
            ) : null}
          </>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-3 self-start">
        <RegistryTabSwitcher
          tabs={SPRINT_STATUS_TABS}
          value={props.filterTab}
          onChange={props.onTabChange}
        />

        {props.isManagerOrAdmin ? (
          <Button
            type="button"
            onClick={props.onAddSprint}
            className="flex h-10 shrink-0 items-center justify-center px-6 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
          >
            <Plus className="mr-1.5 h-4 w-4 shrink-0" />
            Add Sprint
          </Button>
        ) : null}
      </div>
    </div>
  );
}

function SprintsWorkspaceModals(props: {
  readonly projects: Project[];
  readonly currentUserId?: string | null;
  readonly lockedProjectId?: string;
  readonly isAddSprintOpen: boolean;
  readonly onCloseAddSprint: () => void;
  readonly onSprintCreated: () => void;
  readonly editingSprint: Sprint | null;
  readonly onCloseEditSprint: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onSprintUpdated: (sprint?: Sprint) => void;
  readonly sprintToArchive: Sprint | null;
  readonly onCancelArchive: () => void;
  readonly onConfirmArchive: () => void;
  readonly sprintToDelete: Sprint | null;
  readonly onCancelDelete: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onConfirmDelete: (action: DeleteSprintWorkItemsAction) => void;
  readonly isPending: boolean;
}) {
  return (
    <>
      <SprintFormModal
        isOpen={props.isAddSprintOpen}
        projects={props.projects}
        currentUserId={props.currentUserId}
        lockedProjectId={props.lockedProjectId}
        onClose={props.onCloseAddSprint}
        onSprintUpdated={props.onSprintCreated}
      />

      <SprintFormModal
        isOpen={Boolean(props.editingSprint)}
        sprintToEdit={props.editingSprint}
        projects={props.projects}
        currentUserId={props.currentUserId}
        lockedProjectId={props.lockedProjectId}
        onClose={props.onCloseEditSprint}
        onSprintUpdated={props.onSprintUpdated}
      />

      {props.sprintToArchive ? (
        <RegistryConfirmDialog
          title="Archive Sprint"
          subject={props.sprintToArchive.name}
          detail="It will be hidden from the active sprints list, but can be restored later from the Archived tab."
          confirmLabel="Archive Sprint"
          pendingLabel="Archiving..."
          isPending={props.isPending}
          isSoft={true}
          onCancel={props.onCancelArchive}
          onConfirm={props.onConfirmArchive}
        />
      ) : null}

      {props.sprintToDelete ? (
        <SprintDeleteConfirmDialog
          sprintName={props.sprintToDelete.name}
          isPending={props.isPending}
          onCancel={props.onCancelDelete}
          onConfirm={props.onConfirmDelete}
        />
      ) : null}
    </>
  );
}

export function SprintsWorkspace({
  sprints,
  pagination,
  projects,
  filterTab,
  projectFilter,
  search,
  error = null,
  userRole,
  currentUserId,
  lockedProjectId,
}: Readonly<SprintsWorkspaceProps>) {
  const {
    handlePageChange,
    handleLimitChange,
    pathname,
    router,
    searchParams,
  } = usePaginationNavigation(pagination.totalPages, pagination.limit);

  const isAdmin = userRole === UserRoleEnum.admin;
  const isManagerOrAdmin = isAdmin || userRole === UserRoleEnum.manager;
  const { handleMutationError } = useOptimisticLock();
  const projectQuery = useQueryFilter('project', projectFilter);
  const isProjectLocked = Boolean(lockedProjectId);
  const useSprintStatusParam =
    isProjectLocked || searchParams.get('tab') === 'sprints';

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);
  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const [isAddSprintOpen, setIsAddSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [sprintToArchive, setSprintToArchive] = useState<Sprint | null>(null);
  const [sprintToDelete, setSprintToDelete] = useState<Sprint | null>(null);

  const refreshOrPreviousPage = () => {
    if (sprints.length === 1 && pagination.page > 1) {
      handlePageChange(pagination.page - 1);
      return;
    }
    router.refresh();
  };

  const handleSprintUpdated = (updated?: Sprint) => {
    if (updated && isSprintMovedFromTab(filterTab, updated.status)) {
      refreshOrPreviousPage();
      return;
    }
    router.refresh();
  };

  const handleTabChange = (nextTab: SprintTab) => {
    router.push(
      buildTabPath(pathname, searchParams, nextTab, {
        useSprintStatusParam,
      })
    );
  };

  const handleSprintCreated = () => {
    router.push(
      buildTabPath(pathname, searchParams, SprintTabEnum.Active, {
        useSprintStatusParam,
      })
    );
    router.refresh();
  };

  const confirmArchive = () => {
    if (!sprintToArchive) {
      return;
    }
    setActionError(null);
    startTransition(async () => {
      await runLockedStatusUpdate({
        sprint: sprintToArchive,
        status: SprintStatusEnum.Archived,
        handleMutationError,
        currentUserId,
        onUpdated: (updated) => {
          setSprintToArchive(null);
          handleSprintUpdated(updated);
        },
        failureMessage: 'Failed to archive sprint',
        onFailure: setActionError,
      });
    });
  };

  const handleRestoreSprint = (sprint: Sprint) => {
    setActionError(null);
    startTransition(async () => {
      await runLockedStatusUpdate({
        sprint,
        status: SprintStatusEnum.Closed,
        handleMutationError,
        currentUserId,
        onUpdated: handleSprintUpdated,
        failureMessage: 'Failed to restore sprint',
        onFailure: setActionError,
      });
    });
  };

  const confirmDelete = (action: DeleteSprintWorkItemsAction) => {
    if (!sprintToDelete) {
      return;
    }
    setActionError(null);
    startTransition(async () => {
      try {
        await hardDeleteSprint(sprintToDelete.id, { workItemsAction: action });
        setSprintToDelete(null);
        refreshOrPreviousPage();
      } catch (deleteError) {
        console.error('Failed to delete sprint:', deleteError);
        setActionError(getErrorMessage(deleteError, 'Failed to delete sprint'));
      }
    });
  };

  const onEditSprint = isManagerOrAdmin
    ? (sprint: Sprint) => setEditingSprint(sprint)
    : undefined;
  const onArchiveSprint = isManagerOrAdmin
    ? (sprint: Sprint) => {
        setActionError(null);
        setSprintToArchive(sprint);
      }
    : undefined;
  const onRestoreSprint = isManagerOrAdmin ? handleRestoreSprint : undefined;
  const onDeleteSprint = isAdmin
    ? (sprint: Sprint) => {
        setActionError(null);
        setSprintToDelete(sprint);
      }
    : undefined;

  return (
    <>
      <div className="space-y-6">
        <DismissibleError
          message={actionError ?? error}
          onDismiss={() => setActionError(null)}
        />

        <SprintsWorkspaceToolbar
          searchQuery={searchQuery}
          onSearchChange={setSearchQuery}
          isProjectLocked={isProjectLocked}
          projects={projects}
          projectValue={projectQuery.value}
          onApplyProject={projectQuery.setFilter}
          filterTab={filterTab}
          onTabChange={handleTabChange}
          isManagerOrAdmin={isManagerOrAdmin}
          onAddSprint={() => setIsAddSprintOpen(true)}
        />

        <div className="w-full">
          <SprintList
            sprints={sprints}
            pagination={pagination}
            filterTab={filterTab}
            isAdmin={isAdmin}
            isManagerOrAdmin={isManagerOrAdmin}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            error={error}
            onRetry={() => router.refresh()}
            onSprintUpdated={handleSprintUpdated}
            onEditSprint={onEditSprint}
            onArchiveSprint={onArchiveSprint}
            onRestoreSprint={onRestoreSprint}
            onDeleteSprint={onDeleteSprint}
          />
        </div>
      </div>

      <SprintsWorkspaceModals
        projects={projects}
        currentUserId={currentUserId}
        lockedProjectId={lockedProjectId}
        isAddSprintOpen={isAddSprintOpen}
        onCloseAddSprint={() => setIsAddSprintOpen(false)}
        onSprintCreated={handleSprintCreated}
        editingSprint={editingSprint}
        onCloseEditSprint={() => setEditingSprint(null)}
        onSprintUpdated={handleSprintUpdated}
        sprintToArchive={sprintToArchive}
        onCancelArchive={() => setSprintToArchive(null)}
        onConfirmArchive={confirmArchive}
        sprintToDelete={sprintToDelete}
        onCancelDelete={() => setSprintToDelete(null)}
        onConfirmDelete={confirmDelete}
        isPending={isPending}
      />
    </>
  );
}
