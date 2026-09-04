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
import { Search, Plus } from '@repo/ui/lib/icons';
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
import { SprintDeleteConfirmDialog } from './sprint-delete-confirm-dialog';
import { DismissibleError } from '@/components/dismissible-error';

const SPRINT_STATUS_TABS = [
  { id: SprintTabEnum.Active, label: 'Active' },
  { id: SprintTabEnum.Archived, label: 'Archived' },
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
  readonly search: string;
  readonly error?: string | null;
  readonly userRole: string;
  readonly currentUserId?: string | null;
}

function getErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error ? error.message : fallback;
}

function buildTabPath(
  pathname: string,
  searchParams: { toString: () => string },
  tab: SprintTab
): string {
  const params = new URLSearchParams(searchParams.toString());
  params.set('tab', tab);
  params.set('page', '1');
  return `${pathname}?${params.toString()}`;
}

function isSprintMovedFromTab(
  filterTab: SprintTab,
  status: Sprint['status']
): boolean {
  return (
    (filterTab === SprintTabEnum.Active && status === SprintStatusEnum.Archived) ||
    (filterTab === SprintTabEnum.Archived && status !== SprintStatusEnum.Archived)
  );
}

function SprintFormModal({
  isOpen,
  sprintToEdit,
  projects,
  currentUserId,
  onClose,
  onSprintUpdated,
}: {
  readonly isOpen: boolean;
  readonly sprintToEdit?: Sprint | null;
  readonly projects: Project[];
  readonly currentUserId?: string | null;
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
        />
      </div>
    </div>
  );
}

export function SprintsWorkspace({
  sprints,
  pagination,
  projects,
  filterTab,
  search,
  error = null,
  userRole,
  currentUserId,
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

  const [isPending, startTransition] = useTransition();
  const [actionError, setActionError] = useState<string | null>(null);

  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const [isAddSprintOpen, setIsAddSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);
  const [sprintToArchive, setSprintToArchive] = useState<Sprint | null>(null);
  const [sprintToDelete, setSprintToDelete] = useState<Sprint | null>(null);

  const updateStatusWithLock = (sprint: Sprint, status: Sprint['status']) =>
    updateSprintStatusWithOptimisticLock({
      sprint,
      status,
      handleMutationError,
      currentUserId,
    });

  const handleTabChange = (nextTab: SprintTab) => {
    router.push(buildTabPath(pathname, searchParams, nextTab));
  };

  const handleSprintCreated = () => {
    router.push(buildTabPath(pathname, searchParams, SprintTabEnum.Active));
    router.refresh();
  };

  const refreshOrPreviousPage = () => {
    if (sprints.length === 1 && pagination.page > 1) {
      handlePageChange(pagination.page - 1);
    } else {
      router.refresh();
    }
  };

  const handleSprintUpdated = (updated?: Sprint) => {
    if (updated && isSprintMovedFromTab(filterTab, updated.status)) {
      refreshOrPreviousPage();
      return;
    }
    router.refresh();
  };

  const handleArchiveSprintClick = (sprint: Sprint) => {
    setActionError(null);
    setSprintToArchive(sprint);
  };

  const confirmArchive = () => {
    if (!sprintToArchive) return;
    setActionError(null);

    startTransition(async () => {
      try {
        const updated = await updateStatusWithLock(
          sprintToArchive,
          SprintStatusEnum.Archived
        );
        if (updated) {
          setSprintToArchive(null);
          handleSprintUpdated(updated);
        }
      } catch (archiveError) {
        console.error('error. Failed to archive sprint', archiveError);
        setActionError(
          getErrorMessage(archiveError, 'Failed to archive sprint')
        );
      }
    });
  };

  const handleRestoreSprint = async (sprint: Sprint) => {
    setActionError(null);
    startTransition(async () => {
      try {
        const updated = await updateStatusWithLock(
          sprint,
          SprintStatusEnum.Closed
        );
        if (updated) {
          handleSprintUpdated(updated);
        }
      } catch (restoreError) {
        console.error('Failed to restore sprint:', restoreError);
        setActionError(
          getErrorMessage(restoreError, 'Failed to restore sprint')
        );
      }
    });
  };

  const handleDeleteSprintClick = (sprint: Sprint) => {
    setActionError(null);
    setSprintToDelete(sprint);
  };

  const confirmDelete = (action: DeleteSprintWorkItemsAction) => {
    if (!sprintToDelete) return;
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

  const handleRetry = () => {
    router.refresh();
  };

  const onEditSprint = isManagerOrAdmin
    ? (sprint: Sprint) => setEditingSprint(sprint)
    : undefined;
  const onArchiveSprint = isManagerOrAdmin ? handleArchiveSprintClick : undefined;
  const onRestoreSprint = isManagerOrAdmin ? handleRestoreSprint : undefined;
  const onDeleteSprint = isAdmin ? handleDeleteSprintClick : undefined;

  return (
    <>
      <div className="space-y-6">
        <DismissibleError
          message={actionError ?? error}
          onDismiss={() => setActionError(null)}
        />

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="relative max-w-md flex-1">
            <Search className="text-muted-foreground absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
            <Input
              type="text"
              placeholder="Search sprints by name or goal..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="bg-background/50 h-10 py-2 pr-4 pl-10"
            />
          </div>

          <div className="flex flex-wrap items-center gap-3 self-start">
            <RegistryTabSwitcher
              tabs={SPRINT_STATUS_TABS}
              value={filterTab}
              onChange={handleTabChange}
            />

            {isManagerOrAdmin ? (
              <Button
                type="button"
                onClick={() => setIsAddSprintOpen(true)}
                className="flex h-10 shrink-0 items-center justify-center px-6 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
              >
                <Plus className="mr-1.5 h-4 w-4 shrink-0" />
                Add Sprint
              </Button>
            ) : null}
          </div>
        </div>

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
            onRetry={handleRetry}
            onSprintUpdated={handleSprintUpdated}
            onEditSprint={onEditSprint}
            onArchiveSprint={onArchiveSprint}
            onRestoreSprint={onRestoreSprint}
            onDeleteSprint={onDeleteSprint}
          />
        </div>
      </div>

      <SprintFormModal
        isOpen={isAddSprintOpen}
        projects={projects}
        currentUserId={currentUserId}
        onClose={() => setIsAddSprintOpen(false)}
        onSprintUpdated={handleSprintCreated}
      />

      <SprintFormModal
        isOpen={Boolean(editingSprint)}
        sprintToEdit={editingSprint}
        projects={projects}
        currentUserId={currentUserId}
        onClose={() => setEditingSprint(null)}
        onSprintUpdated={handleSprintUpdated}
      />

      {sprintToArchive ? (
        <RegistryConfirmDialog
          title="Archive Sprint"
          subject={sprintToArchive.name}
          detail="It will be hidden from the active sprints list, but can be restored later from the Archived tab."
          confirmLabel="Archive Sprint"
          pendingLabel="Archiving..."
          isPending={isPending}
          isSoft={true}
          onCancel={() => setSprintToArchive(null)}
          onConfirm={confirmArchive}
        />
      ) : null}

      {sprintToDelete ? (
        <SprintDeleteConfirmDialog
          sprintName={sprintToDelete.name}
          isPending={isPending}
          onCancel={() => setSprintToDelete(null)}
          onConfirm={confirmDelete}
        />
      ) : null}
    </>
  );
}

