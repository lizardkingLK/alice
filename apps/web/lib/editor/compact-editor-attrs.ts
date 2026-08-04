import { cn } from '@repo/ui/lib/utils';
import { COMPACT_EDITOR_LIST_CLASSES } from '@/lib/editor/editor-list-classes';

type CompactEditorSize = 'sm' | 'lg';

type CompactEditorAttributesOptions = {
  ariaLabel: string;
  size?: CompactEditorSize;
  className?: string;
};

/** Shared ProseMirror attribute classes for compact TipTap editors. */
export function getCompactEditorAttributes({
  ariaLabel,
  size = 'sm',
  className,
}: CompactEditorAttributesOptions): {
  class: string;
  'aria-label': string;
  role: 'textbox';
} {
  return {
    class: cn(
      'max-w-none min-h-16 px-3 py-2 outline-none focus-visible:ring-ring focus-visible:ring-2 focus-visible:ring-offset-2',
      'prose-p:my-1',
      COMPACT_EDITOR_LIST_CLASSES,
      // Only the empty-doc class — not every empty paragraph — so placeholder
      // does not reappear on trailing lines after Enter / list commands.
      '[&_p.is-editor-empty::before]:text-muted-foreground [&_p.is-editor-empty::before]:float-left [&_p.is-editor-empty::before]:h-0 [&_p.is-editor-empty::before]:pointer-events-none [&_p.is-editor-empty::before]:content-[attr(data-placeholder)]',
      size === 'lg' ? 'prose-base text-foreground text-lg' : 'text-sm',
      className
    ),
    'aria-label': ariaLabel,
    role: 'textbox',
  };
}
