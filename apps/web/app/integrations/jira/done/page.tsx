'use client';

import { Suspense } from 'react';
import { JiraLogo } from '@/app/projects/_components/project-details/integration-brand-logos';
import { OAuthCompletionView } from '@/app/integrations/_components/oauth-completion-view';
import { IntegrationOAuthProvider } from '@/app/integrations/_types/oauth-completion.types';

/**
 * Landing for the Jira OAuth popup after Atlassian consent.
 * Displays "Connected Successfully" and notifies the parent window.
 */
export default function JiraOAuthDonePage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">
            Processing Jira connection...
          </p>
        </main>
      }
    >
      <OAuthCompletionView
        provider={IntegrationOAuthProvider.Jira}
        providerName="Jira"
        logo={<JiraLogo className="size-8" />}
        searchParamKey="jira"
      />
    </Suspense>
  );
}
