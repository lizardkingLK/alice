'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Input } from '@repo/ui/components/ui/input';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import { Loader2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { afterDialogClose } from '@/lib/dialog-close';
import {
  searchWorkItemsForNotes,
  type NotesWorkItemOption,
} from '@/app/notes/_services/notes-work-items.client';

type NotesAttachDialogProps = {
  readonly open: boolean;
  // eslint-disable-next-line no-unused-vars -- open change
  readonly onOpenChange: (open: boolean) => void;
  // eslint-disable-next-line no-unused-vars -- select callback
  readonly onSelect: (item: NotesWorkItemOption) => void | Promise<void>;
  readonly isAttaching?: boolean;
};

export function NotesAttachDialog({
  open,
  onOpenChange,
  onSelect,
  isAttaching = false,
}: Readonly<NotesAttachDialogProps>) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<NotesWorkItemOption[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (!open) {
      return;
    }
    let cancelled = false;
    const handle = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      searchWorkItemsForNotes(query)
        .then((items) => {
          if (!cancelled) {
            setResults(items);
          }
        })
        .catch(() => {
          if (!cancelled) {
            setError('Could not load work items.');
            setResults([]);
          }
        })
        .finally(() => {
          if (!cancelled) {
            setLoading(false);
          }
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(handle);
    };
  }, [open, query]);

  useEffect(() => {
    if (open) {
      return;
    }
    return afterDialogClose(() => {
      setQuery('');
      setResults([]);
      setError(null);
      setSelectedId(null);
    });
  }, [open]);

  const selected = results.find((item) => item.id === selectedId) ?? null;

  const handleConfirm = () => {
    if (!selected || isAttaching) {
      return;
    }
    Promise.resolve(onSelect(selected)).catch(() => {
      setError('Could not attach this note.');
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[min(90vh,32rem)] flex-col gap-0 overflow-hidden p-0 sm:max-w-lg">
        <DialogHeader className="border-border shrink-0 space-y-1 border-b px-4 py-3 text-left">
          <DialogTitle>Attach to work item</DialogTitle>
          <DialogDescription>
            Upload this note as a markdown file on a work item.
          </DialogDescription>
        </DialogHeader>

        <div className="flex min-h-0 flex-1 flex-col gap-2 px-4 py-3">
          <Input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by title or key…"
            aria-label="Search work items"
            disabled={isAttaching}
          />
          <div className="border-border min-h-0 flex-1 overflow-y-auto rounded-md border">
            {loading ? (
              <div className="text-muted-foreground flex items-center justify-center gap-2 py-6 text-sm">
                <Loader2 className="size-4 animate-spin" aria-hidden />
                Searching…
              </div>
            ) : null}
            {!loading && error ? (
              <p className="text-destructive px-3 py-4 text-center text-sm">
                {error}
              </p>
            ) : null}
            {!loading && !error && results.length === 0 ? (
              <p className="text-muted-foreground px-3 py-4 text-center text-sm">
                No matching work items.
              </p>
            ) : null}
            {!loading && !error && results.length > 0 ? (
              <ul className="flex flex-col p-1">
                {results.map((item) => {
                  const isSelected = item.id === selectedId;
                  return (
                    <li key={item.id}>
                      <button
                        type="button"
                        className={cn(
                          'hover:bg-muted/70 flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-3 py-2 text-left text-sm transition-colors',
                          isSelected && 'bg-muted'
                        )}
                        onClick={() => setSelectedId(item.id)}
                        disabled={isAttaching}
                      >
                        <div className="flex items-center gap-2">
                          {item.key ? (
                            <span className="text-muted-foreground shrink-0 text-xs">
                              {item.key}
                            </span>
                          ) : null}
                          <TruncatedText className="min-w-0 font-medium">
                            {item.title}
                          </TruncatedText>
                        </div>
                      </button>
                    </li>
                  );
                })}
              </ul>
            ) : null}
          </div>
        </div>

        <DialogFooter className="border-border shrink-0 border-t px-4 py-3">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            disabled={isAttaching}
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!selected || isAttaching}
            onClick={handleConfirm}
          >
            {isAttaching ? (
              <>
                <Loader2 data-icon="inline-start" className="animate-spin" />
                Attaching…
              </>
            ) : (
              'Attach'
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
