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
} from '@/app/work-items/_components/workItem-form';
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

  useEffect(() => {
    if (open && !wasOpenRef.current) {
      setSessionMode(createFormModeProp ?? preferredMode);
    }
    wasOpenRef.current = open;
  }, [open, createFormModeProp, preferredMode]);

  const createFormMode = createFormModeProp ?? sessionMode;
  const useModernCreate = itemToEdit == null && createFormMode === 'modern';

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn(
          useModernCreate ? 'sm:max-w-4xl' : 'sm:max-w-xl',
          contentClassName
        )}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader className={useModernCreate ? 'sr-only' : undefined}>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <WorkItemForm
          {...formProps}
          itemToEdit={itemToEdit}
          createFormMode={createFormMode}
        />
      </DialogContent>
    </Dialog>
  );
}
