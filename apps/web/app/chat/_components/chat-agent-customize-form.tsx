'use client';

import type { ReactNode } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Switch } from '@repo/ui/components/ui/switch';
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
import type {
  ChatAgentAutonomy,
  ChatAgentKind,
} from '@/app/chat/_helpers/chat-agents-catalog';
import type { ChatAgentAvatarStyle } from '@/app/chat/_helpers/chat-agent-avatar';
import { ChatAgentAvatar } from '@/app/chat/_components/chat-agent-avatar';

export type ChatAgentCatalogOption = {
  readonly key: string;
  readonly label: string;
  readonly description: string;
};

export type ChatAgentCustomizeDraft = {
  name: string;
  title: string;
  description: string;
  instructions: string;
  tagline: string;
  enabledSkillKeys: string[];
  enabledToolKeys: string[];
  autonomy: ChatAgentAutonomy;
  avatarStyle: ChatAgentAvatarStyle;
  avatarSeed: string;
};

type ChatAgentCustomizeFormProps = {
  readonly draft: ChatAgentCustomizeDraft;
  readonly kind: ChatAgentKind;
  readonly canEdit: boolean;
  readonly showCamera: boolean;
  readonly skillOptions: readonly ChatAgentCatalogOption[];
  readonly toolOptions: readonly ChatAgentCatalogOption[];
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

function toggleKey(
  keys: readonly string[],
  key: string,
  enabled: boolean
): string[] {
  if (enabled) {
    return keys.includes(key) ? [...keys] : [...keys, key];
  }
  return keys.filter((entry) => entry !== key);
}

function CatalogToggleList({
  label,
  options,
  enabledKeys,
  canEdit,
  onToggle,
}: Readonly<{
  label: string;
  options: readonly ChatAgentCatalogOption[];
  enabledKeys: readonly string[];
  canEdit: boolean;
  // eslint-disable-next-line no-unused-vars
  onToggle: (key: string, enabled: boolean) => void;
}>) {
  const enabledSet = new Set(enabledKeys);

  if (options.length === 0) {
    return (
      <div className="space-y-2">
        <Label>{label}</Label>
        <p className="text-muted-foreground text-sm">No catalog items yet.</p>
      </div>
    );
  }

  if (!canEdit) {
    const enabledLabels = options
      .filter((option) => enabledSet.has(option.key))
      .map((option) => option.label);
    return (
      <ReadOnlyField label={label}>
        {enabledLabels.length > 0 ? (
          <ul className="text-foreground list-inside list-disc text-sm leading-relaxed">
            {enabledLabels.map((entry) => (
              <li key={entry}>{entry}</li>
            ))}
          </ul>
        ) : (
          <p className="text-foreground text-sm">—</p>
        )}
      </ReadOnlyField>
    );
  }

  return (
    <div className="space-y-3">
      <Label>{label}</Label>
      <ul className="border-border divide-border divide-y rounded-md border">
        {options.map((option) => {
          const checked = enabledSet.has(option.key);
          const switchId = `agent-catalog-${label}-${option.key}`;
          return (
            <li
              key={option.key}
              className="flex items-start justify-between gap-3 px-3 py-2.5"
            >
              <div className="min-w-0 space-y-0.5">
                <Label htmlFor={switchId} className="text-sm font-medium">
                  {option.label}
                </Label>
                {option.description.trim() ? (
                  <p className="text-muted-foreground text-xs leading-relaxed">
                    {option.description}
                  </p>
                ) : null}
              </div>
              <Switch
                id={switchId}
                checked={checked}
                onCheckedChange={(next) => onToggle(option.key, next)}
                aria-label={`Toggle ${option.label}`}
              />
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function ChatAgentCustomizeForm({
  draft,
  kind,
  canEdit,
  showCamera,
  skillOptions,
  toolOptions,
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
                placeholder="e.g. Alice"
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
                placeholder="e.g. Assistant"
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
            <CatalogToggleList
              label="Skills"
              options={skillOptions}
              enabledKeys={draft.enabledSkillKeys}
              canEdit
              onToggle={(key, enabled) =>
                onDraftChange({
                  enabledSkillKeys: toggleKey(
                    draft.enabledSkillKeys,
                    key,
                    enabled
                  ),
                })
              }
            />
            <CatalogToggleList
              label="Tools"
              options={toolOptions}
              enabledKeys={draft.enabledToolKeys}
              canEdit
              onToggle={(key, enabled) =>
                onDraftChange({
                  enabledToolKeys: toggleKey(
                    draft.enabledToolKeys,
                    key,
                    enabled
                  ),
                })
              }
            />
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
            <CatalogToggleList
              label="Skills"
              options={skillOptions}
              enabledKeys={draft.enabledSkillKeys}
              canEdit={false}
              onToggle={() => undefined}
            />
            <CatalogToggleList
              label="Tools"
              options={toolOptions}
              enabledKeys={draft.enabledToolKeys}
              canEdit={false}
              onToggle={() => undefined}
            />
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
