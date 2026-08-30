'use client';

import { useEffect, useState } from 'react';
import type { ChatModelOption } from '@repo/types';
import { listChatModelsForChatClient } from '@/app/chat/_services/chat-models.reads.client';
import {
  pickDefaultChatIntegrationId,
  resolveSelectedChatIntegrationId,
} from '@/app/chat/_services/chat-models-api.shared';

export function useWorkspaceChatModels(initialChatModels?: ChatModelOption[]) {
  const [chatModels, setChatModels] = useState<ChatModelOption[]>(
    () => initialChatModels ?? []
  );
  const [selectedIntegrationId, setSelectedIntegrationId] = useState<
    string | undefined
  >(() => pickDefaultChatIntegrationId(initialChatModels ?? []));

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

  return {
    chatModels,
    selectedIntegrationId,
    setSelectedIntegrationId,
  };
}
