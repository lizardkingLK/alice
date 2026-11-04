'use client';

import { useEffect, useRef, useState } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { cn } from '@repo/ui/lib/utils';
import { createEditorExtensions } from '@/lib/editor/create-editor-extensions';
import EditorCommandsBar from '@/app/work-items/_components/work-item-description/work-item-description-editor-commandsBar';
import getEditorStyles from '@/app/work-items/_components/work-item-description/work-item-description-editor-styles';
import {
  instructionsDocToMarkdown,
  markdownToInstructionsDoc,
} from '@/app/chat/_helpers/chat-agent-instructions-markdown';

type ChatAgentInstructionsEditorProps = {
  readonly id?: string;
  readonly value: string;
  // eslint-disable-next-line no-unused-vars
  readonly onChange: (markdown: string) => void;
  readonly className?: string;
};

/**
 * Full TipTap editor (same chrome as work-item description) for agent
 * instructions. Draft value stays markdown/plain text for API + encryption.
 */
export function ChatAgentInstructionsEditor({
  id = 'agent-instructions',
  value,
  onChange,
  className,
}: Readonly<ChatAgentInstructionsEditorProps>) {
  const [isMaximized, setIsMaximized] = useState(false);
  const lastEmittedRef = useRef(value.trim());

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({
      mode: 'full',
      placeholder: 'Describe how this agent should behave…',
    }),
    content: markdownToInstructionsDoc(value),
    editable: true,
    editorProps: {
      attributes: {
        id,
        role: 'textbox',
        'aria-label': 'Instructions',
        class: getEditorStyles(false),
      },
    },
    onUpdate: ({ editor: next }) => {
      const markdown = instructionsDocToMarkdown(next.getJSON());
      lastEmittedRef.current = markdown;
      onChange(markdown);
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }
    const next = value.trim();
    if (next === lastEmittedRef.current) {
      return;
    }
    lastEmittedRef.current = next;
    editor.commands.setContent(markdownToInstructionsDoc(value), {
      emitUpdate: false,
    });
  }, [editor, value]);

  useEffect(() => {
    if (!editor) {
      return;
    }
    editor.setOptions({
      editorProps: {
        attributes: {
          id,
          role: 'textbox',
          'aria-label': 'Instructions',
          class: getEditorStyles(isMaximized),
        },
      },
    });
  }, [editor, id, isMaximized]);

  useEffect(() => {
    if (!isMaximized) {
      return;
    }
    const originalStyle = globalThis.getComputedStyle(document.body).overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = originalStyle;
    };
  }, [isMaximized]);

  if (!editor) {
    return (
      <div
        className={cn(
          'bg-background relative min-h-[200px] w-full rounded-lg border p-2',
          className
        )}
      />
    );
  }

  return (
    <div
      className={cn(
        'bg-background flex flex-col border transition-all duration-200',
        isMaximized
          ? 'fixed inset-0 z-50 h-screen w-screen gap-4 rounded-none p-6'
          : 'relative w-full gap-2 rounded-lg p-2',
        className
      )}
    >
      <EditorCommandsBar
        editor={editor}
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized((prev) => !prev)}
      />

      <div
        className={cn(
          'bg-background/50 overflow-y-auto rounded-md border',
          isMaximized ? 'flex-1' : ''
        )}
      >
        <EditorContent editor={editor} />
      </div>
    </div>
  );
}
