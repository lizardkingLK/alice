'use client';

import { useMemo, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@repo/ui/components/ui/dialog';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@repo/ui/components/ui/tooltip';
import { Filter } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import { useToggleKeyboardShortcut } from '@repo/ui/hooks/use-keyboard-shortcut';
import { isShiftLetter } from '@repo/ui/lib/shortcut-gate';
import { Label } from '@repo/ui/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@repo/ui/components/ui/select';
import type {
  ChartBoardOwnershipFilter,
  ChartBoardStatusFilter,
} from '@/app/charts/_components/charts.types';

export type ChartsFilterDraft = {
  readonly ownership: ChartBoardOwnershipFilter;
  readonly status: ChartBoardStatusFilter;
};

type ChartsFilterDialogProps = {
  readonly ownership: ChartBoardOwnershipFilter;
  readonly status: ChartBoardStatusFilter;
  readonly hasActiveFilters: boolean;
  // eslint-disable-next-line no-unused-vars -- apply staged filters
  readonly onApplyFilters: (draft: ChartsFilterDraft) => void;
};

function ChartsBoardFilterSelectField({
  id,
  label,
  value,
  onValueChange,
  options,
}: Readonly<{
  id: string;
  label: string;
  value: string;
  // eslint-disable-next-line no-unused-vars -- select change
  onValueChange: (value: string) => void;
  options: readonly { value: string; label: string }[];
}>) {
  return (
    <div className="space-y-2">
      <Label htmlFor={id}>{label}</Label>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger id={id} className="w-full">
          <SelectValue placeholder={label} />
        </SelectTrigger>
        <SelectContent>
          {options.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

export function ChartsFilterDialog({
  ownership,
  status,
  hasActiveFilters,
  onApplyFilters,
}: Readonly<ChartsFilterDialogProps>) {
  const [open, setOpen] = useState(false);
  const [draft, setDraft] = useState<ChartsFilterDraft>({
    ownership,
    status,
  });

  useToggleKeyboardShortcut(
    (event) => isShiftLetter(event, 'f'),
    open,
    setOpen
  );

  const isDirty = useMemo(
    () => draft.ownership !== ownership || draft.status !== status,
    [draft.ownership, draft.status, ownership, status]
  );

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      setDraft({ ownership, status });
    }
    setOpen(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Button
                type="button"
                variant="outline"
                size="sm"
                aria-label="Open filters"
                aria-keyshortcuts="Shift+F"
                className={cn(
                  'h-9 cursor-pointer gap-1.5 px-3',
                  (open || hasActiveFilters) &&
                    'border-primary text-primary hover:text-primary'
                )}
              >
                <Filter className="size-3.5" />
                Filter
              </Button>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="bottom">
            Press Shift + F to open and close
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Filter charts</DialogTitle>
          <DialogDescription>
            Narrow boards by ownership and status. More filters land with
            persistence.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 py-2">
          <ChartsBoardFilterSelectField
            id="charts-filter-ownership"
            label="Ownership"
            value={draft.ownership}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                ownership: value as ChartBoardOwnershipFilter,
              }))
            }
            options={[
              { value: 'all', label: 'All' },
              { value: 'mine', label: 'Mine' },
              { value: 'shared', label: 'Shared with me' },
            ]}
          />

          <ChartsBoardFilterSelectField
            id="charts-filter-status"
            label="Status"
            value={draft.status}
            onValueChange={(value) =>
              setDraft((prev) => ({
                ...prev,
                status: value as ChartBoardStatusFilter,
              }))
            }
            options={[
              { value: 'all', label: 'All' },
              { value: 'active', label: 'Active' },
              { value: 'archived', label: 'Archived' },
            ]}
          />
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            className="cursor-pointer"
            onClick={() => {
              setDraft({ ownership: 'all', status: 'all' });
            }}
          >
            Reset
          </Button>
          <Button
            type="button"
            className="cursor-pointer"
            disabled={!isDirty && !hasActiveFilters}
            onClick={() => {
              onApplyFilters(draft);
              setOpen(false);
            }}
          >
            Apply filters
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
