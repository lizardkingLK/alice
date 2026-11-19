'use client';

import { useEffect, useRef, useState, type ReactNode } from 'react';
import { EditorContent, useEditor, type JSONContent } from '@tiptap/react';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';
import EditorCommandsBar from '@/app/work-items/_components/work-item-description/work-item-description-editor-commandsBar';
import getEditorStyles from '@/app/work-items/_components/work-item-description/work-item-description-editor-styles';
import { NoteIconPicker } from '@/app/notes/_components/note-icon-picker';
import { NotesCoverBanner } from '@/app/notes/_components/notes-cover-banner';
import { NotesEditorActions } from '@/app/notes/_components/notes-editor-actions';
import {
  NOTE_TITLE_MAX,
  type Note,
  type NotePatch,
} from '@/app/notes/_helpers/notes-storage';
import { createEditorExtensions } from '@/lib/editor/create-editor-extensions';

export type NotesEditorVariant = 'page' | 'widget';

type NotesEditorProps = {
  readonly note: Note;
  readonly variant: NotesEditorVariant;
  // eslint-disable-next-line no-unused-vars -- patch callback
  readonly onPatch: (patch: NotePatch) => void;
  readonly className?: string;
  readonly footer?: ReactNode;
};

function contentFingerprint(content: JSONContent): string {
  return JSON.stringify(content);
}

export function NotesEditor({
  note,
  variant,
  onPatch,
  className,
  footer,
}: Readonly<NotesEditorProps>) {
  const isPage = variant === 'page';
  const [isMaximized, setIsMaximized] = useState(false);
  const lastContentRef = useRef(contentFingerprint(note.content));
  const noteIdRef = useRef(note.id);

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({
      mode: 'full',
      placeholder: 'Start writing…',
    }),
    content: note.content,
    editable: true,
    editorProps: {
      attributes: {
        role: 'textbox',
        'aria-label': 'Note body',
        class: getEditorStyles(false, {
          grow: isPage,
          tall: !isPage,
        }),
      },
    },
    onUpdate: ({ editor: next }) => {
      const json = next.getJSON();
      const fingerprint = contentFingerprint(json);
      lastContentRef.current = fingerprint;
      onPatch({ content: json, touchEdited: true });
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    if (noteIdRef.current !== note.id) {
      noteIdRef.current = note.id;
      lastContentRef.current = contentFingerprint(note.content);
      editor.commands.setContent(note.content, { emitUpdate: false });
      return;
    }
    const nextFingerprint = contentFingerprint(note.content);
    if (nextFingerprint === lastContentRef.current) {
      return;
    }
    lastContentRef.current = nextFingerprint;
    editor.commands.setContent(note.content, { emitUpdate: false });
  }, [editor, note.content, note.id]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    const maximized = isPage && isMaximized;
    editor.setOptions({
      editorProps: {
        attributes: {
          role: 'textbox',
          'aria-label': 'Note body',
          class: getEditorStyles(maximized, {
            grow: isPage && !maximized,
            tall: !isPage,
          }),
        },
      },
    });
  }, [editor, isMaximized, isPage]);

  useEffect(() => {
    if (!(isPage && isMaximized)) {
      return;
    }
    const originalStyle = globalThis.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isMaximized, isPage]);

  if (!editor) {
    return null;
  }

  return (
    <div
      className={cn(
        'bg-background flex min-h-0 flex-1 flex-col',
        isPage && isMaximized
          ? 'fixed inset-0 z-50 gap-3 rounded-none p-6'
          : 'gap-2',
        className
      )}
    >
      {isPage ? (
        <NotesCoverBanner
          coverDataUrl={note.coverDataUrl}
          onChange={(coverDataUrl) =>
            onPatch({ coverDataUrl, touchEdited: true })
          }
        />
      ) : null}

      <div
        className={cn(
          'flex shrink-0 items-start gap-2',
          isPage ? 'px-1' : 'px-0'
        )}
      >
        <NoteIconPicker
          icon={note.icon}
          size={isPage ? 'lg' : 'sm'}
          onChange={(icon) => onPatch({ icon, touchEdited: true })}
        />
        <Input
          value={note.title}
          onChange={(event) =>
            onPatch({ title: event.target.value, touchEdited: true })
          }
          placeholder="Untitled"
          aria-label="Note title"
          maxLength={NOTE_TITLE_MAX}
          className={cn(
            'min-w-0 flex-1 border-0 bg-transparent shadow-none focus-visible:ring-0',
            isPage
              ? 'h-auto py-2 text-2xl font-semibold md:text-3xl'
              : 'h-9 text-base font-semibold'
          )}
        />
        <NotesEditorActions note={note} variant={variant} onPatch={onPatch} />
      </div>

      <div
        className={cn(
          'border-border flex min-h-0 flex-1 flex-col overflow-hidden rounded-md border',
          isPage && isMaximized && 'flex-1'
        )}
      >
        <EditorCommandsBar
          editor={editor}
          isMaximized={isMaximized}
          onToggleMaximize={() => setIsMaximized((previous) => !previous)}
          allowMaximize={isPage}
        />
        <div
          className={cn(
            'bg-background/50 min-h-0',
            isPage && !isMaximized
              ? 'overflow-visible'
              : 'min-h-0 flex-1 overflow-hidden'
          )}
        >
          <EditorContent editor={editor} />
        </div>
      </div>

      {footer}
    </div>
  );
}
