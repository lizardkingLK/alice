'use client';

import { cn } from '@repo/ui/lib/utils';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { getInitials } from '@/app/_shared/utility';
import { Avatar, AvatarFallback } from '@repo/ui/components/ui/avatar';
import { Bot } from '@repo/ui/lib/icons';
import { toAgentMentionId } from '@repo/types';
import type { ChatAgentSummaryWire } from '@repo/types/api/v1';
import type { CommentUser } from '@/app/comments/_services/comments.mutations.shared';

export type CommentMentionItem = {
  id: string;
  label: string;
  description?: string;
  kind: 'user' | 'agent' | 'workItem';
};

export type CommentMentionAgent = Pick<
  ChatAgentSummaryWire,
  'id' | 'name' | 'title' | 'kind' | 'status' | 'isDefault'
>;

type CommentMentionListProps = {
  items: CommentMentionItem[];
  highlightIdx: number;
  // eslint-disable-next-line no-unused-vars -- select callback
  onSelect: (item: CommentMentionItem) => void;
};

function MentionItemIcon({ item }: Readonly<{ item: CommentMentionItem }>) {
  if (item.kind === 'user') {
    return (
      <Avatar size="sm">
        <AvatarFallback className="text-[10px] font-semibold">
          {getInitials(item.label)}
        </AvatarFallback>
      </Avatar>
    );
  }
  if (item.kind === 'agent') {
    return (
      <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
        <Bot className="size-3.5" />
      </span>
    );
  }
  return (
    <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-violet-500/10 text-[10px] font-bold text-violet-600 dark:text-violet-400">
      #
    </span>
  );
}

export function CommentMentionList({
  items,
  highlightIdx,
  onSelect,
}: Readonly<CommentMentionListProps>) {
  if (items.length === 0) {
    return (
      <div className="bg-popover text-muted-foreground rounded-md border p-2 text-xs shadow-md">
        No matches
      </div>
    );
  }

  return (
    <ul className="bg-popover max-h-40 w-64 overflow-y-auto rounded-md border p-1 shadow-md">
      {items.map((item, index) => (
        <li key={`${item.kind}-${item.id}`}>
          <button
            type="button"
            className={cn(
              'flex w-full items-center gap-2 rounded-sm px-2 py-1.5 text-left text-sm',
              index === highlightIdx
                ? 'bg-accent text-accent-foreground'
                : 'hover:bg-muted'
            )}
            onMouseDown={(event) => {
              event.preventDefault();
              onSelect(item);
            }}
          >
            <MentionItemIcon item={item} />
            <span className="min-w-0 flex-1">
              <TruncatedText className="block font-medium">
                {item.label}
              </TruncatedText>
              {item.description ? (
                <TruncatedText className="text-muted-foreground block text-xs">
                  {item.description}
                </TruncatedText>
              ) : null}
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}

export function usersToMentionItems(
  users: CommentUser[]
): CommentMentionItem[] {
  return users.map((u) => ({
    id: u.id,
    label: u.name,
    description: u.email,
    kind: 'user' as const,
  }));
}

export function agentsToMentionItems(
  agents: readonly CommentMentionAgent[]
): CommentMentionItem[] {
  return agents
    .filter(
      (agent) =>
        agent.status === 'active' &&
        (agent.kind === 'personal' ||
          (agent.kind === 'system' && agent.isDefault))
    )
    .map((agent) => ({
      id: toAgentMentionId(agent.id),
      label: agent.name,
      description:
        agent.kind === 'system'
          ? `Workspace default · ${agent.title}`
          : `Personal agent · ${agent.title}`,
      kind: 'agent' as const,
    }));
}

export function atMentionItems(
  users: readonly CommentUser[],
  agents: readonly CommentMentionAgent[],
  query: string,
  limit = 8
): CommentMentionItem[] {
  const normalizedQuery = query.toLowerCase();
  const matches = (item: CommentMentionItem) =>
    `${item.label} ${item.description ?? ''}`
      .toLowerCase()
      .includes(normalizedQuery);

  return [...agentsToMentionItems(agents), ...usersToMentionItems([...users])]
    .filter(matches)
    .slice(0, limit);
}
