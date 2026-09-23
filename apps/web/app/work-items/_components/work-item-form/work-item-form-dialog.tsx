'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Loader2 } from '@repo/ui/lib/icons';
import {
  WorkItemForm,
  type WorkItemFormProps,
} from '@/app/work-items/_components/work-item-form/work-item-form';
import { useWorkItemCreateFormMode } from '@/app/work-items/_hooks/use-work-item-create-form-mode';
import { getWorkItemById } from '@/app/work-items/_services/work-items.reads.client';
import type { DbWorkItem } from '@/app/work-items/_types/work-items.reads.types';
import { cn } from '@repo/ui/lib/utils';

type WorkItemFormDialogProps = WorkItemFormProps & {
  open: boolean;
  // eslint-disable-next-line no-unused-vars
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  contentClassName?: string;
  titleClassName?: string;
  descriptionClassName?: string;
};

/**
 * Keeps the last non-null edit item while the dialog is open so parents can
 * clear `itemToEdit` on close without flashing create (modern) layout mid-exit.
 */
function useStableItemToEdit(
  open: boolean,
  itemToEdit: WorkItemFormProps['itemToEdit']
) {
  const itemRef = useRef(itemToEdit ?? null);
  if (open || itemToEdit != null) {
    itemRef.current = itemToEdit ?? null;
  }
  return itemRef.current;
}

/**
 * List/board/chart rows omit TipTap `description`. Load full detail when
 * editing so classic + modern forms hydrate the description editor.
 */
function useEditItemWithDescription(
  open: boolean,
  stableItemToEdit: DbWorkItem | null
): {
  readonly itemToEdit: DbWorkItem | null;
  readonly detailReady: boolean;
} {
  const [resolvedItem, setResolvedItem] = useState<DbWorkItem | null>(
    stableItemToEdit
  );
  const [detailReady, setDetailReady] = useState(stableItemToEdit == null);

  useEffect(() => {
    if (!open) {
      // Reset so the next open (create or edit) is not stuck on "Loading…".
      setDetailReady(stableItemToEdit == null);
      if (!stableItemToEdit) {
        setResolvedItem(null);
      }
      return;
    }

    if (!stableItemToEdit) {
      setResolvedItem(null);
      setDetailReady(true);
      return;
    }

    const fallbackItem = stableItemToEdit;
    const itemId = fallbackItem.id;
    let cancelled = false;
    setDetailReady(false);
    setResolvedItem(fallbackItem);

    getWorkItemById(itemId)
      .then((full) => {
        if (!cancelled) {
          setResolvedItem(full);
          setDetailReady(true);
        }
      })
      .catch(() => {
        if (!cancelled) {
          // Fall back to the compact row so the dialog still opens.
          setResolvedItem(fallbackItem);
          setDetailReady(true);
        }
      });

    return () => {
      cancelled = true;
    };
    // Intentionally key off id: parents may pass a new list-row object each render.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- stableItemToEdit by id
  }, [open, stableItemToEdit?.id]);

  return { itemToEdit: resolvedItem, detailReady };
}

export function WorkItemFormDialog({
  open,
  onOpenChange,
  title,
  description,
  contentClassName,
  titleClassName,
  descriptionClassName,
  itemToEdit = null,
  createFormMode: createFormModeProp,
  ...formProps
}: Readonly<WorkItemFormDialogProps>) {
  const preferredMode = useWorkItemCreateFormMode();
  const [sessionMode, setSessionMode] = useState(
    () => createFormModeProp ?? preferredMode
  );
  const wasOpenRef = useRef(open);
  const stableItemToEdit = useStableItemToEdit(open, itemToEdit);
  const { itemToEdit: resolvedItemToEdit, detailReady } =
    useEditItemWithDescription(open, stableItemToEdit);

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSessionMode(createFormModeProp ?? preferredMode);
    }
    wasOpenRef.current = open;
  }, [open, createFormModeProp, preferredMode]);

  const createFormMode = createFormModeProp ?? sessionMode;
  const useModernLayout = createFormMode === 'modern';
  const formKey = resolvedItemToEdit
    ? `${resolvedItemToEdit.id}:${resolvedItemToEdit.updated_at}`
    : 'create';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          contentClassName,
          useModernLayout ? 'sm:max-w-4xl' : 'sm:max-w-xl',
          'flex max-h-[85vh] flex-col overflow-hidden sm:max-h-[90vh]'
        )}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
        onOpenAutoFocus={(event) => {
          if (!useModernLayout || !detailReady) {
            return;
          }
          event.preventDefault();
          const titleInput = document.getElementById(
            'title'
          ) as HTMLInputElement | null;
          if (!titleInput) {
            return;
          }
          titleInput.focus();
          const end = titleInput.value.length;
          titleInput.setSelectionRange(end, end);
        }}
      >
        <DialogHeader className={useModernLayout ? 'sr-only' : undefined}>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            {description}
          </DialogDescription>
        </DialogHeader>
        {detailReady ? (
          <WorkItemForm
            key={formKey}
            {...formProps}
            itemToEdit={resolvedItemToEdit}
            createFormMode={createFormMode}
          />
        ) : (
          <div className="text-muted-foreground flex min-h-48 flex-1 items-center justify-center gap-2 py-12 text-sm">
            <Loader2 className="size-4 animate-spin" />
            Loading work item…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
