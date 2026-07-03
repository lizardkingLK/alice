'use client';

import { useCallback, useEffect, useState } from 'react';
import { CreateSprintForm } from '@/components/sprints/create-sprint-form';
import { SprintList } from '@/components/sprints/sprint-list';
import { listSprints, type Sprint } from '@/lib/api-client';

export function SprintsWorkspace() {
  const [sprints, setSprints] = useState<Sprint[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshSprints = useCallback(async () => {
    setLoadError(null);

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
    refreshSprints();
  }, [refreshSprints]);

  const handleSprintCreated = (sprint: Sprint) => {
    setSprints((current) => [sprint, ...current]);
  };

  const handleSprintUpdated = (updatedSprint: Sprint) => {
    setSprints((current) =>
      current.map((s) => (s.id === updatedSprint.id ? updatedSprint : s))
    );
  };

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,22rem)_1fr]">
      <CreateSprintForm onSprintCreated={handleSprintCreated} />
      <SprintList
        sprints={sprints}
        isLoading={isLoading}
        error={loadError}
        onRetry={refreshSprints}
        onSprintUpdated={handleSprintUpdated}
      />
    </div>
  );
}
