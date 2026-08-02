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
  BACKLOG_LAYOUT_OPTIONS,
  getEffectiveBacklogLayout,
  readBacklogLayout,
  writeBacklogLayout,
  type BacklogLayoutId,
} from '@/app/backlog/_helpers/backlog-layout-storage';

const DESKTOP_MEDIA_QUERY = '(min-width: 1024px)';

type UseBacklogLayoutResult = {
  readonly preferredLayout: BacklogLayoutId;
  readonly effectiveLayout: BacklogLayoutId;
  // eslint-disable-next-line no-unused-vars -- setter signature
  readonly setPreferredLayout: (layout: BacklogLayoutId) => void;
};

export function useBacklogLayout(
  userId: string | null | undefined,
  showBacklogPane: boolean
): UseBacklogLayoutResult {
  const [backlogLayout, setBacklogLayout] = useState<BacklogLayoutId>('stack');
  const [isDesktop, setIsDesktop] = useState(false);
  const [hydrated, setHydrated] = useState(false);

  useEffect(() => {
    setBacklogLayout(readBacklogLayout(userId));
    setHydrated(true);
  }, [userId]);

  useEffect(() => {
    const media = window.matchMedia(DESKTOP_MEDIA_QUERY);
    const sync = () => setIsDesktop(media.matches);
    sync();
    media.addEventListener('change', sync);
    return () => media.removeEventListener('change', sync);
  }, []);

  const setPreferredLayout = (layout: BacklogLayoutId) => {
    setBacklogLayout(layout);
    writeBacklogLayout(userId, layout);
  };

  const effectiveLayout = hydrated
    ? getEffectiveBacklogLayout(backlogLayout, {
        isDesktop,
        showBacklogPane,
      })
    : 'stack';

  return {
    preferredLayout: backlogLayout,
    effectiveLayout,
    setPreferredLayout,
  };
}

type BacklogLayoutMenuProps = {
  readonly preferredLayout: BacklogLayoutId;
  // eslint-disable-next-line no-unused-vars -- change callback signature
  readonly onLayoutChange: (layout: BacklogLayoutId) => void;
};

export function BacklogLayoutMenu({
  preferredLayout,
  onLayoutChange,
}: Readonly<BacklogLayoutMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="h-8 cursor-pointer"
          aria-label="Change backlog layout"
        >
          <LayoutGrid className="size-4" />
          <span className="hidden sm:inline">Layout</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-64">
        <DropdownMenuLabel>Board layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={preferredLayout}
          onValueChange={(value) => {
            onLayoutChange(value as BacklogLayoutId);
          }}
        >
          {BACKLOG_LAYOUT_OPTIONS.map((option) => (
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
