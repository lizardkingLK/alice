'use client';

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Input } from '@repo/ui/components/ui/input';
import { cn } from '@repo/ui/lib/utils';

type WorkItemTitleEditorProps = {
  title: string;
  // eslint-disable-next-line no-unused-vars
  onSave: (nextTitle: string) => Promise<void>;
  className?: string;
};

export function WorkItemTitleEditor({
  title,
  onSave,
  className,
}: Readonly<WorkItemTitleEditorProps>) {
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState(title);
  const [isSaving, setIsSaving] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const skipBlurSaveRef = useRef(false);

  useEffect(() => {
    setDraft(title);
  }, [title]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    // Keep caret ready for typing without a loud focus ring (outline is styled away).
    inputRef.current?.focus({ preventScroll: true });
  }, [isEditing]);

  const beginEditing = () => {
    if (isSaving) {
      return;
    }

    setDraft(title);
    setIsEditing(true);
  };

  const cancelEditing = () => {
    skipBlurSaveRef.current = true;
    setDraft(title);
    setIsEditing(false);
  };

  const commitEditing = async () => {
    if (skipBlurSaveRef.current) {
      skipBlurSaveRef.current = false;
      return;
    }

    const nextTitle = draft.trim();

    // Empty draft keeps the existing title.
    if (!nextTitle || nextTitle === title) {
      setDraft(title);
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(nextTitle);
      setIsEditing(false);
    } catch {
      setDraft(title);
      setIsEditing(false);
    } finally {
      setIsSaving(false);
    }
  };

  const handleBlur = () => {
    commitEditing().catch(() => {});
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.blur();
      return;
    }

    if (event.key === 'Escape') {
      event.preventDefault();
      cancelEditing();
    }
  };

  if (!isEditing) {
    return (
      <h1 className={cn('mt-4 min-w-xl', className)}>
        <button
          type="button"
          onClick={beginEditing}
          className={cn(
            'hover:bg-muted/50 w-full cursor-text rounded-md border border-transparent px-1.5 py-0.5 text-left text-2xl font-semibold tracking-tight text-balance transition-colors sm:text-3xl',
            'outline-none focus:outline-none focus-visible:ring-0 focus-visible:outline-none'
          )}
          title="Click to edit title"
        >
          {title}
        </button>
      </h1>
    );
  }

  return (
    <Input
      ref={inputRef}
      value={draft}
      disabled={isSaving}
      maxLength={200}
      aria-label="Work item title"
      onChange={(event) => setDraft(event.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={cn(
        'mt-4 h-auto min-h-10 min-w-xl px-1.5 py-1 text-2xl font-semibold tracking-tight sm:text-3xl md:text-3xl',
        'border-border/50 rounded-md shadow-none',
        'focus-visible:border-border focus-visible:ring-0 focus-visible:ring-offset-0',
        className
      )}
    />
  );
}
