'use client';

import { Suspense } from 'react';
import { GitHubLogo } from '@/app/projects/_components/project-details/integration-brand-logos';
import { OAuthCompletionView } from '@/app/integrations/_components/oauth-completion-view';
import { IntegrationOAuthProvider } from '@/app/integrations/_types/oauth-completion.types';

/**
 * Landing for the GitHub OAuth popup after user consent.
 * Displays "Connected Successfully" and notifies the parent window.
 */
export default function GithubOAuthDonePage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">
            Processing GitHub connection...
          </p>
        </main>
      }
    >
      <OAuthCompletionView
        provider={IntegrationOAuthProvider.GitHub}
        providerName="GitHub"
        logo={<GitHubLogo className="size-8" />}
        searchParamKey="github"
      />
    </Suspense>
  );
}
