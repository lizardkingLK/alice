'use client';

import { Suspense } from 'react';
import { OAuthCompletionView } from '@/app/integrations/_components/oauth-completion-view';
import { IntegrationOAuthProvider } from '@/app/integrations/_types/oauth-completion.types';
import { FigmaLogo } from '@/app/projects/_components/project-details/integration-brand-logos';

export default function FigmaOAuthDonePage() {
  return (
    <Suspense
      fallback={
        <main className="bg-background text-foreground flex min-h-screen items-center justify-center p-6">
          <p className="text-muted-foreground text-sm">
            Processing Figma connection...
          </p>
        </main>
      }
    >
      <OAuthCompletionView
        provider={IntegrationOAuthProvider.Figma}
        providerName="Figma"
        logo={<FigmaLogo className="h-8 w-auto" />}
        searchParamKey="figma"
      />
    </Suspense>
  );
}
