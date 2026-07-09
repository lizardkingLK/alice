'use client';

import { useState } from 'react';
import { usePaginationNavigation } from '@/hooks/use-pagination-navigation';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { Sprint } from '@/app/sprints/_services/sprints.service';

interface SprintsWorkspaceProps {
  readonly sprints: Sprint[];
  readonly pagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
  readonly filterTab: 'active' | 'archived';
  readonly error?: string | null;
}

export function SprintsWorkspace({
  sprints,
  pagination,
  filterTab,
  error = null,
}: Readonly<SprintsWorkspaceProps>) {
  const {
    handlePageChange,
    handleLimitChange,
    pathname,
    router,
    searchParams,
  } = usePaginationNavigation(pagination.totalPages, pagination.limit);

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

  const handleSprintUpdated = () => {
    router.refresh();
  };

  const handleRetry = () => {
    router.refresh();
  };

  return (
    <>
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
          onAddSprint={() => setIsAddSprintOpen(true)}
          onEditSprint={(sprint) => setEditingSprint(sprint)}
        />
      </div>

      {isAddSprintOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <SprintForm
              onSprintUpdated={handleSprintCreated}
              onClose={() => setIsAddSprintOpen(false)}
              onSuccess={() => setIsAddSprintOpen(false)}
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
            />
          </div>
        </div>
      )}
    </>
  );
}
