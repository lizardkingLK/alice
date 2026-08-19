'use client';

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
import { CHAT_MODELS, type ChatModelValue } from '@repo/types';

type ChatClientHeaderActionsProps = {
  readonly variant: 'page' | 'drawer';
  readonly isPending: boolean;
  readonly selectedModelId: ChatModelValue;
  // eslint-disable-next-line no-unused-vars
  readonly onSelectedModelIdChange: (value: ChatModelValue) => void;
  readonly onNewChat: () => void;
  readonly onClose?: () => void;
};

export default function ChatClientHeaderActions({
  variant,
  isPending,
  selectedModelId,
  onSelectedModelIdChange,
  onNewChat,
  onClose,
}: Readonly<ChatClientHeaderActionsProps>) {
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
            value={selectedModelId}
            onValueChange={(v) => onSelectedModelIdChange(v as ChatModelValue)}
          >
            {Object.values(CHAT_MODELS).map((model) => (
              <DropdownMenuRadioItem key={model.value} value={model.value}>
                {model.label}
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
        value={selectedModelId}
        onValueChange={(v) => onSelectedModelIdChange(v as ChatModelValue)}
      >
        <SelectTrigger
          aria-label="Chat model"
          className="bg-background/50 border-border/80 h-9 w-37.5 px-2 text-xs font-medium"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.values(CHAT_MODELS).map((model) => (
            <SelectItem key={model.value} value={model.value}>
              {model.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Tooltip>
        <TooltipTrigger asChild>
          <Button
            type="button"
            variant="default"
            onClick={onNewChat}
            disabled={isPending}
          >
            <Plus data-icon="inline-start" />
            New Chat
          </Button>
        </TooltipTrigger>
        <TooltipContent side="bottom">Start a new chat</TooltipContent>
      </Tooltip>
    </>
  );
}
