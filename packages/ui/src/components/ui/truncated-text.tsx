'use client';

import * as React from 'react';

import { cn } from '@repo/ui/lib/utils';

type TruncatedTextProps = Omit<
  React.ComponentProps<'p'>,
  'children' | 'title'
> & {
  /** Full text shown in the element and used for the native title when truncated. */
  children: string;
};

/**
 * Single-line truncated text. Sets the native `title` attribute only when the
 * content overflows its container, so short labels stay tooltip-free.
 */
function TruncatedText({ children, className, ...props }: TruncatedTextProps) {
  const ref = React.useRef<HTMLParagraphElement>(null);
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

  return (
    <p
      ref={ref}
      className={cn('truncate', className)}
      title={isTruncated ? children : undefined}
      {...props}
    >
      {children}
    </p>
  );
}

export { TruncatedText };
