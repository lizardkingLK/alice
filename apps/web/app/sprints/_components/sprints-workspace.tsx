'use client';

import { useCallback, useEffect, useState } from 'react';
import { listSprints, type Sprint } from '@/lib/api-client';
import { SprintList } from '@/app/sprints/_components/sprint-list';
import { CreateSprintForm } from '@/app/sprints/_components/create-sprint-form';

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
        />
      </div>

      {isAddSprintOpen && (
        <div className="animate-in fade-in fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm duration-200">
          <div className="animate-in fade-in zoom-in-95 w-full max-w-lg overflow-hidden duration-200">
            <CreateSprintForm
              onSprintCreated={handleSprintCreated}
              onClose={() => setIsAddSprintOpen(false)}
              onSuccess={() => setIsAddSprintOpen(false)}
            />
          </div>
        </div>
      )}
    </>
  );
}
