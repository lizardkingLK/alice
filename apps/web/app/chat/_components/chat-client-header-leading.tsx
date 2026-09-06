'use client';

import Link from 'next/link';
import { toast } from '@repo/ui/components/ui/sonner';
import { Button } from '@repo/ui/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Plus, Star } from '@repo/ui/lib/icons';
import type { ChatModelOption } from '@repo/types';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';

type ChatClientHeaderLeadingProps = {
  readonly chatModels: readonly ChatModelOption[];
  readonly selectedIntegrationId: string | undefined;
  readonly canManageChatModels: boolean;
  readonly isPending: boolean;
  readonly isMarkingDefault: boolean;
  readonly onMarkSelectedAsDefault: () => Promise<void>;
};

export default function ChatClientHeaderLeading({
  chatModels,
  selectedIntegrationId,
  canManageChatModels,
  isPending,
  isMarkingDefault,
  onMarkSelectedAsDefault,
}: Readonly<ChatClientHeaderLeadingProps>) {
  const selectedModel = chatModels.find(
    (model) => model.id === selectedIntegrationId
  );
  const showMarkDefault =
    canManageChatModels && Boolean(selectedModel) && !selectedModel?.is_default;

  return (
    <div className="flex shrink-0 items-center gap-0.5">
      <Tooltip>
        <TooltipTrigger asChild>
          <Button type="button" variant="ghost" size="icon" asChild>
            <Link href={chatAiAgentsIntegrationsHref()} aria-label="Add model">
              <Plus className="size-4" />
            </Link>
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">
          Add or configure models in Settings
        </TooltipContent>
      </Tooltip>

      {showMarkDefault ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isPending || isMarkingDefault}
              aria-label="Mark as default model"
              onClick={() => {
                onMarkSelectedAsDefault()
                  .then(() => {
                    toast.success('Default chat model updated');
                  })
                  .catch((error: unknown) => {
                    toast.error(
                      error instanceof Error
                        ? error.message
                        : 'Could not set the default chat model.'
                    );
                  });
              }}
            >
              <Star className="size-4 text-amber-500 dark:text-amber-400" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Mark this model as the workspace default
          </TooltipContent>
        </Tooltip>
      ) : null}
    </div>
  );
}
