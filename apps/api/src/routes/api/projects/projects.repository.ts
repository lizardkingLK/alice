import {
  USER_PROJECTION_WITH_ROLE,
  userRelationSelect,
  type Database,
} from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreate,
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
  prismaOptionalDate,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
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

/** Strip Jira API token before serializing project DTOs to clients. */
export function withoutJiraToken<T extends { jira_token?: string | null }>(
  project: T
): Omit<T, 'jira_token'> {
  const safe = { ...project };
  delete safe.jira_token;
  return safe;
}

function applyOptionalProjectIntegrations(
  patch: Record<string, unknown>,
  data: ProjectUpdateInput
): void {
  if (data.jira_url !== undefined) patch.jira_url = data.jira_url;
  if (data.jira_email !== undefined) patch.jira_email = data.jira_email;
  if (data.jira_token !== undefined) patch.jira_token = data.jira_token;
  if (data.jira_project_key !== undefined) {
    patch.jira_project_key = data.jira_project_key;
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
    return data;
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
    const created = await prisma.projects.create({
      data: {
        name: data.name,
        key: data.key,
        description: data.description,
        status: data.status,
        start_date: prismaOptionalDate(data.start_date) ?? null,
        end_date: prismaOptionalDate(data.end_date) ?? null,
        owner_id: data.owner_id,
        jira_url: data.jira_url,
        jira_email: data.jira_email,
        jira_token: data.jira_token,
        jira_project_key: data.jira_project_key,
        github_repo: data.github_repo,
        github_token: data.github_token,
        logo_url: data.logo_url ?? null,
        cover_picture: data.cover_picture ?? null,
        deleted_at: null,
        ...prismaAuditCreateWithoutStatus(actorId),
      },
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
      where: { id, updated_at: prismaLockTimestamp(expectedUpdatedAt) },
      data: buildProjectUpdateData(data, actorId),
    });

    return resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: async () => {
        const current = await this.findById(id);
        return current
          ? (withoutJiraToken(current) as unknown as ProjectRow)
          : null;
      },
      fetchCurrent: async () => {
        const current = await this.findById(id);
        return current
          ? (withoutJiraToken(current) as unknown as ProjectRow)
          : null;
      },
      notFoundMessage: 'Project not found',
    });
  }

  async delete(id: string): Promise<void> {
    await prisma.projects.deleteMany({ where: { id } });
  }

  async getJiraSettings(): Promise<{
    jira_url: string;
    jira_email: string;
    jira_token: string;
  } | null> {
    const { data, error } = await this.db
      .from('jira_settings')
      .select('jira_url, jira_email, jira_token')
      .limit(1)
      .maybeSingle();

    if (error) {
      console.error('error. failed to fetch Jira settings:', error.message);
      throw new Error('Failed to fetch Jira settings');
    }
    return data;
  }

  async saveJiraSettings(
    url: string,
    email: string,
    token: string
  ): Promise<void> {
    await prisma.jira_settings.upsert({
      where: { singleton: true },
      create: {
        singleton: true,
        jira_url: url,
        jira_email: email,
        jira_token: token,
      },
      update: {
        jira_url: url,
        jira_email: email,
        jira_token: token,
      },
    });
  }

  async linkImportedJiraParents(
    projectId: string,
    issues: { key: string; parentKey?: string | null }[]
  ): Promise<void> {
    const allWorkItems = await prisma.work_items.findMany({
      where: { project_id: projectId },
      select: { id: true, jira_issue_key: true, parent_id: true },
    });

    const keyToIdMap = new Map<string, string>();
    for (const item of allWorkItems) {
      if (item.jira_issue_key) {
        keyToIdMap.set(item.jira_issue_key, item.id);
      }
    }

    for (const issue of issues) {
      if (!issue.parentKey) {
        continue;
      }
      const childId = keyToIdMap.get(issue.key);
      const parentId = keyToIdMap.get(issue.parentKey);
      if (childId && parentId) {
        const currentItem = allWorkItems.find((item) => item.id === childId);
        if (currentItem && currentItem.parent_id !== parentId) {
          await prisma.work_items.update({
            where: { id: childId },
            data: { parent_id: parentId },
          });
        }
      }
    }
  }
}
