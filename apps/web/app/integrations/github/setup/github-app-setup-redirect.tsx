'use client';

import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@repo/ui/components/ui/button';
import { Loader2 } from '@repo/ui/lib/icons';
import { GitHubLogo } from '@/app/projects/_components/project-details/integration-brand-logos';
import {
  buildGithubAppCallbackUrl,
  resolvePublicApiBaseUrl,
} from '../_lib/github-app-setup';

/**
 * GitHub App Setup URL landing. Forwards install query params to the API
 * callback, which upserts the connection and redirects to the done page.
 */
export function GithubAppSetupRedirect() {
  const searchParams = useSearchParams();
  const [error, setError] = useState<string | null>(null);

  const callbackUrl = useMemo(() => {
    const apiBase = resolvePublicApiBaseUrl();
    if (!apiBase) {
      return null;
    }
    return buildGithubAppCallbackUrl(searchParams, apiBase);
  }, [searchParams]);

  useEffect(() => {
    if (!callbackUrl) {
      setError(
        'API URL is not configured. Set NEXT_PUBLIC_API_URL and try connecting again from Alice.'
      );
      return;
    }

    const installationId = searchParams.get('installation_id');
    const state = searchParams.get('state');
    if (!installationId || !state) {
      setError(
        'Missing install details from GitHub. Close this window and try Connect GitHub again.'
      );
      return;
    }

    window.location.replace(callbackUrl);
  }, [callbackUrl, searchParams]);

  if (error) {
    return (
      <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 p-6">
        <div className="border-border bg-card flex w-full max-w-md flex-col items-center gap-4 rounded-xl border p-8 text-center shadow-lg">
          <div className="bg-muted/40 flex size-14 items-center justify-center rounded-2xl border p-3">
            <GitHubLogo className="size-8" />
          </div>
          <h1 className="text-xl font-bold tracking-tight">
            Could not finish install
          </h1>
          <p className="text-muted-foreground text-sm">{error}</p>
          <Button
            type="button"
            variant="outline"
            className="w-full"
            onClick={() => window.close()}
          >
            Close Window
          </Button>
        </div>
      </main>
    );
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
      <div className="text-muted-foreground flex items-center gap-2 text-sm">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finishing GitHub App install...
      </div>
    </main>
  );
}
