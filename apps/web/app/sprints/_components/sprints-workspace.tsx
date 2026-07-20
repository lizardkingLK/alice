'use client';

import { useState } from 'react';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { useDebouncedSearch } from '@/hooks/use-debounced-search';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { Sprint } from '@/app/sprints/_services/sprints.service';
import { Button } from '@repo/ui/components/ui/button';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';
import { Search } from '@repo/ui/lib/icons';

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
    router.push(`${pathname}?${params.toString()}`);
  };

  const handleSprintCreated = () => {
    const params = new URLSearchParams(searchParams.toString());
    params.set('tab', 'active');
    params.set('page', '1');
    router.push(`${pathname}?${params.toString()}`);
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
            {/* Tabs */}
            <div className="bg-muted/50 border-border text-muted-foreground inline-flex h-10 items-center justify-center rounded-md border p-1">
              <Button
                variant="ghost"
                onClick={() => handleTabChange('active')}
                className={cn(
                  'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                  filterTab === 'active'
                    ? 'bg-background text-foreground hover:bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                )}
              >
                Active
              </Button>
              <Button
                variant="ghost"
                onClick={() => handleTabChange('archived')}
                className={cn(
                  'h-8 cursor-pointer rounded-sm px-3 text-xs font-semibold transition-all focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50',
                  filterTab === 'archived'
                    ? 'bg-background text-foreground hover:bg-background shadow-sm'
                    : 'text-muted-foreground hover:text-foreground hover:bg-transparent'
                )}
              >
                Archived
              </Button>
            </div>
          </div>
        </div>

        <div className="w-full">
          <SprintList
            sprints={sprints}
            pagination={pagination}
            filterTab={filterTab}
            onPageChange={handlePageChange}
            onLimitChange={handleLimitChange}
            error={error}
            onRetry={handleRetry}
            onSprintUpdated={handleSprintUpdated}
            onAddSprint={
              isManagerOrAdmin ? () => setIsAddSprintOpen(true) : undefined
            }
            onEditSprint={
              isManagerOrAdmin
                ? (sprint) => setEditingSprint(sprint)
                : undefined
            }
            isManagerOrAdmin={isManagerOrAdmin}
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
