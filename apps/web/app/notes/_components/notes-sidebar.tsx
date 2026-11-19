'use client';

import { Button } from '@repo/ui/components/ui/button';
import { TruncatedText } from '@repo/ui/components/ui/truncated-text';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { PanelLeftClose, Plus, Trash2 } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  noteDisplayTitle,
  notePreview,
  NOTES_MAX,
  type Note,
} from '@/app/notes/_helpers/notes-storage';

type NotesSidebarProps = {
  readonly notes: readonly Note[];
  readonly selectedId: string | null;
  // eslint-disable-next-line no-unused-vars -- select callback
  readonly onSelect: (id: string) => void;
  readonly onCreate: () => void;
  // eslint-disable-next-line no-unused-vars -- delete callback
  readonly onDelete: (id: string) => void;
  readonly onCollapse: () => void;
};

export function NotesSidebar({
  notes,
  selectedId,
  onSelect,
  onCreate,
  onDelete,
  onCollapse,
}: Readonly<NotesSidebarProps>) {
  const atCapacity = notes.length >= NOTES_MAX;

  return (
    <aside
      id="notes-drafts-sidebar"
      className="border-border bg-muted/20 flex h-full min-h-0 w-64 shrink-0 flex-col border-r"
    >
      <div className="flex items-center justify-between gap-2 px-3 py-3">
        <p className="text-sm font-medium">Drafts</p>
        <div className="flex items-center gap-0.5">
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="New note"
                disabled={atCapacity}
                onClick={onCreate}
              >
                <Plus className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">
              {atCapacity ? `Limit of ${NOTES_MAX} notes` : 'New note'}
            </TooltipContent>
          </Tooltip>
          <Tooltip>
            <TooltipTrigger asChild>
              <Button
                type="button"
                variant="ghost"
                size="icon-sm"
                className="cursor-pointer"
                aria-label="Hide drafts"
                aria-expanded={true}
                aria-controls="notes-drafts-sidebar"
                onClick={onCollapse}
              >
                <PanelLeftClose className="size-4" />
              </Button>
            </TooltipTrigger>
            <TooltipContent side="bottom">Hide drafts</TooltipContent>
          </Tooltip>
        </div>
      </div>

      {notes.length === 0 ? (
        <p className="text-muted-foreground px-3 py-6 text-center text-sm">
          No drafts yet.
        </p>
      ) : (
        <ul className="flex min-h-0 flex-1 flex-col gap-0.5 overflow-y-auto px-2 pb-3">
          {notes.map((note) => {
            const isSelected = note.id === selectedId;
            return (
              <li key={note.id} className="group relative">
                <button
                  type="button"
                  className={cn(
                    'hover:bg-muted/70 flex w-full cursor-pointer flex-col gap-0.5 rounded-md px-2 py-2 pr-8 text-left text-sm transition-colors',
                    isSelected && 'bg-muted'
                  )}
                  onClick={() => onSelect(note.id)}
                  aria-current={isSelected ? 'true' : undefined}
                >
                  <div className="flex min-w-0 items-center gap-1.5">
                    {note.icon ? (
                      <span className="shrink-0 text-sm" aria-hidden>
                        {note.icon}
                      </span>
                    ) : null}
                    <TruncatedText className="min-w-0 font-medium">
                      {noteDisplayTitle(note)}
                    </TruncatedText>
                  </div>
                  <TruncatedText className="text-muted-foreground text-xs">
                    {notePreview(note)}
                  </TruncatedText>
                </button>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon-sm"
                      className="text-muted-foreground hover:text-destructive absolute top-1.5 right-1 cursor-pointer opacity-0 group-hover:opacity-100 focus-visible:opacity-100"
                      aria-label="Delete note"
                      onClick={() => onDelete(note.id)}
                    >
                      <Trash2 className="size-3.5" />
                    </Button>
                  </TooltipTrigger>
                  <TooltipContent side="bottom">Delete</TooltipContent>
                </Tooltip>
              </li>
            );
          })}
        </ul>
      )}
    </aside>
  );
}
