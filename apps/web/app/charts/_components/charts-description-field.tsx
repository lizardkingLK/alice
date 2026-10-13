'use client';

import { useCallback, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { Label } from '@repo/ui/components/ui/label';
import { Textarea } from '@repo/ui/components/ui/textarea';
import { Loader2, Sparkles } from '@repo/ui/lib/icons';
import { generateChartDescriptionWithAlice } from '@/app/chat/_services/chat.mutations.client';

type ChartsAliceDescriptionScope = 'widget' | 'workspace';

export function useChartsAliceDescriptionSuggest(params: {
  readonly scope: ChartsAliceDescriptionScope;
  readonly title: string;
  readonly description: string;
  // eslint-disable-next-line no-unused-vars
  readonly onDescriptionChange: (next: string) => void;
  readonly context?: unknown;
}) {
  const [suggesting, setSuggesting] = useState(false);
  const [suggestError, setSuggestError] = useState<string | null>(null);

  const resetSuggestError = useCallback(() => {
    setSuggestError(null);
  }, []);

  const suggest = async () => {
    const trimmedTitle = params.title.trim();
    if (!trimmedTitle || suggesting) {
      return;
    }
    setSuggesting(true);
    setSuggestError(null);
    try {
      const result = await generateChartDescriptionWithAlice({
        scope: params.scope,
        title: trimmedTitle,
        currentDescription: params.description.trim() || null,
        context: params.context,
      });
      params.onDescriptionChange(result.description);
    } catch (error) {
      setSuggestError(
        error instanceof Error
          ? error.message
          : 'Failed to generate description'
      );
    } finally {
      setSuggesting(false);
    }
  };

  return { suggesting, suggestError, suggest, resetSuggestError };
}

type ChartsDescriptionFieldProps = {
  readonly id: string;
  readonly value: string;
  // eslint-disable-next-line no-unused-vars
  readonly onChange: (next: string) => void;
  /** Title used to enable Suggest and passed to Alice. */
  readonly title: string;
  readonly suggesting: boolean;
  readonly suggestError: string | null;
  readonly onSuggest: () => void;
  readonly placeholder?: string;
  /** Extra disable (e.g. parent save pending). Suggest busy is always applied. */
  readonly disabled?: boolean;
};

/**
 * Description textarea with a shared “Suggest with Alice” control.
 */
export function ChartsDescriptionField({
  id,
  value,
  onChange,
  title,
  suggesting,
  suggestError,
  onSuggest,
  placeholder = 'Add a description…',
  disabled = false,
}: Readonly<ChartsDescriptionFieldProps>) {
  const busy = disabled || suggesting;

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <Label htmlFor={id}>Description</Label>
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="h-7 cursor-pointer gap-1.5 px-2 text-xs"
          disabled={!title.trim() || busy}
          onClick={onSuggest}
        >
          {suggesting ? (
            <Loader2 className="size-3.5 animate-spin" aria-hidden />
          ) : (
            <Sparkles className="size-3.5" aria-hidden />
          )}
          Suggest with Alice
        </Button>
      </div>
      <Textarea
        id={id}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        placeholder={placeholder}
        rows={3}
        disabled={busy}
      />
      {suggestError ? (
        <p className="text-destructive text-xs">{suggestError}</p>
      ) : null}
    </div>
  );
}
