'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@repo/ui/components/ui/popover';
import { SmilePlus } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { NOTE_ICON_CHOICES } from '@/app/notes/_helpers/note-icons';

type NoteIconPickerProps = {
  readonly icon: string | null;
  // eslint-disable-next-line no-unused-vars -- icon callback
  readonly onChange: (icon: string | null) => void;
  readonly size?: 'sm' | 'lg';
};

export function NoteIconPicker({
  icon,
  onChange,
  size = 'lg',
}: Readonly<NoteIconPickerProps>) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          className={cn(
            'cursor-pointer font-normal',
            size === 'lg' ? 'h-14 w-14 text-3xl' : 'h-9 w-9 text-lg'
          )}
          aria-label={icon ? 'Change note icon' : 'Add note icon'}
        >
          {icon ? (
            <span aria-hidden>{icon}</span>
          ) : (
            <SmilePlus
              className={cn(
                'text-muted-foreground',
                size === 'lg' ? 'size-7' : 'size-4'
              )}
            />
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-56 p-2" align="start">
        <div className="grid grid-cols-5 gap-1">
          {NOTE_ICON_CHOICES.map((choice) => (
            <Button
              key={choice}
              type="button"
              variant={icon === choice ? 'secondary' : 'ghost'}
              size="icon-sm"
              className="cursor-pointer text-base"
              aria-label={`Set icon ${choice}`}
              aria-pressed={icon === choice}
              onClick={() => onChange(choice)}
            >
              <span aria-hidden>{choice}</span>
            </Button>
          ))}
        </div>
        {icon ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="mt-2 w-full cursor-pointer"
            onClick={() => onChange(null)}
          >
            Remove icon
          </Button>
        ) : null}
      </PopoverContent>
    </Popover>
  );
}
