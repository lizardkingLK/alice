'use client';

import parse, {
  HTMLReactParserOptions,
  Element,
  Text,
  DOMNode,
  domToReact,
  attributesToProps,
} from 'html-react-parser';
import type { JSX, MouseEvent } from 'react';
import type { Json } from '@repo/types';
import { LinkPreview } from '@repo/ui/components/ui/link-preview';
import { cn } from '@repo/ui/lib/utils';
import { descriptionToHtml } from '@/app/work-items/_helpers/work-item-description';

type CustomElementHandler = (
  // eslint-disable-next-line no-unused-vars
  element: Element,
  // eslint-disable-next-line no-unused-vars
  options: HTMLReactParserOptions
) => JSX.Element | undefined;

function getTextContent(element: Element): string {
  const firstChild = element.children[0];
  if (firstChild instanceof Text) {
    return firstChild.data;
  }

  return element.attribs.href ?? '';
}

const renderAnchor: CustomElementHandler = (element, options) => {
  if (element.name !== 'a') {
    return undefined;
  }

  const url = element.attribs.href?.trim() || '';
  const children = element.children.length
    ? domToReact(element.children as DOMNode[], options)
    : getTextContent(element);

  if (!url || url === '#') {
    return <span className="font-medium">{children}</span>;
  }

  const handleNavigation = (event: MouseEvent<HTMLAnchorElement>): void => {
    if (!event.metaKey && !event.ctrlKey) {
      event.preventDefault();
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  return (
    <LinkPreview url={url}>
      <a
        href={url}
        className="text-primary hover:text-primary/80 underline transition-colors"
        rel="noopener noreferrer"
        target="_blank"
        onClick={handleNavigation}
      >
        {children}
      </a>
    </LinkPreview>
  );
};

const renderCodeBlock: CustomElementHandler = (element, options) => {
  if (element.name !== 'pre') {
    return undefined;
  }

  const props = attributesToProps(element.attribs);
  const children = domToReact(element.children as DOMNode[], options);

  return (
    <pre
      {...props}
      className={cn(
        'bg-muted border-border overflow-x-auto rounded-lg border p-3 font-mono text-xs leading-relaxed',
        props.className
      )}
    >
      {children}
    </pre>
  );
};

const renderInlineCode: CustomElementHandler = (element, options) => {
  if (element.name !== 'code') {
    return undefined;
  }

  // Code inside a <pre> is handled by the pre renderer; leave nested code alone
  // when the parent pass already wrapped it. For inline code, style it.
  const parent = element.parent;
  if (parent instanceof Element && parent.name === 'pre') {
    return undefined;
  }

  const children = domToReact(element.children as DOMNode[], options);

  return (
    <code className="bg-muted rounded px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  );
};

const renderList: CustomElementHandler = (element, options) => {
  if (element.name !== 'ul' && element.name !== 'ol') {
    return undefined;
  }

  const Tag = element.name;
  const children = domToReact(element.children as DOMNode[], options);

  return (
    <Tag
      className={cn(
        'my-2 ml-5 space-y-1',
        Tag === 'ul' ? 'list-disc' : 'list-decimal'
      )}
    >
      {children}
    </Tag>
  );
};

const renderListItem: CustomElementHandler = (element, options) => {
  if (element.name !== 'li') {
    return undefined;
  }

  const children = domToReact(element.children as DOMNode[], options);

  return <li className="leading-relaxed">{children}</li>;
};

const HEADING_CLASS: Record<'h1' | 'h2' | 'h3', string> = {
  h1: 'mt-3 mb-2 text-xl font-semibold tracking-tight',
  h2: 'mt-3 mb-2 text-lg font-semibold tracking-tight',
  h3: 'mt-2 mb-1.5 text-base font-semibold tracking-tight',
};

const renderHeading: CustomElementHandler = (element, options) => {
  if (element.name !== 'h1' && element.name !== 'h2' && element.name !== 'h3') {
    return undefined;
  }

  const Tag = element.name;
  const children = domToReact(element.children as DOMNode[], options);

  return <Tag className={HEADING_CLASS[Tag]}>{children}</Tag>;
};

const COMPONENT_MAP: Record<string, CustomElementHandler> = {
  a: renderAnchor,
  pre: renderCodeBlock,
  code: renderInlineCode,
  ul: renderList,
  ol: renderList,
  li: renderListItem,
  h1: renderHeading,
  h2: renderHeading,
  h3: renderHeading,
};

const customNodeParserGateway = (
  domNode: DOMNode,
  options: HTMLReactParserOptions
): JSX.Element | undefined => {
  if (!(domNode instanceof Element)) {
    return undefined;
  }

  const renderComponent = COMPONENT_MAP[domNode.name];
  if (!renderComponent) {
    return undefined;
  }

  return renderComponent(domNode, options);
};

type DescriptionViewProps = {
  readonly htmlContent?: string;
  readonly description?: Json | null;
  readonly className?: string;
};

export function DescriptionView({
  htmlContent,
  description,
  className,
}: Readonly<DescriptionViewProps>) {
  const resolvedHtml = htmlContent ?? descriptionToHtml(description ?? null);

  const options: HTMLReactParserOptions = {
    replace: (domNode) => customNodeParserGateway(domNode, options),
  };

  return (
    <div
      className={cn(
        'prose prose-sm max-w-none text-sm leading-relaxed',
        'text-foreground prose-strong:text-foreground prose-em:text-foreground',
        'prose-headings:text-foreground prose-p:text-foreground',
        'prose-ol:text-foreground prose-ul:text-foreground marker:text-foreground',
        '[&_p]:my-2 [&_p:first-child]:mt-0 [&_p:last-child]:mb-0',
        '[&_strong]:text-foreground [&_strong]:font-semibold',
        className
      )}
    >
      {parse(resolvedHtml, options)}
    </div>
  );
}
