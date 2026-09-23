'use client';

import { useEffect } from 'react';
import type { Json } from '@repo/types';
import { EditorContent, useEditor } from '@tiptap/react';
import { TooltipProvider } from '@repo/ui/components/ui/tooltip';
import { cn } from '@repo/ui/lib/utils';
import { toTiptapContent } from '@/app/work-items/_helpers/work-item-description';
import { createEditorExtensions } from '@/lib/editor/create-editor-extensions';
import {
  getCompactEditorAttributes,
  MODERN_BORDERLESS_FOCUS_CLASSES,
} from '@/lib/editor/compact-editor-attrs';
import { CompactEditorBubbleToolbar } from '@/lib/editor/compact-editor-bubble-toolbar';

type WorkItemFormModernDescriptionProps = {
  // eslint-disable-next-line no-unused-vars -- callback for FormData sync
  readonly onJsonChange: (json: string | null) => void;
  readonly initialContent?: unknown;
  readonly id?: string;
  /** `modern` = borderless create chrome; `classic` = bordered field (shared form). */
  readonly variant?: 'modern' | 'classic';
};

/**
 * Compact TipTap description for create/edit (same mode as comments).
 * Toolbar floats only when text is selected (BubbleMenu).
 */
export function WorkItemFormModernDescription({
  onJsonChange,
  initialContent = null,
  id,
  variant = 'modern',
}: Readonly<WorkItemFormModernDescriptionProps>) {
  const isClassic = variant === 'classic';
  const resolvedContent =
    toTiptapContent((initialContent as Json | null) ?? null) ?? '';

  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({
      mode: 'compact',
      placeholder: 'Add a description…',
    }),
    content: resolvedContent,
    editorProps: {
      attributes: {
        ...getCompactEditorAttributes({
          ariaLabel: 'Description',
          size: isClassic ? 'sm' : 'lg',
          className: isClassic
            ? cn(
                'border-input bg-background min-h-20 rounded-md border shadow-xs',
                'focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px]'
              )
            : MODERN_BORDERLESS_FOCUS_CLASSES,
        }),
        ...(id ? { id } : {}),
      },
    },
  });

  useEffect(() => {
    if (!editor) {
      return;
    }

    const sync = () => {
      if (editor.isEmpty) {
        onJsonChange(null);
        return;
      }
      onJsonChange(JSON.stringify(editor.getJSON()));
    };

    sync();
    editor.on('update', sync);
    return () => {
      editor.off('update', sync);
    };
  }, [editor, onJsonChange]);

  if (!editor) {
    return (
      <div
        id={id}
        className={cn(
          'text-muted-foreground/70 min-h-16 px-3 py-2',
          isClassic
            ? 'border-input bg-background min-h-20 rounded-md border text-sm'
            : 'text-lg'
        )}
        aria-label="Description"
      >
        Add a description…
      </div>
    );
  }

  return (
    <TooltipProvider delayDuration={200}>
      <div className="relative">
        <CompactEditorBubbleToolbar editor={editor} />
        <EditorContent editor={editor} />
      </div>
    </TooltipProvider>
  );
}
