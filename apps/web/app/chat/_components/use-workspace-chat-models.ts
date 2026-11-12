'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChatModelOption } from '@repo/types';
import {
  readCachedChatModels,
  writeCachedChatModels,
} from '@/app/chat/_helpers/chat-models-storage';
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
  /** Scopes the localStorage warm cache (optional). */
  readonly userId?: string | null;
  /**
   * When true and no SSR/seed models, skip the hook mount fetch. Callers
   * (dock/widget) still invoke `ensureModelsLoaded` so the empty gate / spinner
   * can resolve.
   */
  readonly lazy?: boolean;
};

export function useWorkspaceChatModels(
  options?: UseWorkspaceChatModelsOptions | ChatModelOption[]
) {
  const normalized: UseWorkspaceChatModelsOptions = Array.isArray(options)
    ? { initialChatModels: options }
    : (options ?? {});
  const { initialChatModels, lazy = false, userId = null } = normalized;
  const cachedModels =
    initialChatModels === undefined ? readCachedChatModels(userId) : null;
  const seedModels = initialChatModels ?? cachedModels ?? [];

  const [chatModels, setChatModels] = useState<ChatModelOption[]>(
    () => seedModels
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | undefined
  >(() => pickDefaultChatIntegrationId(seedModels));
  const [isMarkingDefault, setIsMarkingDefault] = useState(false);
  const [isLoadingModels, setIsLoadingModels] = useState(false);
  /**
   * True once SSR models arrived, a warm cache hydrated, or a client fetch
   * finished — so the empty gate can render without waiting on the network.
   */
  const [modelsReady, setModelsReady] = useState(
    () => initialChatModels !== undefined || cachedModels !== null
  );
  /** SSR / live network load only — warm cache does not set this. */
  const loadedRef = useRef(initialChatModels !== undefined);
  const inFlightRef = useRef(false);
  const chatModelsRef = useRef(chatModels);
  const userIdRef = useRef(userId);
  chatModelsRef.current = chatModels;
  userIdRef.current = userId;

  const persistModels = useCallback((models: readonly ChatModelOption[]) => {
    writeCachedChatModels(userIdRef.current, models);
  }, []);

  const ensureModelsLoaded = useCallback(async (): Promise<
    ChatModelOption[]
  > => {
    if (loadedRef.current) {
      return chatModelsRef.current;
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
      persistModels(models);
      setSelectedIntegrationId((current) =>
        resolveSelectedChatIntegrationId(
          models,
          current,
          preference.default_integration_id
        )
      );
      loadedRef.current = true;
      return models;
    } catch (error) {
      console.error('Failed to list chat models:', error);
      return chatModelsRef.current;
    } finally {
      inFlightRef.current = false;
      setIsLoadingModels(false);
      setModelsReady(true);
    }
  }, [persistModels]);

  useEffect(() => {
    if (initialChatModels !== undefined) {
      setChatModels(initialChatModels);
      persistModels(initialChatModels);
      setModelsReady(true);
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
  }, [ensureModelsLoaded, initialChatModels, lazy, persistModels]);

  const markSelectedAsDefault = useCallback(async () => {
    if (!selectedIntegrationId || isMarkingDefault) {
      return;
    }

    setIsMarkingDefault(true);
    try {
      await patchWorkspaceIntegration(selectedIntegrationId, {
        is_default: true,
      });
      setChatModels((models) => {
        const next = withDefaultChatIntegration(models, selectedIntegrationId);
        persistModels(next);
        return next;
      });
    } catch (error) {
      console.error('Failed to mark chat model as default:', error);
      throw new Error(
        errorMessage(error, 'Could not set the default chat model.')
      );
    } finally {
      setIsMarkingDefault(false);
    }
  }, [isMarkingDefault, persistModels, selectedIntegrationId]);

  return {
    chatModels,
    selectedIntegrationId,
    setSelectedIntegrationId,
    isMarkingDefault,
    isLoadingModels,
    modelsReady,
    ensureModelsLoaded,
    markSelectedAsDefault,
  };
}
