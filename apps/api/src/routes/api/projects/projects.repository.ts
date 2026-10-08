import {
  USER_PROJECTION_WITH_ROLE,
  userRelationSelect,
  withoutIntegrationSecrets,
  type Database,
  projectListSelect,
  projectDetailSelect,
  projectMemberSelect,
  type ProjectListRow,
  type ProjectDetailRow,
  type ProjectMemberRow,
  type WorkItemType,
  WorkItemTypeEnum,
  resolveProjectHierarchy,
  type ActorProjectsSummary,
} from '@repo/types';
import { Prisma, ProjectStatus, RecordStatus } from '@repo/types/prisma';
import { withBusyRetry } from '@repo/db';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestampRange,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { listAccessibleProjectIds } from '../../../lib/project-access';
import { insertSprint } from '../sprints/sprints.prisma';
import type {
  ProjectMemberWithUser,
  ProjectRow,
  ProjectRowWithOwner,
  ProjectUpdateInput,
  CreateProjectInput,
} from './projects.types';

export type {
  CreateProjectInput,
  ProjectMemberWithUser,
  ProjectRow,
  ProjectRowWithOwner,
  ProjectUpdateInput,
  UpdateProjectInput,
} from './projects.types';

export type ActiveProjectMember = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly role: string;
};

export { withoutIntegrationSecrets };

function applyOptionalProjectIntegrations(
  patch: Record<string, unknown>,
  data: ProjectUpdateInput
): void {
  if (data.jira_project_key !== undefined) {
    patch.jira_project_key = data.jira_project_key;
  }
  if (data.jira_connection_id !== undefined) {
    patch.jira_connection_id = data.jira_connection_id;
  }
  if (data.github_repo !== undefined) patch.github_repo = data.github_repo;
  if (data.github_token !== undefined) patch.github_token = data.github_token;
  if (data.logo_url !== undefined) patch.logo_url = data.logo_url;
  if (data.cover_picture !== undefined) {
    patch.cover_picture = data.cover_picture;
  }
}

function buildProjectUpdateData(data: ProjectUpdateInput, actorId: string) {
  const patch: Record<string, unknown> = {
    ...prismaAuditUpdate(actorId),
  };

  if (data.name !== undefined) patch.name = data.name;
  if (data.key !== undefined) patch.key = data.key;
  if (data.description !== undefined) patch.description = data.description;
  if (data.status !== undefined) patch.status = data.status;
  if (data.start_date !== undefined) {
    patch.start_date = prismaOptionalDate(data.start_date);
  }
  if (data.end_date !== undefined) {
    patch.end_date = prismaOptionalDate(data.end_date);
  }
  if (data.owner_id !== undefined) patch.owner_id = data.owner_id;
  if (data.deleted_at !== undefined) {
    patch.deleted_at = prismaOptionalDate(data.deleted_at);
  }
  if (data.attributes_config !== undefined) {
    patch.attributes_config = data.attributes_config;
  }
  if (data.workflow_config !== undefined) {
    patch.workflow_config =
      data.workflow_config === null
        ? Prisma.DbNull
        : (data.workflow_config as Prisma.InputJsonValue);
  }

  applyOptionalProjectIntegrations(patch, data);
  return patch;
}

const PROJECT_MEMBER_USER_SELECT = userRelationSelect(
  'user',
  'project_members_user_id_fkey',
  USER_PROJECTION_WITH_ROLE
);

function unsafeCast<T>(val: unknown): T {
  return val as T;
}

type TypeRemovalStrategy = {
  type: WorkItemType;
  action: 'delete' | 'migrate';
  migrateTo?: WorkItemType;
};

type AffectedWorkItem = { id: string; type: string };

function assertValidMigrationTargets(
  strategies: TypeRemovalStrategy[],
  allowedTypes: WorkItemType[]
): void {
  for (const strategy of strategies) {
    if (strategy.action !== 'migrate') {
      continue;
    }
    const target = strategy.migrateTo;
    if (!target || !allowedTypes.includes(target)) {
      throw new Error(
        `Migration target for ${strategy.type} must be one of the remaining project types`
      );
    }
  }
}

