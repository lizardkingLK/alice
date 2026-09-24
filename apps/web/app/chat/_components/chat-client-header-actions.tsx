'use client';

import Link from 'next/link';
import { toast } from '@repo/ui/components/ui/sonner';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  Cpu,
  MoreHorizontal,
  Plus,
  Settings2,
  Star,
  X,
} from '@repo/ui/lib/icons';
import type { ChatModelOption } from '@repo/types';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';
import {
  chatModelDisplayLabel,
  chatProviderDisplayLabel,
  groupChatModelsByProvider,
} from '@/app/chat/_services/chat-models-api.shared';

type ChatClientHeaderActionsProps = {
  readonly variant: 'page' | 'drawer';
  readonly isPending: boolean;
  readonly chatModels: readonly ChatModelOption[];
  readonly selectedIntegrationId: string | undefined;
  readonly canManageChatModels: boolean;
  readonly isMarkingDefault: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectedIntegrationIdChange: (value: string) => void;
  readonly onMarkSelectedAsDefault: () => Promise<void>;
  readonly onNewChat: () => void;
  readonly onClose?: () => void;
};

function ChatModelProviderSubmenus({
  chatModels,
  selectedIntegrationId,
  onSelectedIntegrationIdChange,
}: Readonly<{
  chatModels: readonly ChatModelOption[];
  selectedIntegrationId: string | undefined;
  // eslint-disable-next-line no-unused-vars
  onSelectedIntegrationIdChange: (value: string) => void;
}>) {
  const groups = groupChatModelsByProvider(chatModels);

  return (
    <>
      {groups.map((group) => (
        <DropdownMenuSub key={group.provider}>
          <DropdownMenuSubTrigger>
            {chatProviderDisplayLabel(group.provider)}
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="min-w-56">
            <DropdownMenuRadioGroup
              value={selectedIntegrationId}
              onValueChange={onSelectedIntegrationIdChange}
            >
              {group.models.map((model) => (
                <DropdownMenuRadioItem key={model.id} value={model.id}>
                  {chatModelDisplayLabel(model)}
                </DropdownMenuRadioItem>
              ))}
            </DropdownMenuRadioGroup>
          </DropdownMenuSubContent>
        </DropdownMenuSub>
      ))}
    </>
  );
}

function selectedChatModelLabel(
  chatModels: readonly ChatModelOption[],
  selectedIntegrationId: string | undefined
): string {
  const selected = chatModels.find(
    (model) => model.id === selectedIntegrationId
  );
  return selected ? chatModelDisplayLabel(selected) : 'Select model';
}

