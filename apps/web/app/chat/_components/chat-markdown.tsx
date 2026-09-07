'use client';

import React from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@repo/ui/lib/utils';

interface ChatMarkdownProps {
  readonly content: string;
  readonly className?: string;
}

const chatMarkdownComponents: Components = {
  table({ children, ...props }) {
    return (
      <div className="my-3 w-full overflow-x-auto rounded-lg border border-border/70 bg-background/50 shadow-xs">
        <table className="w-full border-collapse text-left text-xs" {...props}>
          {children}
        </table>
      </div>
    );
  },
  thead({ children, ...props }) {
    return (
      <thead
        className="bg-muted/70 text-muted-foreground border-b border-border/70 text-[11px] font-semibold uppercase tracking-wider"
        {...props}
      >
        {children}
      </thead>
    );
  },
  th({ children, ...props }) {
    return (
      <th
        className="px-3 py-2 font-semibold text-foreground whitespace-nowrap"
        {...props}
      >
        {children}
      </th>
    );
  },
  td({ children, ...props }) {
    return (
      <td
        className="border-border/40 border-t px-3 py-2 text-xs leading-relaxed"
        {...props}
      >
        {children}
      </td>
    );
  },
  h1({ children, ...props }) {
    return (
      <h2
        className="text-foreground mt-4 mb-2 text-base font-bold first:mt-0"
        {...props}
      >
        {children}
      </h2>
    );
  },
  h2({ children, ...props }) {
    return (
      <h3
        className="text-foreground mt-3 mb-1.5 text-sm font-semibold first:mt-0"
        {...props}
      >
        {children}
      </h3>
    );
  },
  h3({ children, ...props }) {
    return (
      <h4
        className="text-foreground mt-2.5 mb-1 text-xs font-semibold first:mt-0"
        {...props}
      >
        {children}
      </h4>
    );
  },
  ul({ children, ...props }) {
    return (
      <ul
        className="my-2 ml-4 list-disc space-y-1 text-xs sm:text-sm"
        {...props}
      >
        {children}
      </ul>
    );
  },
  ol({ children, ...props }) {
    return (
      <ol
        className="my-2 ml-4 list-decimal space-y-1 text-xs sm:text-sm"
        {...props}
      >
        {children}
      </ol>
    );
  },
  li({ children, ...props }) {
    return (
      <li className="leading-relaxed" {...props}>
        {children}
      </li>
    );
  },
  blockquote({ children, ...props }) {
    return (
      <blockquote
        className="border-primary/50 text-muted-foreground my-2.5 border-l-2 pl-3 italic text-xs leading-relaxed"
        {...props}
      >
        {children}
      </blockquote>
    );
  },
  pre({ children, ...props }) {
    return (
      <pre
        className="bg-muted/60 border-border/50 my-2.5 overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed"
        {...props}
      >
        {children}
      </pre>
    );
  },
  code({ className, children, ...props }) {
    const isBlock = Boolean(className);
    if (isBlock) {
      return (
        <code
          className={cn(className, 'text-foreground font-mono text-xs')}
          {...props}
        >
          {children}
        </code>
      );
    }
    return (
      <code
        className="bg-muted text-foreground border-border/50 rounded border px-1 py-0.5 font-mono text-[0.85em]"
        {...props}
      >
        {children}
      </code>
    );
  },
  a({ href, children, ...props }) {
    return (
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        className="text-primary hover:underline font-medium break-all"
        {...props}
      >
        {children}
      </a>
    );
  },
  p({ children, ...props }) {
    return (
      <p className="my-1.5 leading-relaxed first:mt-0 last:mb-0" {...props}>
        {children}
      </p>
    );
  },
};

export function ChatMarkdown({
  content,
  className,
}: Readonly<ChatMarkdownProps>) {
  return (
    <div className={cn('text-foreground text-sm leading-relaxed', className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={chatMarkdownComponents}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
