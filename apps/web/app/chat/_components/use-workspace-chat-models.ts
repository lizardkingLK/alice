'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatModelOption } from '@repo/types';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import {
  pickDefaultChatIntegrationId,
  resolveSelectedChatIntegrationId,
  withDefaultChatIntegration,
} from '@/app/chat/_services/chat-models-api.shared';
import { getMemberChatModelPreference } from '@/app/chat/_services/member-chat-model-preference.client';
import { patchWorkspaceIntegration } from '@/app/settings/_services/integrations.mutations.client';
import { errorMessage } from '@/lib/errors/error-message';

export type UseWorkspaceChatModelsOptions = {
  readonly initialChatModels?: ChatModelOption[];
  /**
   * When true and no SSR models, skip the mount fetch. Call
   * `ensureModelsLoaded` when the model dropdown opens (dock/widget).
   */
  readonly lazy?: boolean;
};

export function useWorkspaceChatModels(
  options?: UseWorkspaceChatModelsOptions | ChatModelOption[]
) {
  const normalized: UseWorkspaceChatModelsOptions = Array.isArray(options)
    ? { initialChatModels: options }
    : (options ?? {});
  const { initialChatModels, lazy = false } = normalized;

  const [chatModels, setChatModels] = useState<ChatModelOption[]>(
    () => initialChatModels ?? []
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | undefined
  >(() => pickDefaultChatIntegrationId(initialChatModels ?? []));
  const [isMarkingDefault, setIsMarkingDefault] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  const loadedRef = useRef(initialChatModels !== undefined);
  const inFlightRef = useRef(false);

  const ensureModelsLoaded = useCallback(async () => {
    if (loadedRef.current || inFlightRef.current) {
      return;
    }

    inFlightRef.current = true;
    setIsLoadingModels(true);
    try {
      const [models, preference] = await Promise.all([
        listChatModelsForChatClient(),
        getMemberChatModelPreference().catch(() => ({
          default_integration_id: null as string | null,
        })),
      ]);
      setChatModels(models);
      setSelectedIntegrationId((current) =>
        resolveSelectedChatIntegrationId(
          models,
          current,
          preference.default_integration_id
        )
      );
      loadedRef.current = true;
    } catch (error) {
      console.error('Failed to list chat models:', error);
    } finally {
      inFlightRef.current = false;
      setIsLoadingModels(false);
    }
  }, []);

  useEffect(() => {
    if (initialChatModels !== undefined) {
      setChatModels(initialChatModels);
      let cancelled = false;
      getMemberChatModelPreference()
        .then((preference) => {
          if (cancelled) {
            return;
          }
          setSelectedIntegrationId((current) =>
            resolveSelectedChatIntegrationId(
              initialChatModels,
              current,
              preference.default_integration_id
            )
          );
        })
        .catch(() => {
          if (cancelled) {
            return;
          }
          setSelectedIntegrationId((current) =>
            resolveSelectedChatIntegrationId(initialChatModels, current)
          );
        });
      loadedRef.current = true;
      return () => {
        cancelled = true;
      };
    }

    if (lazy) {
      return;
    }

    ensureModelsLoaded().catch(() => undefined);
  }, [ensureModelsLoaded, initialChatModels, lazy]);

  const markSelectedAsDefault = useCallback(async () => {
    if (!selectedIntegrationId || isMarkingDefault) {
      return;
    }

    setIsMarkingDefault(true);
    try {
      await patchWorkspaceIntegration(selectedIntegrationId, {
        is_default: true,
      });
      setChatModels((models) =>
        withDefaultChatIntegration(models, selectedIntegrationId)
      );
    } catch (error) {
      console.error('Failed to mark chat model as default:', error);
      throw new Error(
        errorMessage(error, 'Could not set the default chat model.')
      );
    } finally {
      setIsMarkingDefault(false);
    }
  }, [isMarkingDefault, selectedIntegrationId]);

  return {
    chatModels,
    selectedIntegrationId,
    setSelectedIntegrationId,
    isMarkingDefault,
    isLoadingModels,
    ensureModelsLoaded,
    markSelectedAsDefault,
  };
}
