import { prisma } from '../../lib/prisma';
import { extractWorkItemCandidates } from './resolve-work-item-from-branch';

export async function resolveWorkItemIdForProject(
  projectId: string,
  projectKey: string,
  ...texts: Array<string | null | undefined>
): Promise<string | null> {
  const { slugs, ids } = extractWorkItemCandidates(projectKey, ...texts);

  if (ids.length > 0) {
    const byId = await prisma.work_items.findFirst({
      where: {
        project_id: projectId,
        record_status: 'active',
        id: { in: ids },
      },
      select: { id: true },
    });
    if (byId) {
      return byId.id;
    }
  }

  if (slugs.length === 0) {
    return null;
  }

  const bySlug = await prisma.work_items.findFirst({
    where: {
      project_id: projectId,
      record_status: 'active',
      slug: { in: slugs, mode: 'insensitive' },
    },
    select: { id: true },
  });

  return bySlug?.id ?? null;
}
