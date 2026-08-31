import type { Json } from '@repo/types';
import { RecordStatus } from '@repo/types/prisma';
import type { ProjectsRepository } from '../routes/api/projects/projects.repository';
import { prismaAuditCreate, prismaAuditUpdate } from './prisma-audit';
import { prisma } from './prisma';

export function parseAllowlistProjectKeys(
  value: Json | readonly string[] | null | undefined
): string[] {
  if (!value) {
    return [];
  }
  if (!Array.isArray(value)) {
    return [];
  }
  const keys = value
    .map(String)
    .map((key) => key.trim())
    .filter(Boolean);
  return [...new Set(keys)];
}

function normalizeProjectKeys(keys: readonly string[]): string[] {
  return [
    ...new Set(keys.map((key) => key.trim().toUpperCase()).filter(Boolean)),
  ];
}

async function resolveProjectIdsByKeys(
  keys: readonly string[]
): Promise<Map<string, string>> {
  const normalized = normalizeProjectKeys(keys);
  if (normalized.length === 0) {
    return new Map();
  }

  const rows = await prisma.projects.findMany({
    where: {
      OR: normalized.map((key) => ({
        key: { equals: key, mode: 'insensitive' as const },
      })),
    },
    select: { id: true, key: true },
  });

  return new Map(rows.map((row) => [row.key.toUpperCase(), row.id]));
}

async function findUserIdByEmail(email: string): Promise<string | null> {
  const user = await prisma.users.findFirst({
    where: { email: email.trim().toLowerCase() },
    select: { id: true },
  });
  return user?.id ?? null;
}

async function ensureActiveProjectMember(
  actorId: string,
  projectId: string,
  userId: string
): Promise<void> {
  const existing = await prisma.project_members.findUnique({
    where: {
      project_id_user_id: { project_id: projectId, user_id: userId },
    },
    select: { status: true },
  });

  if (!existing) {
    await prisma.project_members.create({
      data: {
        project_id: projectId,
        user_id: userId,
        ...prismaAuditCreate(actorId),
      },
    });
    return;
  }

  if (existing.status !== RecordStatus.active) {
    await prisma.project_members.update({
      where: {
        project_id_user_id: { project_id: projectId, user_id: userId },
      },
      data: {
        status: RecordStatus.active,
        ...prismaAuditUpdate(actorId),
      },
    });
  }
}

/**
 * Keeps `project_members` in sync with an email allowlist row's project keys.
 * Idempotent on create/update; removes memberships for unchecked keys.
 */
export async function syncAllowlistProjectMembers(params: {
  readonly actorId: string;
  readonly email: string;
  readonly previousKeys: readonly string[];
  readonly nextKeys: readonly string[];
  readonly entryActive: boolean;
  readonly projectsRepository: ProjectsRepository;
}): Promise<void> {
  const userId = await findUserIdByEmail(params.email);
  if (!userId) {
    return;
  }

  const previous = normalizeProjectKeys(params.previousKeys);
  const next = params.entryActive ? normalizeProjectKeys(params.nextKeys) : [];
  const keysToEnsure = next;
  const keysToRemove = previous.filter((key) => !next.includes(key));
  const keysToResolve = [...new Set([...keysToEnsure, ...keysToRemove])];
  const projectIdByKey = await resolveProjectIdsByKeys(keysToResolve);

  for (const key of keysToEnsure) {
    const projectId = projectIdByKey.get(key);
    if (!projectId) {
      continue;
    }
    await ensureActiveProjectMember(params.actorId, projectId, userId);
  }

  for (const key of keysToRemove) {
    const projectId = projectIdByKey.get(key);
    if (!projectId) {
      continue;
    }
    try {
      await params.projectsRepository.removeMember(projectId, userId);
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        'error. allowlist project member sync removal failed:',
        message
      );
    }
  }
}
