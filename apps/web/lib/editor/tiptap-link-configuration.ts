import Link from '@tiptap/extension-link';
import { Plugin } from '@tiptap/pm/state';

export function normalizeLinkHref(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) {
    return '';
  }

  if (
    /^https?:\/\//i.test(trimmed) ||
    trimmed.startsWith('mailto:') ||
    trimmed.startsWith('tel:') ||
    trimmed.startsWith('/')
  ) {
    return trimmed;
  }

  return `https://${trimmed}`;
}

export const CustomLinkExtension = Link.configure({
  openOnClick: false,
  autolink: true,
  linkOnPaste: true,
  defaultProtocol: 'https',
  HTMLAttributes: {
    class:
      'text-primary underline cursor-pointer hover:text-primary/80 transition-colors',
  },
}).extend({
  addProseMirrorPlugins() {
    const parentPlugins = this.parent?.() || [];

    const clickInterceptorPlugin = new Plugin({
      props: {
        handleClick(_view, _pos, event: MouseEvent) {
          const target = event.target as HTMLElement;
          const anchor = target.closest('a');

          if (anchor) {
            const href = anchor.getAttribute('href');
            const isMetaKey = event.metaKey || event.ctrlKey;

            if (isMetaKey && href) {
              window.open(href, '_blank', 'noopener,noreferrer');
              event.preventDefault();
              return true;
            }
            event.preventDefault();
            return false;
          }
          return false;
        },
      },
    });

    return [...parentPlugins, clickInterceptorPlugin];
  },
});
