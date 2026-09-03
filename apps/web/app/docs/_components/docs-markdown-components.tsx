'use client';

import {
  Children,
  createContext,
  isValidElement,
  useContext,
  useMemo,
  type ComponentPropsWithoutRef,
  type ReactElement,
  type ReactNode,
} from 'react';
import Link from 'next/link';
import type { Components } from 'react-markdown';
import { DocsMermaid } from '@/app/docs/_components/docs-mermaid';
import { rewriteDocsMarkdownHref } from '@/lib/docs/docs-shared';

type DocsMarkdownLinkContextValue = {
  readonly slug: string;
  readonly path: string;
};

const DocsMarkdownLinkContext = createContext<DocsMarkdownLinkContextValue>({
  slug: '',
  path: '',
});

export function DocsMarkdownSlugProvider({
  slug,
  path,
  children,
}: {
  readonly slug: string;
  readonly path: string;
  readonly children: ReactNode;
}) {
  const value = useMemo(() => ({ slug, path }), [slug, path]);

  return (
    <DocsMarkdownLinkContext.Provider value={value}>
      {children}
    </DocsMarkdownLinkContext.Provider>
  );
}

function codeTextContent(children: ReactNode): string {
  return Children.toArray(children)
    .map((child) => (typeof child === 'string' ? child : ''))
    .join('');
}

function isMermaidCodeBlock(
  child: ReactNode
): child is ReactElement<{ className?: string; children?: ReactNode }> {
  if (!isValidElement(child)) {
    return false;
  }
  const className = (child.props as { className?: string }).className ?? '';
  return className.includes('language-mermaid');
}

function DocsMarkdownAnchor({
  href,
  children,
  ...props
}: Readonly<ComponentPropsWithoutRef<'a'>>) {
  const { slug, path } = useContext(DocsMarkdownLinkContext);
  const nextHref = rewriteDocsMarkdownHref(href ?? '', slug, path);
  const isInternal = nextHref.startsWith('/docs');

  if (isInternal) {
    return (
      <Link href={nextHref} {...props}>
        {children}
      </Link>
    );
  }

  return (
    <a
      href={nextHref}
      rel="noopener noreferrer"
      target={nextHref.startsWith('http') ? '_blank' : undefined}
      {...props}
    >
      {children}
    </a>
  );
}

function DocsMarkdownH1({ children }: { readonly children?: ReactNode }) {
  return (
    <h2 className="text-foreground text-2xl font-semibold tracking-tight">
      {children}
    </h2>
  );
}

function DocsMarkdownPre({ children }: { readonly children?: ReactNode }) {
  const codeChild = Children.toArray(children)[0];
  if (isMermaidCodeBlock(codeChild)) {
    return <DocsMermaid chart={codeTextContent(codeChild.props.children)} />;
  }
  return <pre>{children}</pre>;
}

function DocsMarkdownCode({
  className,
  children,
  ...props
}: Readonly<ComponentPropsWithoutRef<'code'>>) {
  const isBlock = Boolean(className);
  if (isBlock) {
    return (
      <code className={className} {...props}>
        {children}
      </code>
    );
  }
  return (
    <code
      className="bg-muted text-foreground rounded px-1 py-0.5 text-[0.85em]"
      {...props}
    >
      {children}
    </code>
  );
}

function DocsMarkdownTable({ children }: { readonly children?: ReactNode }) {
  return (
    <div className="my-4 overflow-x-auto">
      <table>{children}</table>
    </div>
  );
}

/** Stable react-markdown component map (module scope — Sonar S6478). */
export const docsMarkdownComponents: Components = {
  a: DocsMarkdownAnchor,
  h1: DocsMarkdownH1,
  pre: DocsMarkdownPre,
  code: DocsMarkdownCode,
  table: DocsMarkdownTable,
};
