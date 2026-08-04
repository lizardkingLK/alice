'use client';

import { forwardRef, useEffect, useImperativeHandle, useRef } from 'react';
import type { JSONContent } from '@tiptap/react';
import { Button } from '@repo/ui/components/ui/button';
import { cn } from '@repo/ui/lib/utils';
import { UserAvatar } from '@/components/user-avatar';
import {
  CommentEditor,
  type CommentEditorHandle,
} from '@/app/comments/_components/comment-editor';
import type {
  CommentUser,
  CommentWorkItemOption,
} from '@/app/comments/_services/comments.service.base';

export const COMMENT_QUICK_REPLIES = [
  { emoji: '🎉', label: 'Looks good!' },
  { emoji: '👋', label: 'Need help?' },
  { emoji: '⛔', label: 'This is blocked...' },
  { emoji: '🔍', label: 'Can you clarify...?' },
  { emoji: '✅', label: 'This is on track' },
] as const;

export type CommentComposerHandle = {
  focus: () => void;
  // eslint-disable-next-line no-unused-vars
  insertUserMention: (mention: { id: string; label: string }) => void;
};

type CommentComposerProps = {
  currentUserName?: string | null;
  currentUserImageUrl?: string | null;
  users: CommentUser[];
  workItems: Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>[];
  isSubmitting?: boolean;
  enableMShortcut?: boolean;
  className?: string;
  // eslint-disable-next-line no-unused-vars -- submit callback
  onSubmit: (doc: JSONContent) => void | Promise<void>;
};

export const CommentComposer = forwardRef<
  CommentComposerHandle,
  CommentComposerProps
>(function CommentComposer(
  {
    currentUserName,
    currentUserImageUrl,
    users,
    workItems,
    isSubmitting = false,
    enableMShortcut = false,
    className,
    onSubmit,
  },
  ref
) {
  const editorRef = useRef<CommentEditorHandle | null>(null);

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editorRef.current?.focus(),
      insertUserMention: (mention) => {
        editorRef.current?.insertUserMention(mention);
        editorRef.current?.focus();
      },
    }),
    []
  );

  useEffect(() => {
    if (!enableMShortcut) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'm' && event.key !== 'M') {
        return;
      }
      if (event.metaKey || event.ctrlKey || event.altKey) {
        return;
      }
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.isContentEditable ||
          target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.closest('[contenteditable="true"]'))
      ) {
        return;
      }
      event.preventDefault();
      editorRef.current?.focus();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [enableMShortcut]);

  const handleSubmit = async () => {
    if (!editorRef.current || editorRef.current.isEmpty() || isSubmitting) {
      return;
    }
    const doc = editorRef.current.getJSON();
    await onSubmit(doc);
    editorRef.current.clear();
  };

  const submitSafely = () => {
    handleSubmit().catch((error) => {
      console.error('Failed to submit comment:', error);
    });
  };

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <UserAvatar
        name={currentUserName}
        imageUrl={currentUserImageUrl}
        className="mt-1 size-8 shrink-0 border-0"
        fallbackClassName="bg-primary/10 text-primary text-xs font-semibold"
      />

      <div className="border-border bg-background min-w-0 flex-1 overflow-hidden rounded-lg border">
        <CommentEditor
          ref={editorRef}
          users={users}
          workItems={workItems}
          placeholder="Add a comment..."
          onSubmit={submitSafely}
          className="min-h-20"
        />

        <div className="border-border/60 flex flex-wrap items-center gap-1.5 border-t px-2 py-1.5">
          {COMMENT_QUICK_REPLIES.map((chip) => (
            <Button
              key={chip.label}
              type="button"
              variant="ghost"
              size="sm"
              className="text-muted-foreground h-7 gap-1 px-2 text-xs"
              onClick={() => {
                editorRef.current?.insertQuickReply(chip.emoji, chip.label);
              }}
            >
              <span aria-hidden>{chip.emoji}</span>
              <span>{chip.label}</span>
            </Button>
          ))}
        </div>

        <div className="border-border/60 flex items-center justify-between gap-2 border-t px-3 pt-2.5 pb-3.5">
          <p className="text-muted-foreground text-xs">
            Pro tip: press{' '}
            <kbd className="bg-muted rounded border px-1.5 py-0.5 font-mono text-[10px]">
              M
            </kbd>{' '}
            to comment
          </p>
          <Button
            type="button"
            size="sm"
            disabled={isSubmitting}
            onClick={submitSafely}
          >
            Save
          </Button>
        </div>
      </div>
    </div>
  );
});
