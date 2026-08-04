'use client';

import {
  useCallback,
  useEffect,
  useImperativeHandle,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  forwardRef,
} from 'react';
import { createPortal } from 'react-dom';
import type { JSONContent } from '@tiptap/react';
import { EditorContent, useEditor } from '@tiptap/react';
import type { Editor } from '@tiptap/react';
import {
  commentContentToPlainText,
  emptyCommentDoc,
  isCommentDocEmpty,
  toCommentTiptapContent,
  type Json,
} from '@repo/types';
import { cn } from '@repo/ui/lib/utils';
import { createEditorExtensions } from '@/lib/editor/create-editor-extensions';
import { getCompactEditorAttributes } from '@/lib/editor/compact-editor-attrs';
import { CompactEditorBubbleToolbar } from '@/lib/editor/compact-editor-bubble-toolbar';
import {
  emojiCharToShortcode,
  hydrateEmojiNodesInDoc,
} from '@/lib/editor/resolve-emoji';
import { serializeCommentDoc } from '@/lib/editor/serialize-comment-doc';
import { createCommentMentionExtensions } from '@/app/comments/_components/comment-mention-extensions';
import {
  CommentMentionList,
  type CommentMentionItem,
} from '@/app/comments/_components/comment-mention-list';
import type { CommentUser } from '@/app/comments/_services/comments.service.base';
import type { CommentWorkItemOption } from '@/app/comments/_services/comments.service.base';

export type CommentEditorHandle = {
  focus: () => void;
  clear: () => void;
  // eslint-disable-next-line no-unused-vars
  insertText: (text: string) => void;
  // eslint-disable-next-line no-unused-vars
  insertQuickReply: (emoji: string, label: string) => void;
  // eslint-disable-next-line no-unused-vars
  insertUserMention: (mention: { id: string; label: string }) => void;
  getJSON: () => JSONContent;
  isEmpty: () => boolean;
};

type CommentEditorProps = {
  initialContent?: Json | string | null;
  placeholder?: string;
  users: CommentUser[];
  workItems: Pick<CommentWorkItemOption, 'id' | 'key' | 'title'>[];
  className?: string;
  editorClassName?: string;
  autoFocus?: boolean;
  // eslint-disable-next-line no-unused-vars -- change callback
  onChange?: (doc: JSONContent, plainText: string) => void;
  onSubmit?: () => void;
};

type TriggerState = {
  kind: 'user' | 'workItem';
  query: string;
  from: number;
  to: number;
} | null;

