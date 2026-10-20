'use client';

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
import { LayoutList } from '@repo/ui/lib/icons';
import {
  WORK_ITEM_ACTIVITY_LAYOUT_OPTIONS,
  type WorkItemActivityLayout,
} from '@/app/work-items/_helpers/work-item-activity-layout-preference';

type WorkItemActivityLayoutMenuProps = {
  readonly layout: WorkItemActivityLayout;
  // eslint-disable-next-line no-unused-vars -- change callback
  readonly onLayoutChange: (layout: WorkItemActivityLayout) => void;
};

export function WorkItemActivityLayoutMenu({
  layout,
  onLayoutChange,
}: Readonly<WorkItemActivityLayoutMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Change activity layout"
          title="Change activity layout"
        >
          <LayoutList className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-64">
        <DropdownMenuLabel>Activity layout</DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuRadioGroup
          value={layout}
          onValueChange={(value) => {
            onLayoutChange(value as WorkItemActivityLayout);
          }}
        >
          {WORK_ITEM_ACTIVITY_LAYOUT_OPTIONS.map((option) => (
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
