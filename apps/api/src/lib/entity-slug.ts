import { allocateUniqueSlug, slugifyTitle } from '@repo/types';
import { prisma } from './prisma';

/** Allocate a sprint slug unique within the project. */
export async function allocateSprintSlug(
  projectId: string,
  name: string,
  excludeSprintId?: string
): Promise<string> {
  const preferred = slugifyTitle(name);
  const existing = await prisma.sprints.findMany({
    where: {
      project_id: projectId,
      slug: { startsWith: preferred },
      ...(excludeSprintId ? { id: { not: excludeSprintId } } : {}),
    },
    select: { slug: true },
  });
  return allocateUniqueSlug(
    preferred,
    new Set(existing.map((row) => row.slug))
  );
}

/** Allocate a work-item slug unique within the project. */
export async function allocateWorkItemSlug(
  projectId: string,
  title: string,
  excludeWorkItemId?: string
): Promise<string> {
  const preferred = slugifyTitle(title);
  const existing = await prisma.work_items.findMany({
    where: {
      project_id: projectId,
      slug: { startsWith: preferred },
      ...(excludeWorkItemId ? { id: { not: excludeWorkItemId } } : {}),
    },
    select: { slug: true },
  });
  return allocateUniqueSlug(
    preferred,
    new Set(existing.map((row) => row.slug))
  );
}
