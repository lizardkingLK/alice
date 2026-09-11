'use client';

import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

type TruncatedTextProps = Omit<
  React.ComponentPropsWithoutRef<'p'>,
  'children' | 'title'
> & {
  /** Full text shown in the element and used for the native title when truncated. */
  children: string;
  /**
   * Render as `span` when nested inside links/buttons (valid HTML).
   * Defaults to `p` for standalone truncated labels.
   */
  as?: 'p' | 'span';
};

/**
 * Single-line truncated text. Sets the native `title` attribute only when the
 * content overflows its container, so short labels stay tooltip-free.
 */
function TruncatedText({
  children,
  className,
  as = 'p',
  ...props
}: TruncatedTextProps) {
  const ref = React.useRef<HTMLElement>(null);
  const [isTruncated, setIsTruncated] = React.useState(false);

  React.useLayoutEffect(() => {
    const element = ref.current;
    if (!element) {
      return;
    }

    const updateTruncation = () => {
      setIsTruncated(element.scrollWidth > element.clientWidth);
    };

    updateTruncation();

    const observer = new ResizeObserver(updateTruncation);
    observer.observe(element);

    return () => {
      observer.disconnect();
    };
  }, [children]);

  const sharedProps = {
    className: cn('truncate', className),
    title: isTruncated ? children : undefined,
    children,
    ...props,
  };

  if (as === 'span') {
    return (
      <span ref={ref as React.RefObject<HTMLSpanElement>} {...sharedProps} />
    );
  }

  return (
    <p ref={ref as React.RefObject<HTMLParagraphElement>} {...sharedProps} />
  );
}

export { TruncatedText };
