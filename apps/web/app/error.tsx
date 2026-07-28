'use client';

import { ErrorPageContent } from '@/lib/errors/error-page-content';

export default function RootErrorPage({
  error,
  reset,
}: Readonly<{
  error: Error & { digest?: string };
  reset: () => void;
}>) {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-6">
      <ErrorPageContent
        error={error}
        reset={reset}
        secondaryHref="/"
        secondaryLabel="Home"
        compactGenericDescription
      />
    </main>
  );
}
