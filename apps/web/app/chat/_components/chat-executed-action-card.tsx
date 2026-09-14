'use client';

import type { ReactNode } from 'react';
import {
  Calendar,
  FolderKanban,
  ClipboardPenIcon,
  type LucideIcon,
} from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import Link from 'next/link';
import type { ActionItem } from '@/app/chat/_components/chat-client.types';
import { boardConfigSchema } from '@repo/types/api/v1';

type ActionCardTone = 'emerald' | 'blue' | 'indigo';

const ACTION_CARD_TONE_CLASS: Record<
  ActionCardTone,
  { readonly card: string; readonly icon: string; readonly link: string }
> = {
  emerald: {
    card: 'border-emerald-500/20 bg-emerald-500/5 text-emerald-950 dark:text-emerald-350',
    icon: 'text-emerald-500',
    link: 'hover:text-emerald-700',
  },
  blue: {
    card: 'border-blue-500/20 bg-blue-500/5 text-blue-950 dark:text-blue-350',
    icon: 'text-blue-500',
    link: 'hover:text-blue-700',
  },
  indigo: {
    card: 'border-indigo-500/20 bg-indigo-500/5 text-indigo-950 dark:text-indigo-350',
    icon: 'text-indigo-500',
    link: 'hover:text-indigo-700',
  },
};

function ActionCardFrame({
  tone,
  icon: Icon,
  children,
  href,
  linkLabel,
  onLinkClick,
}: Readonly<{
  tone: ActionCardTone;
  icon: LucideIcon;
  children: ReactNode;
  href: string;
  linkLabel: string;
  onLinkClick?: () => void;
}>) {
  const toneClass = ACTION_CARD_TONE_CLASS[tone];

  return (
    <div
      className={cn(
        'flex items-center justify-between rounded border p-2.5',
        toneClass.card
      )}
    >
      <div className="flex items-center gap-2">
        <Icon className={cn('h-4 w-4', toneClass.icon)} />
        <span className="text-xs">{children}</span>
      </div>
      <Link
        href={href}
        onClick={onLinkClick}
        className={cn(
          'text-[11px] underline transition-colors',
          toneClass.link
        )}
      >
        {linkLabel}
      </Link>
    </div>
  );
}

function projectActionLabel(
  entity: Extract<ActionItem, { type: 'create_project' }>['entity']
): ReactNode {
  return (
    <>
      Project Created: <strong>{entity.name}</strong> ({entity.key})
    </>
  );
}

function sprintActionLabel(
  entity: Extract<ActionItem, { type: 'create_sprint' }>['entity']
): ReactNode {
  return (
    <>
      Sprint Created: <strong>{entity.name}</strong>
    </>
  );
}

function workItemActionLabel(
  entity: Extract<ActionItem, { type: 'create_work_item' }>['entity']
): ReactNode {
  return (
    <>
      Work Item Created: <strong>{entity.key}</strong> - {entity.title}
    </>
  );
}

/** Renders a single chat “executed action” card, or null for unknown types. */
export function ChatExecutedActionCard({
  action,
}: Readonly<{ action: ActionItem }>) {
  switch (action.type) {
    case 'create_project':
      return (
        <ActionCardFrame
          tone="emerald"
          icon={FolderKanban}
          href="/projects"
          linkLabel="View"
        >
          {projectActionLabel(action.entity)}
        </ActionCardFrame>
      );
    case 'create_sprint':
      return (
        <ActionCardFrame
          tone="blue"
          icon={Calendar}
          href="/sprints"
          linkLabel="View"
        >
          {sprintActionLabel(action.entity)}
        </ActionCardFrame>
      );
    case 'create_work_item':
      return (
        <ActionCardFrame
          tone="indigo"
          icon={ClipboardPenIcon}
          href={`/work-items/${action.entity.id}`}
          linkLabel="View Details"
        >
          {workItemActionLabel(action.entity)}
        </ActionCardFrame>
      );
    case 'batch_import_work_items':
      return (
        <ActionCardFrame
          tone="emerald"
          icon={ClipboardPenIcon}
          href="/work-items"
          linkLabel="View Work Items"
        >
          Work Items Imported:{' '}
          <strong>
            {action.entity.title ?? action.entity.name ?? 'Batch Import'}
          </strong>
        </ActionCardFrame>
      );
    case 'configure_board': {
      const href = `/projects/${action.entity.projectId}?tab=board`;
      return (
        <ActionCardFrame
          tone="indigo"
          icon={FolderKanban}
          href={href}
          linkLabel="Open in Board Designer"
          onLinkClick={() => {
            const parsed = boardConfigSchema.safeParse(action.entity.config);
            if (!parsed.success) return;
            sessionStorage.setItem(
              `board_draft_${action.entity.projectId}`,
              JSON.stringify(parsed.data)
            );
          }}
        >
          Board Draft Created: <strong>{action.entity.projectName}</strong>
        </ActionCardFrame>
      );
    }
    default:
      return null;
  }
}
