import { cn } from '@repo/ui/lib/utils';
import {
  CODE_SYNTAX_HIGHLIGHT_CLASSES,
  EDITOR_CODE_BLOCK_CHROME_CLASSES,
} from '@/app/work-items/_helpers/work-item-description-code-styles';

// Centralized generation function to manage high contrast options and scaling properties cleanly
const getEditorStyles = function (maximizedState: boolean): string {
  return cn(
    'max-w-none focus:outline-none outline-none p-4 transition-all duration-150',
    'text-foreground prose-strong:text-foreground prose-em:text-foreground prose-p:text-foreground prose-headings:text-foreground',
    'prose-ol:text-foreground prose-ul:text-foreground marker:text-foreground [&_ol]:list-decimal [&_ul]:list-disc',

    EDITOR_CODE_BLOCK_CHROME_CLASSES,
    CODE_SYNTAX_HIGHLIGHT_CLASSES,

    // THE FIXED LAYER CONFIGURATION FOR SIDEBAR VS FULL VIEW
    maximizedState
      ? 'prose-base text-base min-h-[calc(100vh-220px)] max-h-[calc(100vh-220px)] overflow-y-auto scrollbar-thin'
      : 'prose-sm text-sm min-h-[160px] max-h-[320px] overflow-y-auto scrollbar-thin'
  );
};

export default getEditorStyles;
