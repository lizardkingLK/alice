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
      'max-w-none min-h-16 px-3 py-2 outline-none',
      'prose-p:my-1',
      COMPACT_EDITOR_LIST_CLASSES,
      size === 'lg' ? 'prose-base text-foreground text-lg' : 'text-sm',
      className
    ),
    'aria-label': ariaLabel,
    role: 'textbox',
  };
}
