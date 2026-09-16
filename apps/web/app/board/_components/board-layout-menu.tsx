'use client';

import { useEffect, useState } from 'react';
import { LayoutGrid } from '@repo/ui/lib/icons';
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
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import {
  BOARD_LAYOUT_OPTIONS,
  readBoardLayout,
  writeBoardLayout,
  type BoardLayoutId,
} from '@/app/board/_helpers/board-layout-storage';

type UseBoardLayoutResult = {
  readonly layout: BoardLayoutId;
  // eslint-disable-next-line no-unused-vars -- setter
  readonly setLayout: (layout: BoardLayoutId) => void;
};

export function useBoardLayout(
  userId: string | null | undefined
): UseBoardLayoutResult {
  const [layout, setLayout] = useState<BoardLayoutId>('board');

  useEffect(() => {
    setLayout(readBoardLayout(userId));
  }, [userId]);

  const commitLayout = (next: BoardLayoutId) => {
    setLayout(next);
    writeBoardLayout(userId, next);
  };

  return { layout, setLayout: commitLayout };
}

type BoardLayoutMenuProps = {
  readonly layout: BoardLayoutId;
  // eslint-disable-next-line no-unused-vars -- change callback
  readonly onLayoutChange: (layout: BoardLayoutId) => void;
};

export function BoardLayoutMenu({
  layout,
  onLayoutChange,
}: Readonly<BoardLayoutMenuProps>) {
  return (
    <TooltipProvider delayDuration={200}>
      <DropdownMenu>
        <Tooltip>
          <TooltipTrigger asChild>
            <DropdownMenuTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="icon"
                className="size-8 shrink-0 cursor-pointer"
                aria-label="Change board layout"
              >
                <LayoutGrid className="size-4" />
              </Button>
            </DropdownMenuTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">Layout</TooltipContent>
        </Tooltip>
        <DropdownMenuContent align="end" className="w-64">
          <DropdownMenuLabel>Board layout</DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuRadioGroup
            value={layout}
            onValueChange={(value) => {
              onLayoutChange(value as BoardLayoutId);
            }}
          >
            {BOARD_LAYOUT_OPTIONS.map((option) => (
              <DropdownMenuRadioItem key={option.id} value={option.id}>
                <div className="flex flex-col gap-0.5 pr-2">
                  <span className="leading-none font-medium">
                    {option.label}
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    {option.description}
                  </span>
                </div>
              </DropdownMenuRadioItem>
            ))}
          </DropdownMenuRadioGroup>
        </DropdownMenuContent>
      </DropdownMenu>
    </TooltipProvider>
  );
}
