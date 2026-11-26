import { Suspense } from 'react';
import type { Metadata } from 'next';
import { GithubAppSetupRedirect } from './github-app-setup-redirect';

export const metadata: Metadata = {
  title: 'GitHub App setup',
  robots: { index: false, follow: false },
};

/**
 * GitHub App **Setup URL** target after install/update.
 * Forwards to the API callback, then the done page.
 */
export default function GithubAppSetupPage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">
            Finishing GitHub App install...
          </p>
        </main>
      }
    >
      <GithubAppSetupRedirect />
    </Suspense>
  );
}
