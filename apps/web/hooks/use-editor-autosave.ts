'use client';

import { useEffect, useRef } from 'react';
import { Editor, JSONContent } from '@tiptap/react';
import {
  getLocalStorageJson,
  removeLocalStorageItem,
  setLocalStorageJson,
} from '@/lib/local-storage';

type EditorAutosavePayload = {
  readonly id: string;
  readonly content: JSONContent;
};

interface UseEditorAutosaveProps {
  editor: Editor | null;
  storageKey: string;
  /** Owner id embedded in the draft; restore only when it matches. */
  scopeId: string;
}

function isMatchingAutosave(
  value: unknown,
  scopeId: string
): value is EditorAutosavePayload {
  if (!value || typeof value !== 'object') {
    return false;
  }

  const record = value as Record<string, unknown>;
  if (record.id !== scopeId) {
    return false;
  }

  return record.content !== null && typeof record.content === 'object';
}

export function useEditorAutosave({
  editor,
  storageKey,
  scopeId,
}: UseEditorAutosaveProps) {
  // Use a ref to store the latest editor instance to avoid restarting the interval
  const editorRef = useRef<Editor | null>(editor);
  editorRef.current = editor;

  // Load initial autosaved content if present and owned by this scope
  useEffect(() => {
    if (!editor || !scopeId) {
      return;
    }

    const parsed = getLocalStorageJson<unknown>(storageKey);
    if (!parsed) {
      return;
    }

    if (!isMatchingAutosave(parsed, scopeId)) {
      // Stale/foreign draft under this key (or legacy unscoped payload).
      removeLocalStorageItem(storageKey);
      return;
    }

    // Only load if the editor is currently empty to avoid overwriting network content
    if (editor.isEmpty) {
      // Defer execution out of React's active lifecycle batching window
      queueMicrotask(() => {
        // Guard to make sure the editor wasn't destroyed while waiting
        if (editor && !editor.isDestroyed) {
          editor.commands.setContent(parsed.content);
        }
      });
    }
  }, [editor, scopeId, storageKey]);

  // Periodically save editor state content to localStorage
  useEffect(() => {
    if (!scopeId) {
      return;
    }

    const saveInterval = setInterval(() => {
      const currentEditor = editorRef.current;
      if (!currentEditor || currentEditor.isEmpty) return;

      setLocalStorageJson(storageKey, {
        id: scopeId,
        content: currentEditor.getJSON(),
      } satisfies EditorAutosavePayload);
    }, 5000);

    return () => clearInterval(saveInterval);
  }, [scopeId, storageKey]);

  // Helper utility to clean up the storage key on clean save operations
  const clearAutosave = () => {
    removeLocalStorageItem(storageKey);
  };

  return { clearAutosave };
}
