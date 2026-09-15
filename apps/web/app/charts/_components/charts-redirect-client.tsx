'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import {
  ensureDefaultChartWorkspace,
  readChartWorkspacesStore,
} from '@/app/charts/_helpers/charts-workspace-storage';

type ChartsRedirectClientProps = {
  readonly userId: string;
};

/** Client redirect so we can read last-opened id from localStorage. */
export function ChartsRedirectClient({
  userId,
}: Readonly<ChartsRedirectClientProps>) {
  const router = useRouter();

  useEffect(() => {
    const store = readChartWorkspacesStore(userId);
    const workspace =
      store.workspaces.find((item) => item.id === store.lastOpenedId) ??
      ensureDefaultChartWorkspace(userId);
    router.replace(`/charts/${workspace.id}`);
  }, [router, userId]);

  return (
    <div
      className="bg-muted/30 flex min-h-64 flex-1 animate-pulse rounded-xl"
      aria-busy="true"
      aria-label="Opening chart workspace"
    />
  );
}