function assertStrategiesCoverAffected(
  strategies: TypeRemovalStrategy[],
  affected: AffectedWorkItem[]
): void {
  const strategyByType = new Map(strategies.map((s) => [s.type, s]));
  const missingStrategies = [
    ...new Set(affected.map((item) => item.type as WorkItemType)),
  ].filter((type) => !strategyByType.has(type));
  if (missingStrategies.length > 0) {
    throw new Error(
      `Missing removal strategy for type(s): ${missingStrategies.join(', ')}`
    );
  }
}

async function detachLinksForAffectedItems(
  projectId: string,
  affectedIds: string[]
): Promise<number> {
  if (affectedIds.length === 0) {
    return 0;
  }
  // Detach first: clear parent links involving removed-type items so
  // migrate/delete cannot create invalid adjacency or type loops.
  const result = await prisma.work_items.updateMany({
    where: {
      project_id: projectId,
      parent_id: { not: null },
      OR: [{ id: { in: affectedIds } }, { parent_id: { in: affectedIds } }],
    },
    data: { parent_id: null },
  });
  return result.count;
}

async function applyTypeRemovalActions(
  strategies: TypeRemovalStrategy[],
  affected: AffectedWorkItem[]
): Promise<{ deletedCount: number; migratedCount: number }> {
  const results = await Promise.all(
    strategies.map(async (strategy) => {
      const ids = affected
        .filter((item) => item.type === strategy.type)
        .map((item) => item.id);
      if (ids.length === 0) {
        return { deletedCount: 0, migratedCount: 0 };
      }

      if (strategy.action === 'delete') {
        await prisma.notifications.deleteMany({
          where: { related_item_id: { in: ids } },
        });
        const deleted = await prisma.work_items.deleteMany({
          where: { id: { in: ids } },
        });
        return { deletedCount: deleted.count, migratedCount: 0 };
      }

      const migrated = await prisma.work_items.updateMany({
        where: { id: { in: ids } },
        data: { type: strategy.migrateTo! },
      });
      return { deletedCount: 0, migratedCount: migrated.count };
    })
  );

  return results.reduce(
    (totals, result) => ({
      deletedCount: totals.deletedCount + result.deletedCount,
      migratedCount: totals.migratedCount + result.migratedCount,
    }),
    { deletedCount: 0, migratedCount: 0 }
  );
}

async function pruneInvalidHierarchyLinks(
  projectId: string,
  allowedTypes: WorkItemType[],
  customHierarchy?: Record<string, string | null> | null
): Promise<number> {
  const { parentToChild } = resolveProjectHierarchy(
    allowedTypes,
    customHierarchy
  );
  const itemsWithParents = await prisma.work_items.findMany({
    where: {
      project_id: projectId,
      parent_id: { not: null },
    },
    select: {
      id: true,
      type: true,
      parent: { select: { type: true } },
    },
  });

  const invalidChildIds = itemsWithParents
    .filter((item) => {
      if (!item.parent) {
        return true;
      }
      return parentToChild[item.parent.type as WorkItemType] !== item.type;
    })
    .map((item) => item.id);

  if (invalidChildIds.length === 0) {
    return 0;
  }

  const unlinkResult = await prisma.work_items.updateMany({
    where: { id: { in: invalidChildIds } },
    data: { parent_id: null },
  });
  return unlinkResult.count;
}

