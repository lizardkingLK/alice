'use client';

import { useCallback, useState } from 'react';
import { useRouter } from 'next/navigation';
import { apiFetch } from '@/lib/api/api-fetch.mutations.use.client';
import { errorMessage } from '@/lib/errors/error-message';

export type UseIntegrationSettingsSaveOptions = {
  readonly projectId: string;
  readonly expectedUpdatedAt: string;
  readonly successMessage: string;
  readonly logLabel: string;
  readonly onSuccess?: () => void;
};

/**
 * Shared save flow for project integration settings cards (Jira / GitHub):
 * PUT project → success/error message → optional callback → router.refresh.
 */
export function useIntegrationSettingsSave({
  projectId,
  expectedUpdatedAt,
  successMessage,
  logLabel,
  onSuccess,
}: UseIntegrationSettingsSaveOptions) {
  const router = useRouter();
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isError, setIsError] = useState(false);

  const clearFeedback = useCallback(() => {
    setMessage(null);
    setIsError(false);
  }, []);

  const setFailure = useCallback((msg: string) => {
    setMessage(msg);
    setIsError(true);
  }, []);

  const save = useCallback(
    async (body: Record<string, unknown>): Promise<boolean> => {
      setIsSaving(true);
      clearFeedback();

      try {
        await apiFetch(`/api/projects/${projectId}`, {
          method: 'PUT',
          body: JSON.stringify({
            ...body,
            expectedUpdatedAt,
          }),
        });
        setMessage(successMessage);
        setIsError(false);
        onSuccess?.();
        router.refresh();
        return true;
      } catch (err) {
        console.error(logLabel, errorMessage(err, ''));
        setFailure(errorMessage(err, 'Failed to save configuration'));
        return false;
      } finally {
        setIsSaving(false);
      }
    },
    [
      clearFeedback,
      expectedUpdatedAt,
      logLabel,
      onSuccess,
      projectId,
      router,
      setFailure,
      successMessage,
    ]
  );

  return {
    isSaving,
    message,
    isError,
    setMessage,
    setIsError,
    clearFeedback,
    setFailure,
    save,
  };
}
