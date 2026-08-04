'use client';

import { Button } from '@repo/ui/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@repo/ui/components/ui/dropdown-menu';
import { ArrowUpDown } from '@repo/ui/lib/icons';
import type { CommentsSortOrder } from '@/app/comments/_components/comments-feed-helpers';

type CommentsSortMenuProps = {
  sortOrder: CommentsSortOrder;
  // eslint-disable-next-line no-unused-vars -- callback signature
  onSortOrderChange: (order: CommentsSortOrder) => void;
};

export function CommentsSortMenu({
  sortOrder,
  onSortOrderChange,
}: Readonly<CommentsSortMenuProps>) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          type="button"
          variant="ghost"
          size="icon-sm"
          aria-label="Sort comments"
          aria-pressed={sortOrder === 'newest'}
        >
          <ArrowUpDown className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onClick={() => onSortOrderChange('newest')}>
          Newest first
        </DropdownMenuItem>
        <DropdownMenuItem onClick={() => onSortOrderChange('oldest')}>
          Oldest first
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
