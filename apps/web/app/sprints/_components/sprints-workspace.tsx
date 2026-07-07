'use client';

import { useCallback, useEffect, useState } from 'react';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { listSprints, Sprint } from '@/app/sprints/_services/sprints.service';

interface SprintsWorkspaceProps {
  readonly initialSprints: Sprint[];
  readonly initialPagination: {
    page: number;
    limit: number;
    totalCount: number;
    totalPages: number;
  };
}

export function SprintsWorkspace({
  initialSprints,
  initialPagination,
}: Readonly<SprintsWorkspaceProps>) {
  const [filterTab, setFilterTab] = useState<'active' | 'archived'>('active');
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);
  const [pagination, setPagination] = useState(initialPagination);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddSprintOpen, setIsAddSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  const fetchSprints = useCallback(async (tab: 'active' | 'archived', page: number) => {
    setLoadError(null);
    setIsLoading(true);

    try {
      const result = await listSprints(tab, page);
      setSprints(result.sprints);
      setPagination(result.pagination);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load sprints.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  const handleTabChange = async (nextTab: 'active' | 'archived') => {
    setFilterTab(nextTab);
    await fetchSprints(nextTab, 1);
  };

  const handlePageChange = async (nextPage: number) => {
    await fetchSprints(filterTab, nextPage);
  };

  const handleRetry = async () => {
    await fetchSprints(filterTab, pagination.page);
  };

  useEffect(() => {
    setFilterTab('active');
    setSprints(initialSprints);
    setPagination(initialPagination);
  }, [initialSprints, initialPagination]);

  const handleSprintCreated = async () => {
    setFilterTab('active');
    await fetchSprints('active', 1);
  };

  const handleSprintUpdated = async () => {
    await fetchSprints(filterTab, pagination.page);
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
          isLoading={isLoading}
          error={loadError}
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
