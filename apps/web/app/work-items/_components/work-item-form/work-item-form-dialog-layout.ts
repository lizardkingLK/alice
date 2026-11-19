import { cn } from '@repo/ui/lib/utils';

/**
 * Jira-like create/edit dialog chrome layouts.
 * `floating` / `minimized` are non-modal (page stays interactive).
 */
export type WorkItemFormDialogLayout =
  'center' | 'fullscreen' | 'floating' | 'minimized';

/** Blocking centered layouts (overlay + focus trap). */
export type WorkItemFormModalLayout = 'center' | 'fullscreen';

export function isWorkItemFormModalLayout(
  layout: WorkItemFormDialogLayout
): layout is WorkItemFormModalLayout {
  return layout === 'center' || layout === 'fullscreen';
}

export function isWorkItemFormNonModalLayout(
  layout: WorkItemFormDialogLayout
): boolean {
  return layout === 'floating' || layout === 'minimized';
}

/**
 * Dialog shell classes for each chrome layout.
 * `fullscreen` matches Jira’s expanded create modal (large centered panel),
 * not a true browser/viewport fullscreen takeover.
 * `floating` is a bottom-right card with no overlay.
 */
export function workItemFormDialogLayoutClassName(
  layout: WorkItemFormDialogLayout,
  useModernLayout: boolean
): string {
  if (layout === 'minimized') {
    return cn(
      'top-auto right-4 bottom-4 left-auto h-auto w-auto max-w-none',
      // No rounded-full on the shell — that morphs the dialog into a circle.
      'translate-x-0 translate-y-0 gap-0 rounded-xl p-0 shadow-lg ring-1',
      'sm:max-w-none duration-0 data-open:zoom-in-100 data-closed:zoom-out-100'
    );
  }

  if (layout === 'floating') {
    return cn(
      'top-auto right-4 bottom-4 left-auto',
      'h-[min(80dvh,40rem)] max-h-[min(80dvh,40rem)] w-[min(100vw-2rem,28rem)]',
      'translate-x-0 translate-y-0 rounded-xl sm:max-w-[28rem]'
    );
  }

  if (layout === 'fullscreen') {
    return cn(
      'top-1/2 left-1/2 h-[min(92dvh,56rem)] max-h-[92dvh] w-[min(96vw,48rem)]',
      '-translate-x-1/2 -translate-y-1/2 rounded-xl sm:max-w-[48rem]'
    );
  }

  return cn(
    useModernLayout ? 'sm:max-w-4xl' : 'sm:max-w-xl',
    'max-h-[85vh] sm:max-h-[90vh]'
  );
}

/** Compact pill grid vs expanded label+control list (Jira create detail). */
export function isWorkItemFormDetailLayout(
  layout: WorkItemFormDialogLayout
): boolean {
  return layout === 'fullscreen' || layout === 'floating';
}
