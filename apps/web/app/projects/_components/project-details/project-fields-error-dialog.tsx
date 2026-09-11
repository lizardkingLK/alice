'use client';

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@repo/ui/components/ui/dialog';
import { Button } from '@repo/ui/components/ui/button';
import { AlertCircle } from '@repo/ui/lib/icons';

export interface ProjectFieldsErrorDialogProps {
  readonly open: boolean;
  readonly title?: string;
  readonly description?: string;
  readonly error: string | null;
  // eslint-disable-next-line no-unused-vars
  readonly onOpenChange?: (open: boolean) => void;
  readonly onClose: () => void;
  readonly onConfirm?: () => void;
  readonly confirmText?: string;
  readonly cancelText?: string;
  readonly showCancel?: boolean;
}

export function ProjectFieldsErrorDialog({
  open,
  title: customTitle,
  description: customDescription,
  error,
  onOpenChange,
  onClose,
  onConfirm,
  confirmText = 'OK',
  cancelText = 'Cancel',
  showCancel = false,
}: Readonly<ProjectFieldsErrorDialogProps>) {
  if (!error) return null;

  const lower = error.toLowerCase();
  const isSyntax = lower.includes('syntax') || lower.includes('json');
  const isPermission =
    lower.includes('unauthorized') ||
    lower.includes('permission') ||
    lower.includes('forbidden') ||
    lower.includes('manager') ||
    lower.includes('administrator');
  const isValidation = lower.includes('validation') || lower.includes('schema');

  let defaultTitle = 'Dynamic Fields Error';
  let defaultDescription =
    'An error occurred while validating or saving the dynamic fields schema.';

  if (isPermission) {
    defaultTitle = 'Permission Denied';
    defaultDescription =
      'Only project managers and administrators can edit and save dynamic field configurations.';
  } else if (isSyntax) {
    defaultTitle = 'JSON Syntax Error';
    defaultDescription =
      'The schema contains invalid JSON syntax. Please correct the syntax before proceeding.';
  } else if (isValidation) {
    defaultTitle = 'Schema Validation Error';
    defaultDescription =
      'The schema does not conform to the required Project Fields specification.';
  }

  const title = customTitle || defaultTitle;
  const description = customDescription || defaultDescription;

  const handleConfirm = () => {
    if (onConfirm) {
      onConfirm();
    } else {
      onClose();
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dismissOnOutsideClick={false} className="sm:max-w-md">
        <DialogHeader className="gap-3">
          <div className="flex items-center gap-3 text-rose-500">
            <div className="rounded-full border border-rose-500/20 bg-rose-500/10 p-2">
              <AlertCircle className="size-5" />
            </div>
            <DialogTitle className="text-foreground text-lg font-bold">
              {title}
            </DialogTitle>
          </div>
          <DialogDescription className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </DialogDescription>
        </DialogHeader>

        <div className="text-muted-foreground/90 bg-muted/50 border-border/40 max-h-48 overflow-y-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap">
          {error}
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          {showCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onClose}
              className="px-4 text-xs font-semibold shadow-sm"
            >
              {cancelText}
            </Button>
          )}
          <Button
            type="button"
            onClick={handleConfirm}
            className="bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            {confirmText}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
