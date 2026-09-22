'use client';

import { useEffect, useRef, useState } from 'react';

type UseInViewOptions = {
  readonly rootMargin?: string;
  readonly threshold?: number | number[];
  /** When true, stays visible after the first intersection. */
  readonly once?: boolean;
};

/** Observe an element; sets `inView` when it enters the viewport. */
export function useInView<T extends Element = HTMLElement>({
  rootMargin = '0px 0px -12% 0px',
  threshold = 0.35,
  once = true,
}: UseInViewOptions = {}) {
  const ref = useRef<T | null>(null);
  const [inView, setInView] = useState(false);

  useEffect(() => {
    const node = ref.current;
    if (!node || typeof IntersectionObserver === 'undefined') {
      setInView(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) {
          if (!once) {
            setInView(false);
          }
          return;
        }
        setInView(true);
        if (once) {
          observer.disconnect();
        }
      },
      { rootMargin, threshold }
    );

    observer.observe(node);
    return () => observer.disconnect();
  }, [once, rootMargin, threshold]);

  return { ref, inView };
}