function getTriggerState(editor: Editor): TriggerState {
  const { from, empty } = editor.state.selection;
  if (!empty) {
    return null;
  }

  const textBefore = editor.state.doc.textBetween(
    Math.max(0, from - 40),
    from,
    '\n',
    '\0'
  );
  const atMatch = /(?:^|\s)@([^\s@#]*)$/.exec(textBefore);
  const hashMatch = /(?:^|\s)#([^\s@#]*)$/.exec(textBefore);

  if (atMatch) {
    const query = atMatch[1] ?? '';
    const triggerLen = query.length + 1;
    return {
      kind: 'user',
      query,
      from: from - triggerLen,
      to: from,
    };
  }

  if (hashMatch) {
    const query = hashMatch[1] ?? '';
    const triggerLen = query.length + 1;
    return {
      kind: 'workItem',
      query,
      from: from - triggerLen,
      to: from,
    };
  }

  return null;
}

export const CommentEditor = forwardRef<
  CommentEditorHandle,
  CommentEditorProps
>(function CommentEditor(
  {
    initialContent,
    placeholder = 'Add a comment...',
    users,
    workItems,
    className,
    editorClassName,
    autoFocus = false,
    onChange,
    onSubmit,
  },
  ref
) {
  const [trigger, setTrigger] = useState<TriggerState>(null);
  const [highlightIdx, setHighlightIdx] = useState(0);
  const [coords, setCoords] = useState<{
    left: number;
    top: number;
    width: number;
  } | null>(null);
  const shellRef = useRef<HTMLDivElement | null>(null);
  const mentionExtRef = useRef(createCommentMentionExtensions());
  const onChangeRef = useRef(onChange);
  onChangeRef.current = onChange;

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({
      mode: 'compact',
      placeholder,
      extra: mentionExtRef.current,
    }),
    content: toCommentTiptapContent(
      (initialContent ?? emptyCommentDoc()) as Json
    ) as JSONContent,
    autofocus: autoFocus ? 'end' : false,
    editorProps: {
      attributes: getCompactEditorAttributes({
        ariaLabel: placeholder,
        size: 'sm',
        className: editorClassName,
      }),
      handleKeyDown: (_view, event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          event.preventDefault();
          onSubmit?.();
          return true;
        }
        return false;
      },
    },
  });

  useImperativeHandle(
    ref,
    () => ({
      focus: () => editor?.commands.focus('end'),
      clear: () => {
        editor?.commands.setContent(emptyCommentDoc() as JSONContent);
        onChangeRef.current?.(emptyCommentDoc() as JSONContent, '');
      },
      insertText: (text: string) => {
        if (!editor) {
          return;
        }
        editor.chain().focus('end').insertContent(text).run();
        // TipTap emoji plugin rewrites unicode after the transaction; re-focus end.
        queueMicrotask(() => {
          editor.commands.focus('end');
        });
      },
      insertQuickReply: (emoji: string, label: string) => {
        if (!editor) {
          return;
        }
        const shortcode = emojiCharToShortcode(emoji);
        const content = shortcode
          ? [
              {
                type: 'emoji',
                attrs: { name: shortcode, emoji },
              },
              { type: 'text', text: ` ${label} ` },
            ]
          : `${emoji} ${label} `;
        editor.chain().focus('end').insertContent(content).focus('end').run();
        queueMicrotask(() => {
          editor.commands.focus('end');
        });
      },
      insertUserMention: (mention: { id: string; label: string }) => {
        if (!editor) {
          return;
        }
        editor
          .chain()
          .focus('end')
          .insertContent([
            {
              type: 'mention',
              attrs: {
                id: mention.id,
                label: mention.label,
                mentionType: 'user',
                mentionSuggestionChar: '@',
              },
            },
            { type: 'text', text: ' ' },
          ])
          .focus('end')
          .run();
      },
      getJSON: () => {
        const raw =
          (editor?.getJSON() as JSONContent) ??
          (emptyCommentDoc() as JSONContent);
        return serializeCommentDoc(hydrateEmojiNodesInDoc(raw));
      },
      isEmpty: () => !editor || isCommentDocEmpty(editor.getJSON() as Json),
    }),
    [editor]
  );

  const syncTrigger = useCallback(() => {
    if (!editor) {
      setTrigger(null);
      return;
    }
    const next = getTriggerState(editor);
    setTrigger(next);
    setHighlightIdx(0);
    const json = editor.getJSON();
    onChangeRef.current?.(json, commentContentToPlainText(json as Json));
  }, [editor]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.on('update', syncTrigger);
    editor.on('selectionUpdate', syncTrigger);
    return () => {
      editor.off('update', syncTrigger);
      editor.off('selectionUpdate', syncTrigger);
    };
  }, [editor, syncTrigger]);

  const items: CommentMentionItem[] = useMemo(() => {
    if (!trigger) {
      return [];
    }
    const q = trigger.query.toLowerCase();
    if (trigger.kind === 'user') {
      return users
        .filter((u) => {
          const haystack = `${u.name ?? ''} ${u.email ?? ''}`.toLowerCase();
          return haystack.includes(q);
        })
        .slice(0, 8)
        .map((u) => ({
          id: u.id,
          label: (u.name?.trim() || u.email || 'User').trim(),
          description: u.email,
          kind: 'user' as const,
        }));
    }
    return workItems
      .filter(
        (w) =>
          w.key.toLowerCase().includes(q) || w.title.toLowerCase().includes(q)
      )
      .slice(0, 8)
      .map((w) => ({
        id: w.id,
        label: w.key,
        description: w.title,
        kind: 'workItem' as const,
      }));
  }, [trigger, users, workItems]);

  useLayoutEffect(() => {
    if (!trigger || !shellRef.current) {
      setCoords(null);
      return;
    }
    const rect = shellRef.current.getBoundingClientRect();
    setCoords({
      left: rect.left,
      top: rect.bottom + 4,
      width: Math.min(rect.width, 280),
    });
  }, [trigger]);

  const insertMention = useCallback(
    (item: CommentMentionItem) => {
      if (!editor || !trigger) {
        return;
      }

      const { from, to } = trigger;
      const docSize = editor.state.doc.content.size;
      if (from < 0 || to > docSize || from > to) {
        setTrigger(null);
        return;
      }

      const nodeType = item.kind === 'user' ? 'mention' : 'workItemMention';
      if (!editor.schema.nodes[nodeType]) {
        console.error(`Missing TipTap node type: ${nodeType}`);
        setTrigger(null);
        return;
      }

      const mentionAttrs =
        item.kind === 'user'
          ? {
              id: item.id,
              label: item.label,
              mentionType: 'user' as const,
              mentionSuggestionChar: '@' as const,
            }
          : {
              id: item.id,
              label: item.label,
              title: item.description ?? item.label,
              mentionType: 'workItem' as const,
              mentionSuggestionChar: '#' as const,
            };

      editor
        .chain()
        .focus()
        .insertContentAt(
          { from, to },
          [
            { type: nodeType, attrs: mentionAttrs },
            { type: 'text', text: ' ' },
          ],
          { updateSelection: true }
        )
        .run();
      setTrigger(null);
    },
    [editor, trigger]
  );

  useEffect(() => {
    if (!trigger || items.length === 0) {
      return;
    }

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'ArrowDown') {
        event.preventDefault();
        setHighlightIdx((idx) => (idx + 1) % items.length);
        return;
      }
      if (event.key === 'ArrowUp') {
        event.preventDefault();
        setHighlightIdx((idx) => (idx - 1 + items.length) % items.length);
        return;
      }
      if (event.key === 'Enter' || event.key === 'Tab') {
        event.preventDefault();
        const selected = items[highlightIdx];
        if (selected) {
          insertMention(selected);
        }
        return;
      }
      if (event.key === 'Escape') {
        event.preventDefault();
        setTrigger(null);
      }
    };

    window.addEventListener('keydown', onKeyDown, true);
    return () => window.removeEventListener('keydown', onKeyDown, true);
  }, [trigger, items, highlightIdx, insertMention]);

  return (
    <div ref={shellRef} className={cn('relative', className)}>
      {editor ? <CompactEditorBubbleToolbar editor={editor} /> : null}
      <EditorContent editor={editor} />
      {trigger && coords
        ? createPortal(
            <div
              className="z-50"
              style={{
                position: 'fixed',
                left: coords.left,
                top: coords.top,
                width: coords.width,
              }}
            >
              <CommentMentionList
                items={items}
                highlightIdx={highlightIdx}
                onSelect={insertMention}
              />
            </div>,
            document.body
          )
        : null}
    </div>
  );
});
