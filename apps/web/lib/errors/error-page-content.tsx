'use client';

import Link from 'next/link';
import { Button } from '@repo/ui/components/ui/button';
import { AlertCircle, WifiOff } from '@repo/ui/lib/icons';
import { isBackendUnreachableError } from '@/lib/errors/backend-unreachable';

export const ERROR_PAGE_COPY = {
  backendTitle: 'Could not connect to the backend',
  backendDescription: 'The app could not reach the API. Try again in a moment.',
  genericTitle: 'Something went wrong',
  genericDescription: 'An unexpected error occurred while loading this page.',
  genericDescriptionShort: 'An unexpected error occurred.',
  tryAgain: 'Try again',
} as const;

type ErrorPageContentProps = {
  error: Error & { digest?: string };
  reset: () => void;
  /** Secondary navigation target (e.g. `/` or `/dashboard`). */
  secondaryHref: string;
  secondaryLabel: string;
  /** Use shorter generic description (root public error page). */
  compactGenericDescription?: boolean;
};

/**
 * Shared unreachable / generic error copy + actions for root and dashboard
 * error boundaries.
 */
export function ErrorPageContent({
  error,
  reset,
  secondaryHref,
  secondaryLabel,
  compactGenericDescription = false,
}: Readonly<ErrorPageContentProps>) {
  const backendUnreachable = isBackendUnreachableError(error);
  const genericDescription = compactGenericDescription
    ? ERROR_PAGE_COPY.genericDescriptionShort
    : ERROR_PAGE_COPY.genericDescription;

  return (
    <div className="flex w-full max-w-lg flex-col items-center gap-4 text-center">
      {backendUnreachable ? (
        <WifiOff className="text-muted-foreground size-10" aria-hidden />
      ) : (
        <AlertCircle className="text-muted-foreground size-10" aria-hidden />
      )}
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">
          {backendUnreachable
            ? ERROR_PAGE_COPY.backendTitle
            : ERROR_PAGE_COPY.genericTitle}
        </h1>
        <p className="text-muted-foreground text-sm">
          {backendUnreachable
            ? ERROR_PAGE_COPY.backendDescription
            : genericDescription}
        </p>
      </div>
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button type="button" onClick={reset}>
          {ERROR_PAGE_COPY.tryAgain}
        </Button>
        <Button asChild variant="outline">
          <Link href={secondaryHref}>{secondaryLabel}</Link>
        </Button>
      </div>
    </div>
  );
}
