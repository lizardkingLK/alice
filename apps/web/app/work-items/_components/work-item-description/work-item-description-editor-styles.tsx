import { cn } from '@repo/ui/lib/utils';
import {
  CODE_SYNTAX_HIGHLIGHT_CLASSES,
  EDITOR_CODE_BLOCK_CHROME_CLASSES,
} from '@/app/work-items/_helpers/work-item-description-code-styles';
import { EDITOR_LIST_CLASSES } from '@/lib/editor/editor-list-classes';

type EditorStyleOptions = {
  /** Taller embedded surface (e.g. agent instructions without maximize). */
  readonly tall?: boolean;
};

// Centralized generation function to manage high contrast options and scaling properties cleanly
const getEditorStyles = function (
  maximizedState: boolean,
  options?: EditorStyleOptions
): string {
  let sizeClasses =
    'prose-sm text-sm min-h-[160px] max-h-[320px] overflow-y-auto scrollbar-thin';
  if (maximizedState) {
    sizeClasses =
      'prose-base text-base min-h-[calc(100vh-220px)] max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin';
  } else if (options?.tall) {
    sizeClasses =
      'prose-sm text-sm min-h-[28rem] max-h-[min(70vh,48rem)] overflow-y-auto scrollbar-thin';
  }

  return cn(
    'max-w-none focus:outline-none outline-none p-4 transition-all duration-150',
    'text-foreground prose-strong:text-foreground prose-em:text-foreground prose-p:text-foreground prose-headings:text-foreground',
    'prose-ol:text-foreground prose-ul:text-foreground marker:text-foreground',
    EDITOR_LIST_CLASSES,

    EDITOR_CODE_BLOCK_CHROME_CLASSES,
    CODE_SYNTAX_HIGHLIGHT_CLASSES,
    sizeClasses
  );
};

export default getEditorStyles;
