'use client';

import React, { useState, useEffect } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Spinner } from '@repo/ui/components/ui/spinner';
import { cn } from '@repo/ui/lib/utils';
import {
  useEditor,
  EditorContent,
  JSONContent,
  ReactNodeViewRenderer,
} from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import CodeBlockLowlight from '@tiptap/extension-code-block-lowlight';
import { all, createLowlight } from 'lowlight';
import { useEditorAutosave } from '@/hooks/use-editor-autosave';
import CodeBlockNodeView from '@/app/work-items/_components/workItem-description-editor-nodeView';
import EditorCommandsBar from '@/app/work-items/_components/workItem-description-editor-commandsBar';
import getEditorStyles from '@/app/work-items/_components/workItem-description-editor-styles';
import { delay } from '@/app/_shared/utility';
import { CustomLinkExtension } from '@/lib/editor/tiptap-link-configuration';

type WorkItemDescriptionEditorProps = {
  id: string;
  initialContent: JSONContent | null;
  // eslint-disable-next-line no-unused-vars
  onSave: (content: JSONContent) => void;
  onCancel: () => void;
};

const lowlight = createLowlight(all);

export default function WorkItemDescriptionEditor({
  id,
  initialContent,
  onSave,
  onCancel,
}: Readonly<WorkItemDescriptionEditorProps>) {
  const [isSaving, setSaving] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);

  const AUTOSAVE_STORAGE_KEY = `autosave_editor_${id}`;

  const editor = useEditor({
    immediatelyRender: true,
    extensions: [
      StarterKit.configure({
        codeBlock: false,
        link: false,
      }),
      CodeBlockLowlight.configure({
        lowlight,
        defaultLanguage: 'plaintext',
      }).extend({
        addNodeView() {
          return ReactNodeViewRenderer(CodeBlockNodeView);
        },
      }),
      CustomLinkExtension,
    ],
    content: initialContent ?? '',
    editable: true,
    autofocus: 'end',
    editorProps: {
      attributes: {
        class: getEditorStyles(false),
      },
    },
  });

  const { clearAutosave } = useEditorAutosave({
    editor,
    storageKey: AUTOSAVE_STORAGE_KEY,
  });

  const handleSave = async () => {
    setSaving(true);
    onSave(editor.getJSON());
    await delay();
    clearAutosave();
    setSaving(false);
  };

  // Watch component execution parameters to keep class targets updated on transitions
  useEffect(() => {
    if (!editor) return;
    editor.setOptions({
      editorProps: {
        attributes: {
          class: getEditorStyles(isMaximized),
        },
      },
    });
  }, [isMaximized, editor]);

  // Freeze background body scrolling when the workspace editor component is maximized
  useEffect(() => {
    if (isMaximized) {
      const originalStyle = globalThis.getComputedStyle(document.body).overflow;
      document.body.style.overflow = 'hidden';

      return () => {
        document.body.style.overflow = originalStyle;
      };
    }
  }, [isMaximized]);

  if (!editor) return null;

  return (
    <div
      className={cn(
        'bg-background flex flex-col border transition-all duration-200',
        isMaximized
          ? 'fixed inset-0 z-50 h-screen w-screen gap-4 rounded-none p-6'
          : 'relative w-full gap-2 rounded-lg p-2'
      )}
    >
      <EditorCommandsBar
        editor={editor}
        isMaximized={isMaximized}
        onToggleMaximize={() => setIsMaximized(!isMaximized)}
      />

      <div
        className={cn(
          'bg-background/50 overflow-y-auto rounded-md border',
          isMaximized ? 'flex-1' : ''
        )}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="border-border/40 mt-auto flex items-center justify-end gap-2 border-t pt-2">
        <Button
          className="cursor-pointer"
          size={isMaximized ? 'default' : 'sm'}
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving && <Spinner data-icon="inline-start" />}
          Save
        </Button>
        <Button
          className="cursor-pointer"
          size={isMaximized ? 'default' : 'sm'}
          variant="ghost"
          onClick={onCancel}
          disabled={isSaving}
        >
          Cancel
        </Button>
      </div>
    </div>
  );
}
