'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@repo/ui/components/ui/command';
import { Search } from '@repo/ui/lib/icons';
import { DIALOG_CLOSE_ANIMATION_MS } from '@/lib/dialog-close';
import {
  docHref,
  filterDocsIndex,
  type DocsIndexEntry,
} from '@/lib/docs/docs-shared';

type DocsSearchDialogProps = {
  readonly entries: readonly DocsIndexEntry[];
};

export function DocsSearchDialog({ entries }: DocsSearchDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key.toLowerCase() !== 'k') {
        return;
      }
      if (!(event.metaKey || event.ctrlKey)) {
        return;
      }
      event.preventDefault();
      setOpen((prev) => !prev);
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  useEffect(() => {
    if (open) {
      return;
    }

    const timer = window.setTimeout(() => {
      setQuery('');
    }, DIALOG_CLOSE_ANIMATION_MS);

    return () => window.clearTimeout(timer);
  }, [open]);

  const results = filterDocsIndex(entries, query).slice(0, 40);

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="text-muted-foreground h-9 w-full max-w-full min-w-0 justify-start gap-2 overflow-hidden px-3"
        onClick={() => setOpen(true)}
      >
        <Search className="size-3.5 shrink-0" />
        <span className="min-w-0 flex-1 truncate text-left text-xs">
          Search docs…
        </span>
        <kbd className="bg-muted text-muted-foreground pointer-events-none hidden shrink-0 rounded border px-1 py-0.5 font-mono text-[10px] xl:inline">
          Ctrl K
        </kbd>
      </Button>

      <CommandDialog
        open={open}
        onOpenChange={setOpen}
        title="Search documentation"
        description="Find a documentation page by title or content."
        shouldFilter={false}
      >
        <CommandInput
          placeholder="Search documentation…"
          value={query}
          onValueChange={setQuery}
        />
        <CommandList>
          <CommandEmpty>No matching docs.</CommandEmpty>
          <CommandGroup heading="Documents">
            {results.map((entry) => (
              <CommandItem
                key={entry.slug}
                value={`${entry.title} ${entry.section} ${entry.excerpt}`}
                onSelect={() => {
                  setOpen(false);
                  router.push(docHref(entry.slug));
                }}
              >
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="truncate font-medium">{entry.title}</span>
                  <span className="text-muted-foreground truncate text-xs">
                    {entry.section}
                    {entry.excerpt ? ` · ${entry.excerpt}` : ''}
                  </span>
                </div>
              </CommandItem>
            ))}
          </CommandGroup>
        </CommandList>
      </CommandDialog>
    </>
  );
}
