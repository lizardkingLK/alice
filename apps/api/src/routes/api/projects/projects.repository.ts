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
} from '@repo/types';
import { Prisma, ProjectStatus, RecordStatus } from '@repo/types/prisma';
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

export class ProjectsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listAccessibleProjectIds(actorId: string): Promise<string[]> {
    return listAccessibleProjectIds(this.db, actorId);
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
    const created = await prisma.$transaction(async (tx) => {
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

      return project;
    });

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

  async migrateWorkItemTypesAndPruneHierarchy(
    projectId: string,
    allowedTypes: WorkItemType[],
    customHierarchy?: Record<string, string | null> | null
  ): Promise<{ migratedCount: number; unlinkedCount: number }> {
    const fallbackType: WorkItemType = allowedTypes.includes(
      WorkItemTypeEnum.Issue
    )
      ? WorkItemTypeEnum.Issue
      : (allowedTypes[allowedTypes.length - 1] ?? WorkItemTypeEnum.Issue);

    const { parentToChild } = resolveProjectHierarchy(
      allowedTypes,
      customHierarchy
    );

    // 1. Find all work items in project whose type is no longer allowed
    const workItemsToMigrate = await prisma.work_items.findMany({
      where: {
        project_id: projectId,
        type: { notIn: allowedTypes },
      },
      select: { id: true, type: true },
    });

    const migratedIds = workItemsToMigrate.map((item) => item.id);
    let migratedCount = 0;

    if (migratedIds.length > 0) {
      const updateResult = await prisma.work_items.updateMany({
        where: { id: { in: migratedIds } },
        data: { type: fallbackType },
      });
      migratedCount = updateResult.count;

      // Leaf items (Issue) cannot have children; clear parent_id of any children of migrated items
      await prisma.work_items.updateMany({
        where: { parent_id: { in: migratedIds } },
        data: { parent_id: null },
      });
    }

    // 2. Fetch all work items in the project that have a parent to verify hierarchy compliance
    const itemsWithParents = await prisma.work_items.findMany({
      where: {
        project_id: projectId,
        parent_id: { not: null },
      },
      select: {
        id: true,
        type: true,
        parent_id: true,
        parent: {
          select: { id: true, type: true },
        },
      },
    });

    const invalidChildIds: string[] = [];
    for (const item of itemsWithParents) {
      if (!item.parent) {
        invalidChildIds.push(item.id);
        continue;
      }
      const allowedChildForParent =
        parentToChild[item.parent.type as WorkItemType];
      if (allowedChildForParent !== item.type) {
        invalidChildIds.push(item.id);
      }
    }

    let unlinkedCount = 0;
    if (invalidChildIds.length > 0) {
      const unlinkResult = await prisma.work_items.updateMany({
        where: { id: { in: invalidChildIds } },
        data: { parent_id: null },
      });
      unlinkedCount = unlinkResult.count;
    }

    return { migratedCount, unlinkedCount };
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
