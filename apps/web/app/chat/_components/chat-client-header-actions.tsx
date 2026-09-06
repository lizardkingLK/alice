'use client';

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
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { ChevronDown, MoreHorizontal, Plus, X } from '@repo/ui/lib/icons';
import type { ChatModelOption } from '@repo/types';
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
  // eslint-disable-next-line no-unused-vars
  readonly onSelectedIntegrationIdChange: (value: string) => void;
  readonly onNewChat: () => void;
  readonly onClose?: () => void;
};

function NewChatButton({
  disabled,
  onNewChat,
}: Readonly<{
  disabled?: boolean;
  onNewChat: () => void;
}>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type="button"
          variant="default"
          onClick={onNewChat}
          disabled={disabled}
        >
          <Plus data-icon="inline-start" />
          New Chat
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">Start a new chat</TooltipContent>
    </Tooltip>
  );
}

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

export default function ChatClientHeaderActions({
  variant,
  isPending,
  chatModels,
  selectedIntegrationId,
  onSelectedIntegrationIdChange,
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
            New Chat
          </DropdownMenuItem>
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            type="button"
            variant="outline"
            disabled={isPending}
            aria-label="Chat model"
            className="bg-background/50 border-border/80 h-9 w-56 justify-between px-2 text-xs font-medium"
          >
            <TruncatedText className="min-w-0 flex-1 text-left text-xs font-medium">
              {selectedChatModelLabel(chatModels, selectedIntegrationId)}
            </TruncatedText>
            <ChevronDown className="size-3.5 shrink-0 opacity-60" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuLabel>Provider</DropdownMenuLabel>
          <ChatModelProviderSubmenus
            chatModels={chatModels}
            selectedIntegrationId={selectedIntegrationId}
            onSelectedIntegrationIdChange={onSelectedIntegrationIdChange}
          />
        </DropdownMenuContent>
      </DropdownMenu>

      <NewChatButton disabled={isPending} onNewChat={onNewChat} />
    </>
  );
}
