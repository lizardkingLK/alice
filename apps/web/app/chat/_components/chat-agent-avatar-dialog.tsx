'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import { Dices } from '@repo/ui/lib/icons';
import {
  CHAT_AGENT_AVATAR_STYLES,
  isChatAgentAvatarStyle,
  type ChatAgentAvatarStyle,
} from '@/app/chat/_helpers/chat-agent-avatar';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';
import type { ChatAgentKind } from '@/app/chat/_helpers/chat-agents-catalog';

type ChatAgentAvatarDialogProps = {
  readonly open: boolean;
  readonly name: string;
  readonly kind: ChatAgentKind;
  readonly avatarStyle: ChatAgentAvatarStyle;
  readonly avatarSeed: string;
  readonly readOnly?: boolean;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onAvatarStyleChange: (style: ChatAgentAvatarStyle) => void;
  // eslint-disable-next-line no-unused-vars
  readonly onAvatarSeedChange: (seed: string) => void;
  readonly onShuffleSeed: () => void;
};

export function ChatAgentAvatarDialog({
  open,
  name,
  kind,
  avatarStyle,
  avatarSeed,
  readOnly = false,
  onOpenChange,
  onAvatarStyleChange,
  onAvatarSeedChange,
  onShuffleSeed,
}: Readonly<ChatAgentAvatarDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Customize portrait</DialogTitle>
          <DialogDescription>
            Avatars are generated with DiceBear. Change the style or seed to get
            a new look.
          </DialogDescription>
        </DialogHeader>

        <div className="flex flex-col items-center gap-4 py-2">
          <ChatAgentAvatar
            name={name}
            kind={kind}
            avatarStyle={avatarStyle}
            avatarSeed={avatarSeed}
            size="xl"
            className="shadow-sm ring-1 ring-black/5"
          />
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="agent-avatar-style">Portrait style</Label>
            <Select
              value={avatarStyle}
              disabled={readOnly}
              onValueChange={(value) => {
                if (!isChatAgentAvatarStyle(value)) {
                  return;
                }
                onAvatarStyleChange(value);
              }}
            >
              <SelectTrigger id="agent-avatar-style" className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CHAT_AGENT_AVATAR_STYLES.map((style) => (
                  <SelectItem key={style} value={style}>
                    {style}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="agent-avatar-seed">Portrait seed</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="agent-avatar-seed"
                value={avatarSeed}
                disabled={readOnly}
                onChange={(event) => onAvatarSeedChange(event.target.value)}
                className="min-w-0 flex-1"
              />
              <Button
                type="button"
                variant="outline"
                disabled={readOnly}
                onClick={onShuffleSeed}
              >
                <Dices data-icon="inline-start" />
                Shuffle
              </Button>
            </div>
          </div>
        </div>

        <DialogFooter>
          <Button type="button" onClick={() => onOpenChange(false)}>
            Done
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
