'use client';

import { Dialog, DialogContent } from '@repo/ui/components/ui/dialog';
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
}

export function ProjectFieldsErrorDialog({
  open,
  title: customTitle,
  description: customDescription,
  error,
  onOpenChange,
  onClose,
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

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onPointerDownOutside={(e) => e.preventDefault()}
        onInteractOutside={(e) => e.preventDefault()}
        onPointerDown={(e) => e.stopPropagation()}
        onMouseDown={(e) => e.stopPropagation()}
        onClick={(e) => e.stopPropagation()}
        className="bg-card border-border/80 overflow-hidden p-0 backdrop-blur-md sm:max-w-md"
      >
        <div className="p-6">
          <div className="mb-3 flex items-center gap-3 text-rose-500">
            <div className="rounded-full border border-rose-500/20 bg-rose-500/10 p-2">
              <AlertCircle className="h-6 w-6" />
            </div>
            <h3 className="text-foreground text-lg font-bold">{title}</h3>
          </div>

          <p className="text-muted-foreground text-sm leading-relaxed">
            {description}
          </p>
          <div className="text-muted-foreground/90 bg-muted/50 border-border/40 mt-3 max-h-48 overflow-y-auto rounded-lg border p-3 font-mono text-xs whitespace-pre-wrap">
            {error}
          </div>
        </div>

        <div className="bg-muted/40 border-border flex justify-end gap-3 border-t px-6 py-4">
          <Button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onClose();
            }}
            className="bg-rose-600 px-4 text-xs font-semibold text-white shadow-sm hover:bg-rose-700"
          >
            OK
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
