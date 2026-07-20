import { cn } from '@repo/ui/lib/utils';

/** High-contrast hljs token colors shared by editor and read-only description view. */
export const CODE_SYNTAX_HIGHLIGHT_CLASSES = cn(
  '[&_.hljs-comment]:!text-zinc-500 [&_.hljs-quote]:!text-zinc-500',
  '[&_.hljs-keyword]:!text-sky-400 [&_.hljs-selector-tag]:!text-sky-400 [&_.hljs-subst]:!text-sky-400',
  '[&_.hljs-string]:!text-lime-400 [&_.hljs-meta_.hljs-string]:!text-lime-400 [&_.hljs-regexp]:!text-lime-400',
  '[&_.hljs-number]:!text-amber-400 [&_.hljs-literal]:!text-amber-400 [&_.hljs-symbol]:!text-amber-400 [&_.hljs-bullet]:!text-amber-400',
  '[&_.hljs-title]:!text-pink-400 [&_.hljs-title.class_]:!text-pink-400 [&_.hljs-class_.hljs-title]:!text-pink-400',
  '[&_.hljs-name]:!text-rose-400 [&_.hljs-tag]:!text-zinc-300',
  '[&_.hljs-attr]:!text-orange-400 [&_.hljs-attribute]:!text-orange-400',
  '[&_.hljs-variable]:!text-zinc-100 [&_.hljs-template-variable]:!text-zinc-100',
  '[&_.hljs-built_in]:!text-cyan-400 [&_.hljs-type]:!text-cyan-400',
  '[&_.hljs-params]:!text-zinc-100 [&_.hljs-title.function_]:!text-pink-400',
  // Fallback for any unhandled lowlight tokens
  '[&_pre_*]:!text-zinc-100'
);

/** Dark code-block chrome (background, border, inline code) for TipTap editor content. */
export const EDITOR_CODE_BLOCK_CHROME_CLASSES = cn(
  'prose-pre:!bg-zinc-950 prose-pre:border prose-pre:border-border/80 prose-pre:p-4 prose-pre:rounded-md',
  '[&_code]:font-mono [&_code]:!text-zinc-100 [&_code]:bg-zinc-900 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:rounded',
  '[&_pre_code]:bg-transparent [&_pre_code]:p-0 [&_pre_code]:!text-zinc-100',
  'prose-pre:relative prose-pre:pt-10 prose-pre:bg-zinc-950 prose-pre:border prose-pre:border-border/80 prose-pre:p-4 prose-pre:rounded-md',
  'prose-pre:before:content-[attr(data-language)] prose-pre:before:absolute prose-pre:before:top-2.5 prose-pre:before:right-3',
  'prose-pre:before:text-[10px] prose-pre:before:font-mono prose-pre:before:font-bold prose-pre:before:uppercase prose-pre:before:tracking-widest',
  'prose-pre:before:text-zinc-300 prose-pre:before:bg-zinc-900 prose-pre:before:px-2 prose-pre:before:py-0.5 prose-pre:before:rounded prose-pre:before:border prose-pre:before:border-border/60 prose-pre:before:shadow-sm',
  '[&_pre[data-language="auto"]]:before:!hidden [&_pre[data-language="plaintext"]]:before:!hidden [&_pre:not([data-language])]:before:!hidden'
);
