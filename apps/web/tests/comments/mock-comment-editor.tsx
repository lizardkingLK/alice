import {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useState,
  type ForwardedRef,
} from 'react';
import {
  commentContentToPlainText,
  plainTextToCommentDoc,
  type Json,
} from '@repo/types';
import type { JSONContent } from '@tiptap/react';

type MockCommentEditorProps = {
  placeholder?: string;
  initialContent?: unknown;
  onSubmit?: () => void;
  // eslint-disable-next-line no-unused-vars -- change callback
  onChange?: (doc: JSONContent, plain: string) => void;
};

export type MockCommentEditorHandle = {
  focus: () => void;
  clear: () => void;
  // eslint-disable-next-line no-unused-vars -- insert API
  insertText: (text: string) => void;
  // eslint-disable-next-line no-unused-vars -- insert API
  insertQuickReply: (emoji: string, label: string) => void;
  // eslint-disable-next-line no-unused-vars -- insert API
  insertUserMention: (mention: { id: string; label: string }) => void;
  getJSON: () => JSONContent;
  isEmpty: () => boolean;
};

function initialPlainFromContent(initialContent: unknown): string {
  if (typeof initialContent === 'string') {
    return initialContent;
  }

  if (initialContent && typeof initialContent === 'object') {
    return commentContentToPlainText(initialContent as Json);
  }

  return '';
}

function createHandle(
  value: string,
  // eslint-disable-next-line no-unused-vars -- setter signature
  setValue: (value: string | ((prev: string) => string)) => void
): MockCommentEditorHandle {
  return {
    focus: () => undefined,
    clear: () => setValue(''),
    insertText: (text) => setValue((prev) => `${prev}${text}`),
    insertQuickReply: (emoji, label) =>
      setValue((prev) => `${prev}${emoji} ${label} `),
    insertUserMention: (mention) =>
      setValue((prev) => `${prev}@${mention.label} `),
    getJSON: () => plainTextToCommentDoc(value) as JSONContent,
    isEmpty: () => value.trim().length === 0,
  };
}

/**
 * Lightweight TipTap stand-in for comments unit tests (jsdom-friendly).
 */
export const MockCommentEditor = forwardRef(function MockCommentEditor(
  {
    placeholder,
    initialContent,
    onSubmit,
    onChange,
  }: Readonly<MockCommentEditorProps>,
  ref: ForwardedRef<MockCommentEditorHandle>
) {
  const [value, setValue] = useState(() =>
    initialPlainFromContent(initialContent)
  );

  useEffect(() => {
    onChange?.(plainTextToCommentDoc(value) as JSONContent, value);
    // Only re-emit when the textarea value changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentionally omit onChange
  }, [value]);

  useImperativeHandle(ref, () => createHandle(value, setValue), [value]);

  return (
    <textarea
      aria-label={placeholder}
      placeholder={placeholder}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      onKeyDown={(event) => {
        if (event.key === 'Enter' && (event.metaKey || event.ctrlKey)) {
          onSubmit?.();
        }
      }}
    />
  );
});
