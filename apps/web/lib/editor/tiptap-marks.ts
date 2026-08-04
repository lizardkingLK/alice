import { getAttrString, type TiptapAttrs } from '@repo/types';

export type TiptapMarkLike = {
  type?: string;
  attrs?: TiptapAttrs;
};

/* eslint-disable no-unused-vars -- callback signatures in generic handler map */
export type InlineMarkHandlers<T> = {
  bold: (inner: T) => T;
  italic: (inner: T) => T;
  underline: (inner: T) => T;
  code: (inner: T) => T;
  link: (inner: T, href: string) => T;
};
/* eslint-enable no-unused-vars */

/** Shared link href guard for TipTap link marks (safe schemes only). */
export function getMarkHref(
  attrs: TiptapAttrs | undefined
): string | undefined {
  const href = getAttrString(attrs, 'href')?.trim();
  if (!href || href === '#') {
    return undefined;
  }
  // Reject javascript:/data:/protocol-relative and other unsafe schemes.
  if (
    /^https?:\/\//i.test(href) ||
    href.startsWith('mailto:') ||
    href.startsWith('tel:') ||
    (href.startsWith('/') && !href.startsWith('//'))
  ) {
    return href;
  }
  return undefined;
}

/**
 * Apply one TipTap inline mark via string/React (or other) adapters.
 * Keeps bold/italic/underline/code/link handling in one switch.
 */
export function mapInlineMark<T>(
  mark: TiptapMarkLike,
  inner: T,
  handlers: InlineMarkHandlers<T>
): T {
  switch (mark.type) {
    case 'bold':
      return handlers.bold(inner);
    case 'italic':
      return handlers.italic(inner);
    case 'underline':
      return handlers.underline(inner);
    case 'code':
      return handlers.code(inner);
    case 'link': {
      const href = getMarkHref(mark.attrs);
      return href ? handlers.link(inner, href) : inner;
    }
    default:
      return inner;
  }
}

/**
 * Fold marks over content. Use `fromRight: true` for HTML wrapping
 * (first mark outermost); omit for React nesting (first mark innermost).
 */
export function foldMarks<T>(
  initial: T,
  marks: ReadonlyArray<TiptapMarkLike> | undefined,
  // eslint-disable-next-line no-unused-vars -- callback signature
  apply: (inner: T, mark: TiptapMarkLike) => T,
  fromRight = false
): T {
  if (!marks?.length) {
    return initial;
  }

  return fromRight
    ? marks.reduceRight((acc, mark) => apply(acc, mark), initial)
    : marks.reduce((acc, mark) => apply(acc, mark), initial);
}