function ModelPickerIconButton({
  chatModels,
  selectedIntegrationId,
  isPending,
  canManageChatModels,
  isMarkingDefault,
  onSelectedIntegrationIdChange,
  onMarkSelectedAsDefault,
}: Readonly<{
  chatModels: readonly ChatModelOption[];
  selectedIntegrationId: string | undefined;
  isPending: boolean;
  canManageChatModels: boolean;
  isMarkingDefault: boolean;
  // eslint-disable-next-line no-unused-vars
  onSelectedIntegrationIdChange: (value: string) => void;
  onMarkSelectedAsDefault: () => Promise<void>;
}>) {
  const selectedModel = chatModels.find(
    (model) => model.id === selectedIntegrationId
  );
  const showMarkDefault =
    canManageChatModels && Boolean(selectedModel) && !selectedModel?.is_default;
  const modelLabel = selectedChatModelLabel(chatModels, selectedIntegrationId);

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isPending}
              aria-label={`Chat model: ${modelLabel}`}
            >
              <Cpu className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">{modelLabel}</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Provider</DropdownMenuLabel>
        <ChatModelProviderSubmenus
          chatModels={chatModels}
          selectedIntegrationId={selectedIntegrationId}
          onSelectedIntegrationIdChange={onSelectedIntegrationIdChange}
        />
        {showMarkDefault ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              disabled={isPending || isMarkingDefault}
              onSelect={() => {
                onMarkSelectedAsDefault()
                  .then(() => {
                    toast.success('Default chat model updated', {
                      description: 'New chats will use this model by default.',
                    });
                  })
                  .catch((error: unknown) => {
                    toast.error('Could not update default model', {
                      description:
                        error instanceof Error
                          ? error.message
                          : 'Try again in a moment.',
                    });
                  });
              }}
            >
              <Star className="size-4 text-amber-500 dark:text-amber-400" />
              Mark as workspace default
            </DropdownMenuItem>
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function NewChatOrAdminPlusButton({
  canManageChatModels,
  isPending,
  onNewChat,
}: Readonly<{
  canManageChatModels: boolean;
  isPending: boolean;
  onNewChat: () => void;
}>) {
  if (!canManageChatModels) {
    return (
      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={isPending}
            aria-label="New chat"
            onClick={onNewChat}
          >
            <Plus className="size-4" />
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">New chat</TooltipContent>
      </Tooltip>
    );
  }

  return (
    <DropdownMenu>
      <Tooltip>
        <TooltipTrigger asChild>
          <DropdownMenuTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              disabled={isPending}
              aria-label="New chat or configure models"
            >
              <Plus className="size-4" />
            </Button>
          </DropdownMenuTrigger>
        </TooltipTrigger>
        <TooltipContent side="bottom">New chat or configure</TooltipContent>
      </Tooltip>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={onNewChat} disabled={isPending}>
          <Plus className="size-4" />
          New chat
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href={chatAiAgentsIntegrationsHref()}>
            <Settings2 className="size-4" />
            Configure AI models
          </Link>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ChatClientHeaderActions({
  variant,
  isPending,
  chatModels,
  selectedIntegrationId,
  canManageChatModels,
  isMarkingDefault,
  onSelectedIntegrationIdChange,
  onMarkSelectedAsDefault,
  onNewChat,
  onClose,
}: Readonly<ChatClientHeaderActionsProps>) {
  const hasModels = chatModels.length > 0;

  if (!hasModels) {
    if (variant === 'drawer' && onClose) {
      return (
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              onClick={onClose}
              aria-label="Close chat"
            >
              <X className="size-4" />
            </Button>
          </TooltipTrigger>
          <TooltipContent side="bottom">Close</TooltipContent>
        </Tooltip>
      );
    }

    // Still allow admins to reach model settings when none are configured.
    if (variant === 'page' && canManageChatModels) {
      return (
        <NewChatOrAdminPlusButton
          canManageChatModels={canManageChatModels}
          isPending={isPending}
          onNewChat={onNewChat}
        />
      );
    }

    return null;
  }

  if (variant === 'drawer' && onClose) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            aria-label="Chat actions"
          >
            <MoreHorizontal className="size-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-60">
          <DropdownMenuItem onClick={onNewChat} disabled={isPending}>
            <Plus className="size-4" />
            New chat
          </DropdownMenuItem>
          {canManageChatModels ? (
            <DropdownMenuItem asChild>
              <Link href={chatAiAgentsIntegrationsHref()}>
                <Settings2 className="size-4" />
                Configure AI models
              </Link>
            </DropdownMenuItem>
          ) : null}
          <DropdownMenuSeparator />
          <DropdownMenuLabel>Model</DropdownMenuLabel>
          <ChatModelProviderSubmenus
            chatModels={chatModels}
            selectedIntegrationId={selectedIntegrationId}
            onSelectedIntegrationIdChange={onSelectedIntegrationIdChange}
          />
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={onClose}>
            <X className="size-4" />
            Close
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <ModelPickerIconButton
        chatModels={chatModels}
        selectedIntegrationId={selectedIntegrationId}
        isPending={isPending}
        canManageChatModels={canManageChatModels}
        isMarkingDefault={isMarkingDefault}
        onSelectedIntegrationIdChange={onSelectedIntegrationIdChange}
        onMarkSelectedAsDefault={onMarkSelectedAsDefault}
      />
      <NewChatOrAdminPlusButton
        canManageChatModels={canManageChatModels}
        isPending={isPending}
        onNewChat={onNewChat}
      />
    </>
  );
}
