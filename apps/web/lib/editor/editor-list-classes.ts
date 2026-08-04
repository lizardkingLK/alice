import { cn } from '@repo/ui/lib/utils';

/**
 * Shared TipTap / ProseMirror list marker classes (Tailwind preflight clears
 * list styles; overflow parents clip outside markers without pl-*).
 */
export const EDITOR_LIST_CLASSES = cn(
  '[&_ul]:list-disc [&_ul]:pl-5',
  '[&_ol]:list-decimal [&_ol]:pl-5',
  '[&_li>p]:my-0'
);

/** Compact editors also tighten list + item spacing. */
export const COMPACT_EDITOR_LIST_CLASSES = cn(
  EDITOR_LIST_CLASSES,
  '[&_ul]:my-1 [&_ol]:my-1 [&_li]:my-0'
);
