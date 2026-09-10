'use client';

import { useId } from 'react';
import { cn } from '@repo/ui/lib/utils';

type BrandLogoProps = {
  readonly className?: string;
  readonly title?: string;
};

/** Official GitHub mark. Uses currentColor for light/dark contrast. */
export function GitHubLogo({
  className,
  title = 'GitHub',
}: Readonly<BrandLogoProps>) {
  return (
    <svg
      viewBox="0 0 98 96"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn('size-5 shrink-0', className)}
    >
      <title>{title}</title>
      <path
        fill="currentColor"
        fillRule="evenodd"
        clipRule="evenodd"
        d="M48.854 0C21.839 0 0 22 0 49.217c0 21.756 13.993 40.172 33.405 46.69 2.427.49 3.316-1.059 3.316-2.362 0-1.141-.08-5.052-.08-9.127-13.59 2.934-16.42-5.867-16.42-5.867-2.184-5.704-5.42-7.17-5.42-7.17-4.448-3.015.336-3.015.336-3.015 4.934.346 7.527 5.052 7.527 5.052 4.367 7.496 11.404 5.378 14.235 4.074.404-3.178 1.668-5.378 3.02-6.618-10.877-1.28-22.33-5.524-22.33-24.580 0-5.378 1.94-9.778 5.014-13.2-.485-1.222-2.184-6.275.486-13.038 0 0 4.125-1.304 13.426 5.052a46.97 46.97 0 0 1 12.214-1.63c4.125 0 8.33.571 12.213 1.63 9.302-6.356 13.427-5.052 13.427-5.052 2.67 6.763.97 11.816.485 13.038 3.155 3.422 5.015 7.822 5.015 13.2 0 19.104-11.495 23.25-22.45 24.534 1.78 1.548 3.316 4.481 3.316 9.126 0 6.618-.08 11.897-.08 13.526 0 1.304.89 2.853 3.316 2.364 19.412-6.52 33.405-24.935 33.405-46.691C97.707 22 75.788 0 48.854 0z"
      />
    </svg>
  );
}

/** Official Jira product mark (Simple Icons path + brand blues). */
export function JiraLogo({
  className,
  title = 'Jira',
}: Readonly<BrandLogoProps>) {
  const gradientId = useId().replaceAll(':', '');

  return (
    <svg
      viewBox="0 0 24 24"
      xmlns="http://www.w3.org/2000/svg"
      role="img"
      aria-label={title}
      className={cn('size-5 shrink-0', className)}
    >
      <title>{title}</title>
      <defs>
        <linearGradient
          id={gradientId}
          x1="98.114%"
          x2="58.419%"
          y1="0%"
          y2="39.507%"
        >
          <stop offset="0%" stopColor="#0052CC" />
          <stop offset="100%" stopColor="#2684FF" />
        </linearGradient>
      </defs>
      <path
        fill={`url(#${gradientId})`}
        d="M11.571 0C9.22 2.395 9.206 6.11 11.701 8.478l8.37 8.37A11.56 11.56 0 0 0 11.571 0zm.13 8.478C9.357 6.11 5.64 6.125 3.246 8.52L.003 11.763a11.56 11.56 0 0 0 15.907.003l-4.21-4.21zM3.246 15.48c2.395 2.394 6.11 2.38 8.474-.13l4.21 4.21A11.56 11.56 0 0 1 .003 11.763z"
      />
    </svg>
  );
}
