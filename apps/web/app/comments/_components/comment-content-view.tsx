'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import {
  getAttrString,
  toCommentTiptapContent,
  type CommentTiptapNode,
  type Json,
} from '@repo/types';
import { Badge } from '@repo/ui/components/ui/badge';
import { cn } from '@repo/ui/lib/utils';
import { workItemDetailHref } from '@/app/work-items/_helpers/work-item-links';
import { resolveEmojiPlainText } from '@/lib/editor/resolve-emoji';
import { foldMarks, mapInlineMark } from '@/lib/editor/tiptap-marks';

const MENTION_BADGE_CLASS =
  'border-blue-500/20 bg-blue-500/10 text-blue-600 dark:text-blue-400';
const ISSUE_BADGE_CLASS =
  'border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400';

export type CommentUserMentionTarget = {
  id: string;
  label: string;
};

/* eslint-disable no-unused-vars -- callback signatures */
type UserMentionClickHandler = (mention: CommentUserMentionTarget) => void;
/* eslint-enable no-unused-vars */

type CommentContentViewProps = {
  content: Json | string | null | undefined;
  className?: string;
  /** Used to recover display names when a stored mention is missing `label`. */
  users?: ReadonlyArray<{
    id: string;
    name: string | null;
    email?: string | null;
  }>;
  /** Used to recover work-item key/title when stored mention attrs are incomplete. */
  workItems?: ReadonlyArray<{
    id: string;
    key: string;
    title: string;
  }>;
  /** When set, user mention pills become buttons that start a reply-to-user flow. */
  onUserMentionClick?: UserMentionClickHandler;
};

function renderMarkedText(
  text: string,
  marks: CommentTiptapNode['marks'],
  key: string
): ReactNode {
  return foldMarks(text as ReactNode, marks, (inner, mark) =>
    mapInlineMark(mark, inner, {
      bold: (value) => <strong key={`${key}-b`}>{value}</strong>,
      italic: (value) => <em key={`${key}-i`}>{value}</em>,
      underline: (value) => <u key={`${key}-u`}>{value}</u>,
      code: (value) => (
        <code key={`${key}-c`} className="bg-muted rounded px-1 text-xs">
          {value}
        </code>
      ),
      link: (value, href) => (
        <a
          key={`${key}-a`}
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary underline"
        >
          {value}
        </a>
      ),
    })
  );
}

function mentionDisplayLabel(
  node: CommentTiptapNode,
  users?: CommentContentViewProps['users']
): string {
  const label = getAttrString(node.attrs, 'label');
  if (label) {
    return label;
  }
  const id = getAttrString(node.attrs, 'id');
  if (id && users?.length) {
    const match = users.find((u) => u.id === id);
    if (match) {
      return (match.name?.trim() || match.email || id).trim();
    }
  }
  return id ?? '';
}

function workItemDisplay(
  node: CommentTiptapNode,
  workItems?: CommentContentViewProps['workItems']
): { label: string; title?: string; id?: string } {
  const id = getAttrString(node.attrs, 'id');
  const label = getAttrString(node.attrs, 'label');
  const title = getAttrString(node.attrs, 'title');
  const match = id ? workItems?.find((item) => item.id === id) : undefined;

  return {
    id,
    label: label || match?.key || id || '',
    title: title || match?.title,
  };
}

function renderUserMention(
  node: CommentTiptapNode,
  key: string,
  onUserMentionClick?: UserMentionClickHandler,
  users?: CommentContentViewProps['users']
): ReactNode {
  const id = getAttrString(node.attrs, 'id');
  const label = mentionDisplayLabel(node, users);
  const text = `@${label || 'user'}`;

  if (id && onUserMentionClick && label) {
    return (
      <Badge
        key={key}
        variant="outline"
        asChild
        className={cn('mx-0.5 font-semibold', MENTION_BADGE_CLASS)}
      >
        <button
          type="button"
          className="cursor-pointer"
          onClick={() => onUserMentionClick({ id, label })}
        >
          {text}
        </button>
      </Badge>
    );
  }

  return (
    <Badge
      key={key}
      variant="outline"
      className={cn('mx-0.5 font-semibold', MENTION_BADGE_CLASS)}
    >
      {text}
    </Badge>
  );
}

