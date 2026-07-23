'use client';

import { useState } from 'react';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import {
  Sprint,
  updateSprintStatus,
} from '@/app/sprints/_services/sprints.service';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { Search, Plus } from '@repo/ui/lib/icons';

interface SprintsWorkspaceProps {
  readonly sprints: Sprint[];
  readonly pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  readonly filterTab: 'active' | 'archived';
  readonly search: string;
  readonly error?: string | null;
  readonly userRole: string;
  readonly currentUserId?: string | null;
}

export function SprintsWorkspace({
  sprints,
  pagination,
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

  const isManagerOrAdmin = userRole === 'admin' || userRole === 'manager';

  const { searchQuery, setSearchQuery } = useDebouncedSearch(search);
  const [isAddSprintOpen, setIsAddSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  const handleTabChange = (nextTab: 'active' | 'archived') => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', nextTab);
    params.set('page', '1'); // reset page when tab changes
    router.push(${pathname}?${params.toString()});
  };

  const handleSprintCreated = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'active');
    params.set('page', '1');
    router.push(${pathname}?${params.toString()});
    router.refresh();
  };

  const handleSprintUpdated = (updated?: Sprint) => {
    if (updated) {
      const isMovedToAnotherTab =
        (filterTab === 'active' && updated.status === 'Archived') ||
        (filterTab === 'archived' && updated.status !== 'Archived');

      if (isMovedToAnotherTab && sprints.length === 1 && pagination.page > 1) {
        handlePageChange(pagination.page - 1);
        return;
      }
    }
    router.refresh();
  };

  const handleArchiveSprint = async (sprint: Sprint) => {
    try {
      const updated = await updateSprintStatus(sprint.id, 'Archived');
      handleSprintUpdated(updated);
    } catch (error) {
      console.error('Failed to archive sprint:', error);
    }
  };

  const handleRestoreSprint = async (sprint: Sprint) => {
    try {
      const updated = await updateSprintStatus(sprint.id, 'Completed');
      handleSprintUpdated(updated);
    } catch (error) {
      console.error('Failed to restore sprint:', error);
    }
  };

  const handleRetry = () => {
    router.refresh();
  };

  return (
    <>
      <div className="space-y-6">
        {/* Control Bar */}
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

          <div className="flex items-center gap-2">
            {isManagerOrAdmin && (
              <Button
                type="button"
                onClick={() => setIsAddSprintOpen(true)}
                className="h-10 text-xs font-semibold shadow-md duration-300 hover:shadow-lg"
              >
                <Plus className="mr-1.5 h-3.5 w-3.5" />
                Add Sprint
              </Button>
            )}
          </div>
        </div>

        <div className="w-full">
          <SprintList
            sprints={sprints}
            pagination={pagination}
            filterTab={filterTab}
            onTabChange={handleTabChange}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            error={error}
            onRetry={handleRetry}
            onSprintUpdated={handleSprintUpdated}
            onEditSprint={
              isManagerOrAdmin
                ? (sprint) => setEditingSprint(sprint)
                : undefined
            }
            onArchiveSprint={isManagerOrAdmin ? handleArchiveSprint : undefined}
            onRestoreSprint={isManagerOrAdmin ? handleRestoreSprint : undefined}
          />
        </div>
      </div>

      {isAddSprintOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <SprintForm
              onSprintUpdated={handleSprintCreated}
              onClose={() => setIsAddSprintOpen(false)}
              onSuccess={() => setIsAddSprintOpen(false)}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}

      {editingSprint && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <SprintForm
              sprintId={editingSprint.id}
              onSprintUpdated={handleSprintUpdated}
              onClose={() => setEditingSprint(null)}
              onSuccess={() => setEditingSprint(null)}
              currentUserId={currentUserId}
            />
          </div>
        </div>
      )}
    </>
  );
}