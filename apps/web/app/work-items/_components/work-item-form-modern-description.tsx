'use client';

import { useEffect } from 'react';
import { EditorContent, useEditor } from '@tiptap/react';
import { createEditorExtensions } from '@/lib/editor/create-editor-extensions';
import {
  getCompactEditorAttributes,
  MODERN_BORDERLESS_FOCUS_CLASSES,
} from '@/lib/editor/compact-editor-attrs';
import { CompactEditorBubbleToolbar } from '@/lib/editor/compact-editor-bubble-toolbar';

type WorkItemFormModernDescriptionProps = {
  // eslint-disable-next-line no-unused-vars -- callback for FormData sync
  readonly onJsonChange: (json: string | null) => void;
};

/**
 * Compact TipTap description for modern create. Toolbar floats only when text
 * is selected (BubbleMenu).
 */
export function WorkItemFormModernDescription({
  onJsonChange,
}: Readonly<WorkItemFormModernDescriptionProps>) {
  const editor = useEditor({
    immediatelyRender: false,
    extensions: createEditorExtensions({
      mode: 'compact',
      placeholder: 'Add a description…',
    }),
    content: '',
    editorProps: {
      attributes: getCompactEditorAttributes({
        ariaLabel: 'Description',
        size: 'lg',
        className: MODERN_BORDERLESS_FOCUS_CLASSES,
      }),
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
        className="text-muted-foreground/70 min-h-16 px-3 py-2 text-lg"
        aria-label="Description"
      >
        Add a description…
      </div>
    );
  }

  return (
    <div className="relative">
      <CompactEditorBubbleToolbar editor={editor} />
      <EditorContent editor={editor} />
    </div>
  );
}
