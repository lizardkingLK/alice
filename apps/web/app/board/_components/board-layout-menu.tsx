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
import { Switch } from '@repo/ui/components/ui/switch';
import {
  BOARD_LAYOUT_OPTIONS,
  readBoardLayout,
  writeBoardLayout,
  type BoardLayoutId,
} from '@/app/board/_helpers/board-layout-storage';
import {
  resolveSubscribeStatusEvents,
  type BoardSyncMode,
  type BoardSyncPrefs,
} from '@/app/board/_helpers/board-sync-storage';

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
  readonly syncPrefs?: BoardSyncPrefs;
  // eslint-disable-next-line no-unused-vars -- change callback
  readonly onSyncPrefsChange?: (prefs: BoardSyncPrefs) => void;
};

export function BoardLayoutMenu({
  layout,
  onLayoutChange,
  syncPrefs,
  onSyncPrefsChange,
}: Readonly<BoardLayoutMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="icon"
          className="size-8 shrink-0 cursor-pointer"
          aria-label="Board settings"
          title="Board settings"
        >
          <LayoutGrid className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-72">
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
                <span className="leading-none font-medium">{option.label}</span>
                <span className="text-muted-foreground text-xs font-normal">
                  {option.description}
                </span>
              </div>
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>

        {syncPrefs && onSyncPrefsChange ? (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuLabel>Board sync</DropdownMenuLabel>
            <DropdownMenuRadioGroup
              value={syncPrefs.syncMode}
              onValueChange={(value) => {
                const syncMode = value as BoardSyncMode;
                onSyncPrefsChange({
                  syncMode,
                  subscribeStatusEvents: resolveSubscribeStatusEvents(
                    syncMode,
                    syncPrefs
                  ),
                });
              }}
            >
              <DropdownMenuRadioItem value="realtime">
                <div className="flex flex-col gap-0.5 pr-2">
                  <span className="leading-none font-medium">Realtime</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    Live updates from teammates; drag does not wait on save
                  </span>
                </div>
              </DropdownMenuRadioItem>
              <DropdownMenuRadioItem value="static">
                <div className="flex flex-col gap-0.5 pr-2">
                  <span className="leading-none font-medium">Static</span>
                  <span className="text-muted-foreground text-xs font-normal">
                    No live merge; refresh to see others&apos; moves
                  </span>
                </div>
              </DropdownMenuRadioItem>
            </DropdownMenuRadioGroup>
            {syncPrefs.syncMode === 'realtime' ? (
              <div className="flex items-center justify-between gap-3 px-2 py-2">
                <div className="flex min-w-0 flex-col gap-0.5">
                  <span className="text-sm leading-none font-medium">
                    Subscribe to moves
                  </span>
                  <span className="text-muted-foreground text-xs font-normal">
                    Apply placement changes over the wire
                  </span>
                </div>
                <Switch
                  checked={syncPrefs.subscribeStatusEvents}
                  onCheckedChange={(checked) => {
                    onSyncPrefsChange({
                      ...syncPrefs,
                      subscribeStatusEvents: checked,
                    });
                  }}
                  aria-label="Subscribe to board moves"
                />
              </div>
            ) : null}
          </>
        ) : null}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
