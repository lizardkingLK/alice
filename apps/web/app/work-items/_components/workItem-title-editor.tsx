'use client';

import { useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { PencilIcon } from '@repo/ui/lib/icons';
import { cn } from '@repo/ui/lib/utils';
import {
  WORK_ITEM_PATCH_FIELD_CONFIG,
  WorkItemFieldPatchDialog,
} from '@/app/work-items/_components/workItem-field-patch-dialog';
import type { DbWorkItem } from '@/app/work-items/_services/workItem.service.server';

type WorkItemTitleEditorProps = {
  readonly workItemId: string;
  readonly title: string;
  // eslint-disable-next-line no-unused-vars -- callback signature
  readonly onPatched: (updated: Partial<DbWorkItem>) => void;
  readonly className?: string;
};

export function WorkItemTitleEditor({
  workItemId,
  title,
  onPatched,
  className,
}: Readonly<WorkItemTitleEditorProps>) {
  const [dialogOpen, setDialogOpen] = useState(false);

  return (
    <>
      <div
        className={cn(
          'mt-4 flex w-full items-start justify-between gap-2',
          className
        )}
      >
        <h1 className="min-w-0 flex-1 px-1.5 py-0.5 text-2xl font-semibold tracking-tight text-balance sm:text-3xl">
          {title}
        </h1>
        <Button
          type="button"
          variant="secondary"
          size="icon"
          className="mt-1 shrink-0 cursor-pointer"
          aria-label="Edit title"
          onClick={() => setDialogOpen(true)}
        >
          <PencilIcon />
        </Button>
      </div>

      <WorkItemFieldPatchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        workItemId={workItemId}
        fieldConfig={WORK_ITEM_PATCH_FIELD_CONFIG.title}
        currentValue={title}
        onPatched={onPatched}
      />
    </>
  );
}
