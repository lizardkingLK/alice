import { all, createLowlight } from 'lowlight';

import { escapeHtml } from '@/app/work-items/_helpers/escape-html';

const lowlight = createLowlight(all);

type HastText = {
  type: 'text';
  value: string;
};

type HastElement = {
  type: 'element';
  tagName: string;
  properties?: {
    className?: Array<string | number> | string | number | boolean | null;
  };
  children?: HastNode[];
};

type HastRoot = {
  type: 'root';
  children: HastNode[];
};

type HastNode = HastText | HastElement | HastRoot;

function classNameToString(
  className: HastElement['properties'] extends undefined
    ? never
    : NonNullable<HastElement['properties']>['className']
): string {
  if (className == null || typeof className === 'boolean') {
    return '';
  }

  if (typeof className === 'string' || typeof className === 'number') {
    return String(className);
  }

  return className.map(String).join(' ');
}

function hastToHtml(node: HastNode): string {
  if (node.type === 'text') {
    return escapeHtml(node.value);
  }

  if (node.type === 'root') {
    return node.children.map(hastToHtml).join('');
  }

  const className = classNameToString(node.properties?.className);
  const attrs = className ? ` class="${escapeHtml(className)}"` : '';
  const children = (node.children ?? []).map(hastToHtml).join('');

  return `<${node.tagName}${attrs}>${children}</${node.tagName}>`;
}

function canHighlight(language: string | undefined): language is string {
  return (
    typeof language === 'string' &&
    language.length > 0 &&
    language !== 'plaintext' &&
    language !== 'auto' &&
    lowlight.registered(language)
  );
}

/** Highlight source with lowlight (same engine as TipTap CodeBlockLowlight). */
export function highlightCodeBlockHtml(
  code: string,
  language?: string
): string {
  if (!code) {
    return '';
  }

  if (!canHighlight(language)) {
    return escapeHtml(code);
  }

  try {
    return hastToHtml(lowlight.highlight(language, code) as HastRoot);
  } catch {
    return escapeHtml(code);
  }
}

export function shouldShowLanguageBadge(language: string | undefined): boolean {
  return (
    typeof language === 'string' &&
    language.length > 0 &&
    language !== 'plaintext' &&
    language !== 'auto'
  );
}
