'use client';

import { useCallback, useEffect, useState } from 'react';
import type { ChatModelOption } from '@repo/types';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import {
  pickDefaultChatIntegrationId,
  resolveSelectedChatIntegrationId,
  withDefaultChatIntegration,
} from '@/app/chat/_services/chat-models-api.shared';
import { patchWorkspaceIntegration } from '@/app/settings/_services/integrations.mutations.client';
import { errorMessage } from '@/lib/errors/error-message';

export function useWorkspaceChatModels(initialChatModels?: ChatModelOption[]) {
  const [chatModels, setChatModels] = useState<ChatModelOption[]>(
    () => initialChatModels ?? []
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | undefined
  >(() => pickDefaultChatIntegrationId(initialChatModels ?? []));
  const [isMarkingDefault, setIsMarkingDefault] = useState(false);

  useEffect(() => {
    if (initialChatModels !== undefined) {
      return;
    }

    let cancelled = false;

    const loadModels = async () => {
      const models = await listChatModelsForChatClient();
      if (cancelled) {
        return;
      }

      setChatModels(models);
      setSelectedIntegrationId((current) =>
        resolveSelectedChatIntegrationId(models, current)
      );
    };

    loadModels().catch((error) => {
      console.error('Failed to list chat models:', error);
    });

    return () => {
      cancelled = true;
    };
  }, [initialChatModels]);

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
    markSelectedAsDefault,
  };
}