function renderWorkItemMention(
  node: CommentTiptapNode,
  key: string,
  workItems?: CommentContentViewProps['workItems']
): ReactNode {
  const { id, label, title } = workItemDisplay(node, workItems);
  const href = id ? workItemDetailHref(id) : '/work-items';
  const display = title ? `#${label} · ${title}` : `#${label || 'item'}`;

  return (
    <Badge
      key={key}
      variant="outline"
      asChild
      className={cn('mx-0.5 max-w-56 font-semibold', ISSUE_BADGE_CLASS)}
    >
      <Link href={href} className="inline-flex max-w-52 min-w-0">
        <span className="truncate" title={display}>
          {display}
        </span>
      </Link>
    </Badge>
  );
}

function renderInlineNode(
  node: CommentTiptapNode,
  index: number,
  onUserMentionClick?: UserMentionClickHandler,
  users?: CommentContentViewProps['users'],
  workItems?: CommentContentViewProps['workItems']
): ReactNode {
  const key = `${node.type}-${index}`;

  if (node.type === 'text' && typeof node.text === 'string') {
    return (
      <span key={key}>{renderMarkedText(node.text, node.marks, key)}</span>
    );
  }

  if (node.type === 'hardBreak') {
    return <br key={key} />;
  }

  if (node.type === 'emoji') {
    return <span key={key}>{resolveEmojiPlainText(node)}</span>;
  }

  if (node.type === 'mention') {
    if (getAttrString(node.attrs, 'mentionType') === 'workItem') {
      return renderWorkItemMention(node, key, workItems);
    }
    return renderUserMention(node, key, onUserMentionClick, users);
  }

  if (node.type === 'workItemMention') {
    return renderWorkItemMention(node, key, workItems);
  }

  if (Array.isArray(node.content)) {
    return (
      <span key={key} className="contents">
        {renderInline(node.content, onUserMentionClick, users, workItems)}
      </span>
    );
  }

  return null;
}

function renderInline(
  nodes: CommentTiptapNode[] | undefined,
  onUserMentionClick?: UserMentionClickHandler,
  users?: CommentContentViewProps['users'],
  workItems?: CommentContentViewProps['workItems']
): ReactNode[] {
  if (!nodes?.length) {
    return [];
  }

  return nodes.map((node, index) =>
    renderInlineNode(node, index, onUserMentionClick, users, workItems)
  );
}

function renderListItems(
  nodes: CommentTiptapNode[] | undefined,
  key: string,
  onUserMentionClick?: UserMentionClickHandler,
  users?: CommentContentViewProps['users'],
  workItems?: CommentContentViewProps['workItems']
): ReactNode[] {
  return (nodes ?? []).map((item, i) => (
    <li key={`${key}-li-${i}`}>
      {renderInline(item.content, onUserMentionClick, users, workItems)}
    </li>
  ));
}

function renderBlock(
  node: CommentTiptapNode,
  index: number,
  onUserMentionClick?: UserMentionClickHandler,
  users?: CommentContentViewProps['users'],
  workItems?: CommentContentViewProps['workItems']
): ReactNode {
  const key = `block-${node.type}-${index}`;
  const children = renderInline(
    node.content,
    onUserMentionClick,
    users,
    workItems
  );

  if (node.type === 'paragraph') {
    return (
      <p key={key} className="my-1 whitespace-pre-wrap">
        {children.length > 0 ? children : '\u00A0'}
      </p>
    );
  }

  if (node.type === 'bulletList') {
    return (
      <ul key={key} className="my-1 list-disc pl-5">
        {renderListItems(
          node.content,
          key,
          onUserMentionClick,
          users,
          workItems
        )}
      </ul>
    );
  }

  if (node.type === 'orderedList') {
    return (
      <ol key={key} className="my-1 list-decimal pl-5">
        {renderListItems(
          node.content,
          key,
          onUserMentionClick,
          users,
          workItems
        )}
      </ol>
    );
  }

  if (node.type === 'blockquote') {
    return (
      <blockquote
        key={key}
        className="border-muted-foreground/30 my-1 border-l-2 pl-3 italic"
      >
        {children}
      </blockquote>
    );
  }

  return (
    <div key={key} className="contents">
      {children}
    </div>
  );
}

export function CommentContentView({
  content,
  className,
  users,
  workItems,
  onUserMentionClick,
}: Readonly<CommentContentViewProps>) {
  const doc = toCommentTiptapContent(content);
  const blocks = doc.content ?? [];

  return (
    <div className={cn('text-foreground text-sm leading-relaxed', className)}>
      {blocks.map((block, index) =>
        renderBlock(block, index, onUserMentionClick, users, workItems)
      )}
    </div>
  );
}
