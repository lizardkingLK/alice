import { redirect } from 'next/navigation';
import {
  projectDetailHref,
  withProjectSearchParams,
} from '@/app/projects/_helpers/project-links';
import { resolveProjectPathParam } from '@/app/projects/_helpers/resolve-project-path';
import type { RawSearchParams } from '@/lib/search-params';

/**
 * List route kept for bookmarks / old links. Work Items stay inside the
 * project shell via `?tab=work-items` (nested detail slugs still use this tree).
 */
export default async function ProjectWorkItemsPage({
  params,
  searchParams,
}: Readonly<{
  params: Promise<{ id: string }>;
  searchParams: Promise<RawSearchParams>;
}>) {
  const { id: rawParam } = await params;
  const resolvedSearchParams = await searchParams;
  const { projectKey } = await resolveProjectPathParam({
    rawParam,
    area: 'work-items',
    searchParams: resolvedSearchParams,
  });

  const rest: RawSearchParams = { ...resolvedSearchParams };
  delete rest.tab;

  redirect(
    withProjectSearchParams(projectDetailHref(projectKey, 'work-items'), rest)
  );
}
