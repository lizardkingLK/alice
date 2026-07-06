'use client';

import { useCallback, useEffect, useState } from 'react';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { SprintForm } from '@/app/sprints/_components/sprint-form';
import { listSprints, Sprint } from '@/app/sprints/_services/sprints.service';

interface SprintsWorkspaceProps {
  readonly initialSprints: Sprint[];
}

export function SprintsWorkspace({
  initialSprints,
}: Readonly<SprintsWorkspaceProps>) {
  const [sprints, setSprints] = useState<Sprint[]>(initialSprints);
  const [isLoading, setIsLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [isAddSprintOpen, setIsAddSprintOpen] = useState(false);
  const [editingSprint, setEditingSprint] = useState<Sprint | null>(null);

  const refreshSprints = useCallback(async () => {
    setLoadError(null);
    setIsLoading(true);

    try {
      const nextSprints = await listSprints();
      setSprints(nextSprints);
    } catch (error) {
      const message =
        error instanceof Error ? error.message : 'Failed to load sprints.';
      setLoadError(message);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    setSprints(initialSprints);
  }, [initialSprints]);

  const handleSprintCreated = (sprint: Sprint) => {
    setSprints((current) => [sprint, ...current]);
  };

  const handleSprintUpdated = (updatedSprint: Sprint) => {
    setSprints((current) =>
      current.map((s) => (s.id === updatedSprint.id ? updatedSprint : s))
    );
  };

  return (
    <>
      <div className="w-full">
        <SprintList
          sprints={sprints}
          isLoading={isLoading}
          error={loadError}
          onRetry={refreshSprints}
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
