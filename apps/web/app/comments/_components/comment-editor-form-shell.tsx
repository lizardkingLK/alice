'use client';

import { useRef, type ReactNode } from 'react';
import type { JSONContent } from '@tiptap/react';
import type { Json } from '@repo/types';
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

type CommentEditorFormShellProps = {
  users: CommentUser[];
  workItems: Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>[];
  initialContent?: Json | string | null;
  placeholder?: string;
  autoFocus?: boolean;
  className?: string;
  /** When set, shows avatar to the left of the editor. */
  avatarName?: string | null;
  avatarImageUrl?: string | null;
  submitLabel: string;
  cancelLabel?: ReactNode;
  isSubmitDisabled?: boolean;
  // eslint-disable-next-line no-unused-vars -- change callback
  onChange?: (doc: JSONContent, plainText: string) => void;
  onCancel: () => void;
  // eslint-disable-next-line no-unused-vars -- submit callback
  onSubmit: (doc: JSONContent) => void;
};

export function CommentEditorFormShell({
  users,
  workItems,
  initialContent,
  placeholder,
  autoFocus = false,
  className,
  avatarName,
  avatarImageUrl,
  submitLabel,
  cancelLabel = 'Cancel',
  isSubmitDisabled = false,
  onChange,
  onCancel,
  onSubmit,
}: Readonly<CommentEditorFormShellProps>) {
  const editorRef = useRef<CommentEditorHandle | null>(null);

  const form = (
    <div className="border-border space-y-2 rounded-lg border p-2">
      <CommentEditor
        ref={editorRef}
        initialContent={initialContent}
        users={users}
        workItems={workItems}
        placeholder={placeholder}
        autoFocus={autoFocus}
        onChange={onChange}
      />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="ghost" size="sm" onClick={onCancel}>
          {cancelLabel}
        </Button>
        <Button
          type="button"
          size="sm"
          disabled={isSubmitDisabled}
          onClick={() => {
            if (!editorRef.current || editorRef.current.isEmpty()) {
              return;
            }
            onSubmit(editorRef.current.getJSON());
          }}
        >
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  if (avatarName === undefined) {
    return <div className={className}>{form}</div>;
  }

  return (
    <div className={cn('flex items-start gap-3', className)}>
      <UserAvatar
        name={avatarName}
        imageUrl={avatarImageUrl}
        className="mt-1 size-8 shrink-0 border-0"
        fallbackClassName="bg-primary/10 text-primary text-xs font-semibold"
      />
      <div className="min-w-0 flex-1">{form}</div>
    </div>
  );
}
