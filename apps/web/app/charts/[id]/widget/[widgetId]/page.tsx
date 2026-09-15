import { notFound, redirect } from 'next/navigation';
import { ChartsWorkspacePageShell } from '@/app/charts/_components/charts-workspace-page-shell';
import { getDbUser } from '@/lib/auth';
import type { RawSearchParams } from '@/lib/search-params';

type ChartsWidgetDeepLinkPageProps = {
  readonly params: Promise<{ id: string; widgetId: string }>;
  readonly searchParams: Promise<RawSearchParams>;
};

export default async function ChartsWidgetDeepLinkPage({
  params,
  searchParams,
}: Readonly<ChartsWidgetDeepLinkPageProps>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect('/login');
  }

  const { id, widgetId } = await params;
  if (!id || !widgetId) {
    notFound();
  }

  return (
    <ChartsWorkspacePageShell
      searchParams={searchParams}
      workspaceId={id}
      currentUserId={dbUser.id}
      focusWidgetId={widgetId}
    />
  );
}
