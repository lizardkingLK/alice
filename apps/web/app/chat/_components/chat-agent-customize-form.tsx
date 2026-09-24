'use client';

import type { ReactNode } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Button } from '@repo/ui/components/ui/button';
import { Camera } from '@repo/ui/lib/icons';
import type { ChatAgentAutonomy } from '@/app/chat/_helpers/chat-agents-catalog';
import type { ChatAgentKind } from '@/app/chat/_helpers/chat-agents-catalog';
import type { ChatAgentAvatarStyle } from '@/app/chat/_helpers/chat-agent-avatar';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';

export type ChatAgentCustomizeDraft = {
  name: string;
  title: string;
  description: string;
  instructions: string;
  tagline: string;
  skills: string;
  tools: string;
  autonomy: ChatAgentAutonomy;
  avatarStyle: ChatAgentAvatarStyle;
  avatarSeed: string;
};

type ChatAgentCustomizeFormProps = {
  readonly draft: ChatAgentCustomizeDraft;
  readonly kind: ChatAgentKind;
  readonly canEdit: boolean;
  readonly showCamera: boolean;
  readonly onOpenAvatarDialog: () => void;
  // eslint-disable-next-line no-unused-vars
  readonly onDraftChange: (patch: Partial<ChatAgentCustomizeDraft>) => void;
};

function MultilineText({ value }: Readonly<{ value: string }>) {
  return (
    <p className="text-foreground text-sm leading-relaxed whitespace-pre-wrap">
      {value.trim() ? value : '—'}
    </p>
  );
}

function ReadOnlyField({
  label,
  children,
}: Readonly<{ label: string; children: ReactNode }>) {
  return (
    <div className="space-y-1.5">
      <p className="text-muted-foreground text-xs font-medium tracking-wide uppercase">
        {label}
      </p>
      {children}
    </div>
  );
}

export function ChatAgentCustomizeForm({
  draft,
  kind,
  canEdit,
  showCamera,
  onOpenAvatarDialog,
  onDraftChange,
}: Readonly<ChatAgentCustomizeFormProps>) {
  return (
    <div className="grid grid-cols-1 gap-8 lg:grid-cols-2 lg:gap-10">
      <section className="space-y-4">
        <div className="flex items-start gap-3">
          <ChatAgentAvatar
            name={draft.name}
            kind={kind}
            avatarStyle={draft.avatarStyle}
            avatarSeed={draft.avatarSeed}
            size="xl"
            className="shadow-sm ring-1 ring-black/5"
          />
          {showCamera ? (
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  aria-label="Customize portrait"
                  onClick={onOpenAvatarDialog}
                >
                  <Camera className="size-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent side="right">Customize portrait</TooltipContent>
            </Tooltip>
          ) : null}
        </div>

        {canEdit ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="agent-name">Name</Label>
              <Input
                id="agent-name"
                value={draft.name}
                placeholder="e.g. Alex"
                onChange={(event) =>
                  onDraftChange({ name: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-title">Title</Label>
              <Input
                id="agent-title"
                value={draft.title}
                placeholder="e.g. Project Manager"
                onChange={(event) =>
                  onDraftChange({ title: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-persona">Persona</Label>
              <Input
                id="agent-persona"
                value={draft.tagline}
                onChange={(event) =>
                  onDraftChange({ tagline: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-description">Description</Label>
              <Textarea
                id="agent-description"
                rows={5}
                value={draft.description}
                onChange={(event) =>
                  onDraftChange({ description: event.target.value })
                }
              />
            </div>
          </>
        ) : (
          <>
            <ReadOnlyField label="Name">
              <p className="text-foreground text-sm font-medium">
                {draft.name}
              </p>
            </ReadOnlyField>
            <ReadOnlyField label="Title">
              <p className="text-foreground text-sm">
                {draft.title.trim() ? draft.title : '—'}
              </p>
            </ReadOnlyField>
            <ReadOnlyField label="Persona">
              <p className="text-foreground text-sm">{draft.tagline}</p>
            </ReadOnlyField>
            <ReadOnlyField label="Description">
              <MultilineText value={draft.description} />
            </ReadOnlyField>
          </>
        )}
      </section>

      <section className="space-y-4">
        {canEdit ? (
          <>
            <div className="space-y-2">
              <Label htmlFor="agent-instructions">Instructions</Label>
              <Textarea
                id="agent-instructions"
                rows={8}
                value={draft.instructions}
                className="font-mono text-xs leading-relaxed"
                onChange={(event) =>
                  onDraftChange({ instructions: event.target.value })
                }
              />
              <p className="text-muted-foreground text-xs">
                Only projects you are a member of are in scope for this agent.
              </p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-skills">Skills</Label>
              <Textarea
                id="agent-skills"
                rows={4}
                value={draft.skills}
                placeholder="One skill per line"
                onChange={(event) =>
                  onDraftChange({ skills: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-tools">Tools</Label>
              <Textarea
                id="agent-tools"
                rows={4}
                value={draft.tools}
                placeholder="One tool per line"
                className="font-mono text-xs"
                onChange={(event) =>
                  onDraftChange({ tools: event.target.value })
                }
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="agent-autonomy">Autonomy</Label>
              <Select
                value={draft.autonomy}
                onValueChange={(value) =>
                  onDraftChange({ autonomy: value as ChatAgentAutonomy })
                }
              >
                <SelectTrigger id="agent-autonomy" className="w-full max-w-sm">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="suggest">Suggest only</SelectItem>
                  <SelectItem value="approve">Act with approval</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </>
        ) : (
          <>
            <ReadOnlyField label="Instructions">
              <MultilineText value={draft.instructions} />
              <p className="text-muted-foreground mt-2 text-xs">
                Only projects you are a member of are in scope for this agent.
              </p>
            </ReadOnlyField>
            <ReadOnlyField label="Skills">
              <MultilineText value={draft.skills} />
            </ReadOnlyField>
            <ReadOnlyField label="Tools">
              <p className="text-foreground font-mono text-xs leading-relaxed whitespace-pre-wrap">
                {draft.tools.trim() ? draft.tools : '—'}
              </p>
            </ReadOnlyField>
            <ReadOnlyField label="Autonomy">
              <p className="text-foreground text-sm">
                {draft.autonomy === 'approve'
                  ? 'Act with approval'
                  : 'Suggest only'}
              </p>
            </ReadOnlyField>
          </>
        )}
      </section>
    </div>
  );
}
