'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import {
  WorkItemForm,
  type WorkItemFormProps,
} from '@/app/work-items/_components/work-item-form/work-item-form';
import { useWorkItemCreateFormMode } from '@/app/work-items/_hooks/use-work-item-create-form-mode';
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

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSessionMode(createFormModeProp ?? preferredMode);
    }
    wasOpenRef.current = open;
  }, [open, createFormModeProp, preferredMode]);

  const createFormMode = createFormModeProp ?? sessionMode;
  const useModernLayout = createFormMode === 'modern';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          contentClassName,
          useModernLayout ? 'sm:max-w-4xl' : 'sm:max-w-xl'
        )}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className={useModernLayout ? 'sr-only' : undefined}>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <WorkItemForm
          {...formProps}
          itemToEdit={stableItemToEdit}
          createFormMode={createFormMode}
        />
      </DialogContent>
    </Dialog>
  );
}
