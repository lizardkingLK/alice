'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import ReactMarkdown, { type Components } from 'react-markdown';

function stripMarkdownLinks(message: string): string {
  let out = '';
  let i = 0;

  while (i < message.length) {
    if (message[i] === '[') {
      const labelEnd = message.indexOf(']', i + 1);
      const urlStart = labelEnd + 1;
      const urlEnd =
        labelEnd !== -1 && message[urlStart] === '('
          ? message.indexOf(')', urlStart + 1)
          : -1;
      if (labelEnd !== -1 && urlEnd !== -1) {
        out += message.slice(i + 1, labelEnd);
        i = urlEnd + 1;
        continue;
      }
    }

    out += message[i];
    i += 1;
  }

  return out;
}

function stripMarkdownEmphasis(message: string): string {
  let out = '';
  let i = 0;

  while (i < message.length) {
    if (message.startsWith('**', i)) {
      const close = message.indexOf('**', i + 2);
      if (close !== -1) {
        out += message.slice(i + 2, close);
        i = close + 2;
        continue;
      }
    }

    if (message[i] === '*') {
      const close = message.indexOf('*', i + 1);
      if (close !== -1) {
        out += message.slice(i + 1, close);
        i = close + 1;
        continue;
      }
    }

    out += message[i];
    i += 1;
  }

  return out;
}

/** Plain-text tooltip / aria label without markdown markers. */
export function stripNotificationMarkdown(message: string): string {
  return stripMarkdownEmphasis(stripMarkdownLinks(message));
}

type NotificationMessageProps = {
  readonly message: string;
  /** Mark read / close menu before in-app link navigation. */
  readonly onInternalLinkClick?: () => void;
};

function buildComponents(onInternalLinkClick?: () => void): Components {
  return {
    p({ children }) {
      return <span className="block whitespace-pre-wrap">{children}</span>;
    },
    strong({ children }) {
      return <strong className="font-semibold">{children}</strong>;
    },
    em({ children }) {
      return <em>{children}</em>;
    },
    a({ href, children }) {
      if (!href) {
        return <span>{children}</span>;
      }

      if (href.startsWith('/')) {
        return (
          <Link
            href={href}
            className="text-primary font-semibold hover:underline"
            onClick={(event) => {
              event.stopPropagation();
              onInternalLinkClick?.();
            }}
          >
            {children}
          </Link>
        );
      }

      return (
        <a
          href={href}
          target="_blank"
          rel="noopener noreferrer"
          className="text-primary font-semibold hover:underline"
          onClick={(event) => {
            event.stopPropagation();
          }}
        >
          {children}
        </a>
      );
    },
  };
}

/**
 * Renders inbox notification copy with a small Markdown subset
 * (`**bold**`, `[label](/path)` links). Matches project-create messages and
 * stays safe inside the row click target (internal links stop propagation).
 */
export function NotificationMessage({
  message,
  onInternalLinkClick,
}: NotificationMessageProps): ReactNode {
  return (
    <ReactMarkdown components={buildComponents(onInternalLinkClick)}>
      {message}
    </ReactMarkdown>
  );
}
