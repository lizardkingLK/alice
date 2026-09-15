import { notFound, redirect } from 'next/navigation';
import { ChartsWorkspacePageShell } from '@/app/charts/_components/charts-workspace-page-shell';
import { getDbUser } from '@/lib/auth';
import type { RawSearchParams } from '@/lib/search-params';

type ChartsWorkspacePageProps = {
  readonly params: Promise<{ id: string }>;
  readonly searchParams: Promise<RawSearchParams>;
};

export default async function ChartsWorkspacePage({
  params,
  searchParams,
}: Readonly<ChartsWorkspacePageProps>) {
  const dbUser = await getDbUser();
  if (!dbUser) {
    redirect('/login');
  }

  const { id } = await params;
  if (!id) {
    notFound();
  }

  return (
    <ChartsWorkspacePageShell
      searchParams={searchParams}
      workspaceId={id}
      currentUserId={dbUser.id}
    />
  );
}
