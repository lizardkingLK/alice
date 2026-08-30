'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { MoreHorizontal, Plus, X } from '@repo/ui/lib/icons';
import type { ChatModelOption } from '@repo/types';
import { chatModelDisplayLabel } from '@/app/chat/_services/chat-models-api.shared';
import { chatAiAgentsIntegrationsHref } from '@/app/chat/_services/chat-integrations-navigation.shared';

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

function AddModelButton({ disabled }: Readonly<{ disabled?: boolean }>) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button type="button" variant="default" disabled={disabled} asChild>
          <Link href={chatAiAgentsIntegrationsHref()}>
            <Plus data-icon="inline-start" />
            Add Model
          </Link>
        </Button>
      </TooltipTrigger>
      <TooltipContent side="bottom">
        Configure a chat model in Settings
      </TooltipContent>
    </Tooltip>
  );
}

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
        <div className="flex items-center gap-1">
          <AddModelButton disabled={isPending} />
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
        </div>
      );
    }

    return <AddModelButton disabled={isPending} />;
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
          <DropdownMenuRadioGroup
            value={selectedIntegrationId}
            onValueChange={onSelectedIntegrationIdChange}
          >
            {chatModels.map((model) => (
              <DropdownMenuRadioItem key={model.id} value={model.id}>
                {chatModelDisplayLabel(model)}
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
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
      <Select
        value={selectedIntegrationId}
        onValueChange={onSelectedIntegrationIdChange}
        disabled={isPending}
      >
        <SelectTrigger
          aria-label="Chat model"
          className="bg-background/50 border-border/80 h-9 w-37.5 px-2 text-xs font-medium"
        >
          <SelectValue placeholder="Select model" />
        </SelectTrigger>
        <SelectContent>
          {chatModels.map((model) => (
            <SelectItem key={model.id} value={model.id}>
              {chatModelDisplayLabel(model)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <NewChatButton disabled={isPending} onNewChat={onNewChat} />
    </>
  );
}
