'use client';

import { useEffect, useState } from 'react';
import { Gauge } from '@repo/ui/lib/icons';
import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import {
  BACKLOG_CAPACITY_DISPLAY_OPTIONS,
  readBacklogCapacityDisplay,
  writeBacklogCapacityDisplay,
  type BacklogCapacityDisplayId,
} from '@/app/backlog/_helpers/backlog-capacity-display-storage';

type UseBacklogCapacityDisplayResult = {
  readonly capacityDisplay: BacklogCapacityDisplayId;
  // eslint-disable-next-line no-unused-vars -- setter signature
  readonly setCapacityDisplay: (display: BacklogCapacityDisplayId) => void;
};

export function useBacklogCapacityDisplay(
  userId: string | null | undefined
): UseBacklogCapacityDisplayResult {
  const [capacityDisplay, setCapacityDisplay] =
    useState<BacklogCapacityDisplayId>('bar');

  useEffect(() => {
    setCapacityDisplay(readBacklogCapacityDisplay(userId));
  }, [userId]);

  const persistCapacityDisplay = (display: BacklogCapacityDisplayId) => {
    setCapacityDisplay(display);
    writeBacklogCapacityDisplay(userId, display);
  };

  return {
    capacityDisplay,
    setCapacityDisplay: persistCapacityDisplay,
  };
}

type BacklogCapacityDisplayMenuProps = {
  readonly capacityDisplay: BacklogCapacityDisplayId;
  // eslint-disable-next-line no-unused-vars -- change callback signature
  readonly onCapacityDisplayChange: (display: BacklogCapacityDisplayId) => void;
};

export function BacklogCapacityDisplayMenu({
  capacityDisplay,
  onCapacityDisplayChange,
}: Readonly<BacklogCapacityDisplayMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0 cursor-pointer"
          aria-label="Change capacity display"
          title="Capacity display"
        >
          <Gauge className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Capacity display</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={capacityDisplay}
          onValueChange={(value) => {
            onCapacityDisplayChange(value as BacklogCapacityDisplayId);
          }}
        >
          {BACKLOG_CAPACITY_DISPLAY_OPTIONS.map((option) => (
            <DropdownMenuRadioItem key={option.id} value={option.id}>
              <div className="flex flex-col gap-0.5 pr-2">
                <span className="leading-none font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {option.description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
