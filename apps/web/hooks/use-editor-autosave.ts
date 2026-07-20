'use client';

import { useEffect, useRef } from 'react';
import { Editor, JSONContent } from '@tiptap/react';

interface UseEditorAutosaveProps {
  editor: Editor | null;
  storageKey: string;
}

export function useEditorAutosave({
  editor,
  storageKey,
}: UseEditorAutosaveProps) {
  // Use a ref to store the latest editor instance to avoid restarting the interval
  const editorRef = useRef<Editor | null>(editor);
  editorRef.current = editor;

  // Load initial autosaved content if present
  useEffect(() => {
    if (!editor) {
      return;
    }

    try {
      const savedData = localStorage.getItem(storageKey);
      if (!savedData) {
        return;
      }

      const parsed = JSON.parse(savedData) as JSONContent;
      // Only load if the editor is currently empty to avoid overwriting network content
      if (editor.isEmpty) {
        // Defer execution out of React's active lifecycle batching window
        queueMicrotask(() => {
          // Guard to make sure the editor wasn't destroyed while waiting
          if (editor && !editor.isDestroyed) {
            editor.commands.setContent(parsed);
          }
        });
      }
    } catch (error) {
      console.error(
        'Failed to load autosaved content from localStorage:',
        error
      );
    }
  }, [editor, storageKey]);

  // Periodically save editor state content to localStorage
  useEffect(() => {
    const saveInterval = setInterval(() => {
      const currentEditor = editorRef.current;
      if (!currentEditor || currentEditor.isEmpty) return;

      try {
        const content = currentEditor.getJSON();
        localStorage.setItem(storageKey, JSON.stringify(content));
      } catch (error) {
        console.error('Failed to autosave content to localStorage:', error);
      }
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [storageKey]);

  // Helper utility to clean up the storage key on clean save operations
  const clearAutosave = () => {
    try {
      localStorage.removeItem(storageKey);
    } catch (error) {
      console.error('Failed to clear autosaved content:', error);
    }
  };

  return { clearAutosave };
}
