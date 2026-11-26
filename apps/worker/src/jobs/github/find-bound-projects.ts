import { prisma } from '../../lib/prisma';

export type BoundGithubProject = {
  id: string;
  key: string;
  repo: string;
};

function readRepoFromVcExternal(value: unknown): string | null {
  if (!value || typeof value !== 'object') {
    return null;
  }
  const repo = (value as { repo?: unknown }).repo;
  return typeof repo === 'string' && repo.includes('/') ? repo : null;
}

/**
 * Alice projects bound to a GitHub App installation whose `vc_external.repo`
 * matches `owner/repo` (case-insensitive).
 */
export async function findProjectsBoundToGithubRepo(input: {
  installationId: number;
  repoOwner: string;
  repoName: string;
}): Promise<BoundGithubProject[]> {
  const connections = await prisma.version_control_connections.findMany({
    where: {
      vendor: 'github',
      external_id: String(input.installationId),
      status: 'active',
    },
    select: { id: true },
  });

  if (connections.length === 0) {
    return [];
  }

  const projects = await prisma.projects.findMany({
    where: {
      deleted_at: null,
      vc_connection_id: { in: connections.map((row) => row.id) },
    },
    select: {
      id: true,
      key: true,
      vc_external: true,
    },
  });

  const expected = `${input.repoOwner}/${input.repoName}`.toLowerCase();

  return projects.flatMap((project) => {
    const repo = readRepoFromVcExternal(project.vc_external);
    if (repo?.toLowerCase() !== expected) {
      return [];
    }
    return [{ id: project.id, key: project.key, repo }];
  });
}
