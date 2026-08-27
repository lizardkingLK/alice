'use client';

import { useEffect, useState } from 'react';
import { Button } from '@repo/ui/components/ui/button';
import { JiraLogo } from '@/app/projects/[id]/_components/integration-brand-logos';

type DoneStatus = 'connected' | 'denied' | 'error';

function resolveStatus(raw: string | null): DoneStatus {
  if (raw === 'denied') {
    return 'denied';
  }
  if (raw === 'error') {
    return 'error';
  }
  return 'connected';
}

/**
 * Landing for the Jira OAuth tab after Atlassian consent.
 * Keeps the original create-project modal intact in the opener tab.
 */
export default function JiraOAuthDonePage() {
  const [status, setStatus] = useState<DoneStatus>('connected');
  const [detail, setDetail] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setStatus(resolveStatus(params.get('jira')));
    setDetail(params.get('error'));

    // Best-effort close when the browser allows it (tab opened via window.open).
    const timer = window.setTimeout(() => {
      window.close();
    }, 400);
    return () => {
      window.clearTimeout(timer);
    };
  }, []);

  let title = 'Jira connected';
  let body =
    'You can close this tab and return to Alice. Your create/edit dialog should still be open.';
  if (status === 'denied') {
    title = 'Jira connection cancelled';
    body = 'Authorization was denied. Close this tab and try again from Alice.';
  } else if (status === 'error') {
    title = 'Jira connection failed';
    body =
      detail ||
      'Something went wrong finishing OAuth. Close this tab and try again from Alice.';
  }

  return (
    <main className="bg-background text-foreground flex min-h-screen flex-col items-center justify-center gap-4 p-6">
      <div className="border-border bg-card flex w-full max-w-md flex-col items-center gap-3 rounded-xl border p-8 text-center shadow-sm">
        <JiraLogo className="size-8" />
        <h1 className="text-xl font-semibold tracking-tight">{title}</h1>
        <p className="text-muted-foreground text-sm">{body}</p>
        <Button type="button" onClick={() => window.close()}>
          Close tab
        </Button>
      </div>
    </main>
  );
}
