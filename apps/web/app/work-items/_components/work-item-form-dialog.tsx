'use client';

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
  ...formProps
}: Readonly<WorkItemFormDialogProps>) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className={cn('sm:max-w-xl', contentClassName)}
        onPointerDownOutside={(event) => event.preventDefault()}
        onInteractOutside={(event) => event.preventDefault()}
      >
        <DialogHeader>
          <DialogTitle className={titleClassName}>{title}</DialogTitle>
          <DialogDescription className={descriptionClassName}>
            {description}
          </DialogDescription>
        </DialogHeader>
        <WorkItemForm {...formProps} />
      </DialogContent>
    </Dialog>
  );
}