export class ProjectsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
  }

  async listAccessibleSummaries(input: {
    accessibleIds: string[];
    status?: ProjectStatus;
    search?: string;
  }): Promise<ActorProjectsSummary[]> {
    const where: Prisma.projectsWhereInput = {
      id: { in: input.accessibleIds },
    };

    if (input.status === ProjectStatus.archived) {
      where.deleted_at = { not: null };
    } else {
      where.deleted_at = null;
    }

    const term = input.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { key: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    try {
      const rows = await prisma.projects.findMany({
        where,
        select: {
          id: true,
          name: true,
          key: true,
          description: true,
          status: true,
        },
        orderBy: { name: 'asc' },
      });

      return rows.map((r) => ({
        id: r.id,
        name: r.name,
        key: r.key,
        description: r.description,
        status: r.status as ProjectStatus,
      }));
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        'error. failed to list accessible project summaries:',
        message
      );
      throw new Error('Failed to list projects');
    }
  }

  async listPaginated(input: {
    accessibleIds: string[];
    filters: {
      status?: ProjectStatus;
      search?: string;
    };
    page: number;
    limit: number;
  }): Promise<{
    projects: (ProjectListRow & { team_count: number })[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (input.page - 1) * input.limit;
    const take = input.limit;

    const where: Prisma.projectsWhereInput = {
      id: { in: input.accessibleIds },
    };

    if (input.filters.status === ProjectStatus.archived) {
      where.deleted_at = { not: null };
    } else {
      where.deleted_at = null;
    }

    const term = input.filters.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: 'insensitive' } },
        { key: { contains: term, mode: 'insensitive' } },
        { description: { contains: term, mode: 'insensitive' } },
      ];
    }

    try {
      const [projectRows, totalCount] = await Promise.all([
        prisma.projects.findMany({
          where,
          select: projectListSelect,
          orderBy: { created_at: 'desc' },
          skip,
          take,
        }),
        prisma.projects.count({ where }),
      ]);

      const projectIds = projectRows.map((p) => p.id);

      const teamCountsGroup = await prisma.teams.groupBy({
        by: ['project_id'],
        _count: { id: true },
        where: {
          project_id: { in: projectIds },
          status: { not: 'deleted' },
        },
      });

      const teamCountMap = new Map<string, number>();
      for (const group of teamCountsGroup) {
        if (group.project_id) {
          teamCountMap.set(group.project_id, group._count.id);
        }
      }

      const projects = projectRows.map((p) => ({
        ...p,
        team_count: teamCountMap.get(p.id) ?? 0,
      }));

      const totalPages = Math.ceil(totalCount / input.limit);

      return {
        projects,
        totalCount,
        page: input.page,
        limit: input.limit,
        totalPages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to list projects:', message);
      throw new Error('Failed to list projects');
    }
  }

  async getDetailById(projectId: string): Promise<ProjectDetailRow | null> {
    try {
      return await prisma.projects.findUnique({
        where: { id: projectId },
        select: projectDetailSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get project detail:', message);
      throw new Error('Failed to get project');
    }
  }

  async listMembersPrisma(projectId: string): Promise<ProjectMemberRow[]> {
    try {
      return await prisma.project_members.findMany({
        where: { project_id: projectId, status: RecordStatus.active },
        select: projectMemberSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error(
        'error. failed to list project members via prisma:',
        message
      );
      throw new Error('Failed to list project members');
    }
  }

  async listActiveBoardMembers(
    projectId: string
  ): Promise<ActiveProjectMember[]> {
    const memberships = await prisma.project_members.findMany({
      where: {
        project_id: projectId,
        status: RecordStatus.active,
        user: { active: true, membership_status: 'active' },
      },
      select: {
        user: { select: { id: true, name: true, email: true, role: true } },
      },
      orderBy: { user: { name: 'asc' } },
    });

    return memberships.map(({ user }) => user);
  }

  async listAll(): Promise<ProjectRowWithOwner[]> {
    const { data, error } = await this.db
      .from('projects')
      .select('*, owner:users!projects_owner_id_fkey(id, name, email)')
      .order('created_at', { ascending: false });

    if (error) {
      console.error('error. failed to list projects:', error.message);
      throw new Error('Failed to list projects');
    }

    return unsafeCast<ProjectRowWithOwner[]>(data);
  }

  async findByKey(key: string, excludeId?: string): Promise<ProjectRow | null> {
    let query = this.db.from('projects').select('*').eq('key', key);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('error. failed to find project by key:', error.message);
      throw new Error('Failed to find duplicate project key');
    }
    return unsafeCast<ProjectRow | null>(data);
  }

  async findById(id: string): Promise<ProjectRowWithOwner | null> {
    const { data, error } = await this.db
      .from('projects')
      .select('*, owner:users!projects_owner_id_fkey(id, name, email)')
      .eq('id', id)
      .maybeSingle();

    if (error) {
      console.error('error. failed to find project by id:', error.message);
      throw new Error('Failed to find project');
    }
    return unsafeCast<ProjectRowWithOwner | null>(data);
  }

  async listMembers(projectId: string): Promise<ProjectMemberWithUser[]> {
    const { data, error } = await this.db
      .from('project_members')
      .select(`*, ${PROJECT_MEMBER_USER_SELECT}`)
      .eq('project_id', projectId)
      .eq('status', 'active');

    if (error) {
      console.error('error. failed to list project members:', error.message);
      throw new Error('Failed to list project members');
    }

    return unsafeCast<ProjectMemberWithUser[]>(data);
  }

  async addMember(
    projectId: string,
    userId: string,
    actorId: string
  ): Promise<void> {
    await prisma.project_members.create({
      data: {
        project_id: projectId,
        user_id: userId,
        ...prismaAuditCreate(actorId),
      },
    });
  }

  /**
   * Idempotent: insert project_members for owner when missing.
   * Used after ownership reassignment (create inserts inside its transaction).
   */
  async ensureOwnerIsMember(
    projectId: string,
    ownerId: string,
    actorId: string
  ): Promise<void> {
    const existing = await prisma.project_members.findUnique({
      where: {
        project_id_user_id: { project_id: projectId, user_id: ownerId },
      },
      select: { user_id: true },
    });
    if (existing) {
      return;
    }
    await this.addMember(projectId, ownerId, actorId);
  }

  async removeMember(projectId: string, userId: string): Promise<void> {
    const { data: projectTeams, error: teamsError } = await this.db
      .from('teams')
      .select('id')
      .eq('project_id', projectId);

    if (teamsError) {
      console.error(
        'error. failed to list project teams for member removal:',
        teamsError.message
      );
      throw new Error('Failed to remove project member team assignments');
    }

    const teamIds = (projectTeams ?? []).map((team) => team.id);

    if (teamIds.length > 0) {
      await prisma.team_members.updateMany({
        where: { team_id: { in: teamIds }, reporting_line: userId },
        data: { reporting_line: null },
      });
      await prisma.team_members.deleteMany({
        where: { team_id: { in: teamIds }, user_id: userId },
      });
    }

    await prisma.project_members.deleteMany({
      where: { project_id: projectId, user_id: userId },
    });
  }

  async create(data: CreateProjectInput, actorId: string): Promise<ProjectRow> {
    const created = await withBusyRetry(
      () =>
        prisma.$transaction(
          async (tx) => {
            const project = await tx.projects.create({
              data: {
                name: data.name,
                key: data.key,
                description: data.description,
                status: data.status,
                start_date: prismaOptionalDate(data.start_date) ?? null,
                end_date: prismaOptionalDate(data.end_date) ?? null,
                owner_id: data.owner_id,
                jira_project_key: data.jira_project_key,
                jira_connection_id: data.jira_connection_id,
                github_repo: data.github_repo,
                github_token: data.github_token,
                logo_url: data.logo_url ?? null,
                cover_picture: data.cover_picture ?? null,
                attributes_config:
                  (data.attributes_config as Prisma.InputJsonValue) ?? null,
                workflow_config:
                  (data.workflow_config as Prisma.InputJsonValue) ?? null,
                deleted_at: null,
                ...prismaAuditCreateWithoutStatus(actorId),
              },
            });

            // Owner (manager) is always a project member so ACL and Members UI stay
            // consistent. The creating admin is also a member when they are not the
            // owner, so they keep workspace access under membership-scoped ACL.
            const memberUserIds = [...new Set([data.owner_id, actorId])];
            await tx.project_members.createMany({
              data: memberUserIds.map((userId) => ({
                project_id: project.id,
                user_id: userId,
                ...prismaAuditCreate(actorId),
              })),
            });

            if (data.sprint) {
              await insertSprint(tx, {
                ...data.sprint,
                projectId: project.id,
                createdBy: actorId,
              });
            }

            return project;
          },
          {
            // Prisma default maxWait (2s) is too aggressive under adapter-pg load
            // (alice#562 / prisma#27990).
            maxWait: 10_000,
            timeout: 15_000,
          }
        ),
      {
        onRetry: (attempt) => {
          console.warn(
            `warn. project create transaction busy; retrying (attempt ${attempt})`
          );
        },
      }
    );

    const row = await this.findById(created.id);
    if (!row) {
      throw new Error('Database insertion failed');
    }
    return row;
  }

  async update(
    id: string,
    data: ProjectUpdateInput,
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<ProjectRow> {
    const { count } = await prisma.projects.updateMany({
      where: { id, updated_at: prismaLockTimestampRange(expectedUpdatedAt) },
      data: buildProjectUpdateData(data, actorId),
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: async () => {
        const current = await this.findById(id);
        return current
          ? (withoutIntegrationSecrets(current) as unknown as ProjectRow)
          : null;
      },
      fetchCurrent: async () => {
        const current = await this.findById(id);
        return current
          ? (withoutIntegrationSecrets(current) as unknown as ProjectRow)
          : null;
      },
      notFoundMessage: 'Project not found',
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.projects.deleteMany({ where: { id } });
  }

  /**
   * Preview work items (active + archived) for types about to be removed from
   * a project's allowed set. Caps rows per type for the conflict UI.
   */
  async previewWorkItemTypeRemoval(
    projectId: string,
    removedTypes: WorkItemType[],
    keptTypes: WorkItemType[],
    customHierarchy?: Record<string, string | null> | null,
    previewLimitPerType = 100
  ): Promise<{
    groups: Array<{
      type: WorkItemType;
      count: number;
      childSlotParents: WorkItemType[];
      items: Array<{
        id: string;
        title: string;
        type: WorkItemType;
        status: string;
        record_status: string;
        parent_id: string | null;
        parent_title: string | null;
        jira_issue_key: string | null;
      }>;
    }>;
    totalAffected: number;
  }> {
    if (removedTypes.length === 0) {
      return { groups: [], totalAffected: 0 };
    }

    const { parentToChild } = resolveProjectHierarchy(
      [...keptTypes, ...removedTypes],
      customHierarchy
    );

    const items = await prisma.work_items.findMany({
      where: {
        project_id: projectId,
        type: { in: removedTypes },
      },
      select: {
        id: true,
        title: true,
        type: true,
        status: true,
        record_status: true,
        parent_id: true,
        jira_issue_key: true,
        parent: { select: { id: true, title: true } },
      },
      orderBy: [{ type: 'asc' }, { title: 'asc' }],
    });

    const groups = removedTypes.map((type) => {
      const typed = items.filter((item) => item.type === type);
      const childSlotParents = keptTypes.filter(
        (parent) => parentToChild[parent] === type
      );
      return {
        type,
        count: typed.length,
        childSlotParents,
        items: typed.slice(0, previewLimitPerType).map((item) => ({
          id: item.id,
          title: item.title,
          type: item.type as WorkItemType,
          status: item.status,
          record_status: item.record_status,
          parent_id: item.parent_id,
          parent_title: item.parent?.title ?? null,
          jira_issue_key: item.jira_issue_key,
        })),
      };
    });

    return {
      groups,
      totalAffected: items.length,
    };
  }

  /**
   * Detach hierarchy links, then delete or migrate items for removed types.
   * Replaces silent Issue fallback.
   */
  async applyWorkItemTypeRemovalStrategies(
    projectId: string,
    allowedTypes: WorkItemType[],
    strategies: TypeRemovalStrategy[],
    customHierarchy?: Record<string, string | null> | null
  ): Promise<{
    detachedCount: number;
    deletedCount: number;
    migratedCount: number;
  }> {
    assertValidMigrationTargets(strategies, allowedTypes);

    const removedTypes = strategies.map((s) => s.type);
    const affected = await prisma.work_items.findMany({
      where: {
        project_id: projectId,
        type: { in: removedTypes },
      },
      select: { id: true, type: true },
    });

    assertStrategiesCoverAffected(strategies, affected);

    const affectedIds = affected.map((item) => item.id);
    let detachedCount = await detachLinksForAffectedItems(
      projectId,
      affectedIds
    );

    const { deletedCount, migratedCount } = await applyTypeRemovalActions(
      strategies,
      affected
    );

    detachedCount += await pruneInvalidHierarchyLinks(
      projectId,
      allowedTypes,
      customHierarchy
    );

    return { detachedCount, deletedCount, migratedCount };
  }

  /** @deprecated Prefer {@link applyWorkItemTypeRemovalStrategies}. */
  async migrateWorkItemTypesAndPruneHierarchy(
    projectId: string,
    allowedTypes: WorkItemType[],
    customHierarchy?: Record<string, string | null> | null
  ): Promise<{ migratedCount: number; unlinkedCount: number }> {
    const fallbackType: WorkItemType = allowedTypes.includes(
      WorkItemTypeEnum.Issue
    )
      ? WorkItemTypeEnum.Issue
      : (allowedTypes.at(-1) ?? WorkItemTypeEnum.Issue);

    const workItemsToMigrate = await prisma.work_items.findMany({
      where: {
        project_id: projectId,
        type: { notIn: allowedTypes },
      },
      select: { id: true, type: true },
    });

    const typesToMigrate = [
      ...new Set(workItemsToMigrate.map((item) => item.type as WorkItemType)),
    ];

    if (typesToMigrate.length === 0) {
      const prune = await this.applyWorkItemTypeRemovalStrategies(
        projectId,
        allowedTypes,
        [],
        customHierarchy
      );
      return {
        migratedCount: 0,
        unlinkedCount: prune.detachedCount,
      };
    }

    const result = await this.applyWorkItemTypeRemovalStrategies(
      projectId,
      allowedTypes,
      typesToMigrate.map((type) => ({
        type,
        action: 'migrate' as const,
        migrateTo: fallbackType,
      })),
      customHierarchy
    );

    return {
      migratedCount: result.migratedCount,
      unlinkedCount: result.detachedCount,
    };
  }

  async linkImportedJiraParents(
    projectId: string,
    issues: { key: string; parentKey?: string | null }[],
    hierarchy?: Record<string, string | null> | null,
    allowedTypes?: WorkItemType[] | null
  ): Promise<void> {
    const allWorkItems = await prisma.work_items.findMany({
      where: { project_id: projectId },
      select: { id: true, jira_issue_key: true, parent_id: true, type: true },
    });

    const keyToItemMap = new Map<string, (typeof allWorkItems)[number]>();
    for (const item of allWorkItems) {
      if (item.jira_issue_key) {
        keyToItemMap.set(item.jira_issue_key, item);
      }
    }

    const { parentToChild } = resolveProjectHierarchy(allowedTypes, hierarchy);

    for (const issue of issues) {
      if (!issue.parentKey) {
        continue;
      }
      const childItem = keyToItemMap.get(issue.key);
      const parentItem = keyToItemMap.get(issue.parentKey);
      if (!childItem || !parentItem) {
        continue;
      }

      const allowedChildForParent =
        parentToChild[parentItem.type as WorkItemType];
      const isAllowedHierarchy = allowedChildForParent === childItem.type;
      const needsUpdate = childItem.parent_id !== parentItem.id;

      if (isAllowedHierarchy && needsUpdate) {
        await prisma.work_items.update({
          where: { id: childItem.id },
          data: { parent_id: parentItem.id },
        });
      }
    }
  }
}
