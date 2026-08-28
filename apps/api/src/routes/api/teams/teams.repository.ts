import { teamListSelect, type Database, type Tables, type TeamListRow } from '@repo/types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { prisma } from '../../../lib/prisma';
import {
  prismaAuditCreateWithoutStatus,
  prismaAuditUpdate,
  prismaLockTimestamp,
} from '../../../lib/prisma-audit';
import { resolveOptimisticPrismaUpdate } from '../../../lib/optimistic-lock';
import { RecordStatus, Prisma } from '@repo/types/prisma';

export type TeamMemberRow = Tables<'team_members'>;

export type TeamRow = {
  id: string;
  name: string;
  description: string | null;
  manager_id: string;
  project_id: string | null;
  tech_stack: string | null;
  status: 'active' | 'inactive' | 'archived' | 'deleted';
  created_at: string;
  updated_at: string;
  created_by: string | null;
  updated_by: string | null;
};

async function insertTeamMembers(
  teamId: string,
  members: { user_id: string; capacity?: number | null; allocation?: number | null; }[],
  userId: string,
  failureMessage: string
): Promise<void> {
  if (members.length === 0) {
    return;
  }

  try {
    await prisma.team_members.createMany({
      data: members.map((member) => ({
        team_id: teamId,
        user_id: member.user_id,
        capacity: member.capacity ?? null,
        allocation: member.allocation ?? null,
        status: RecordStatus.active,
        created_by: userId,
        updated_by: userId,
      })),
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(failureMessage, message);
    throw new Error(`${failureMessage}: ${message}`);
  }
}

export class TeamsRepository {
  constructor(private readonly db: SupabaseClient<Database>) {}

  async listPaginated(input: {
    projectId?: string;
    status?: RecordStatus;
    search?: string;
    page: number;
    limit: number;
  }): Promise<{
    teams: TeamListRow[];
    totalCount: number;
    page: number;
    limit: number;
    totalPages: number;
  }> {
    const skip = (input.page - 1) * input.limit;
    const take = input.limit;

    const where: Prisma.teamsWhereInput = {};

    if (input.projectId) {
      where.project_id = input.projectId;
    }

    if (input.status) {
      where.status = input.status;
    }

    const term = input.search?.trim();
    if (term) {
      where.OR = [
        { name: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { description: { contains: term, mode: Prisma.QueryMode.insensitive } },
        { tech_stack: { contains: term, mode: Prisma.QueryMode.insensitive } },
      ];
    }

    try {
      const [teams, totalCount] = await Promise.all([
        prisma.teams.findMany({
          where,
          select: teamListSelect,
          orderBy: { created_at: Prisma.SortOrder.desc },
          skip,
          take,
        }),
        prisma.teams.count({ where }),
      ]);

      const totalPages = Math.ceil(totalCount / input.limit);

      return {
        teams,
        totalCount,
        page: input.page,
        limit: input.limit,
        totalPages,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to list teams:', message);
      throw new Error('Failed to list teams');
    }
  }

  async getDetailById(teamId: string): Promise<TeamListRow | null> {
    try {
      return await prisma.teams.findUnique({
        where: { id: teamId },
        select: teamListSelect,
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.error('error. failed to get team detail:', message);
      throw new Error('Failed to get team');
    }
  }

  async findByName(name: string, excludeId?: string): Promise<TeamRow | null> {
    let query = this.db.from('teams').select('*').eq('name', name);
    if (excludeId) {
      query = query.neq('id', excludeId);
    }
    const { data, error } = await query.maybeSingle();
    if (error) {
      console.error('database query error find team by name:', error.message);
      throw new Error('Failed to locate team by name');
    }
    return data;
  }

  async findById(id: string): Promise<TeamRow | null> {
    const { data, error } = await this.db
      .from('teams')
      .select('*')
      .eq('id', id)
      .maybeSingle();
    if (error) {
      console.error('database query error find team by id:', error.message);
      throw new Error('Failed to locate team by id');
    }
    return data;
  }

  async create(
    teamInput: Omit<
      TeamRow,
      'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
    > & {
      member_ids?: string[];
      members?: {
        user_id: string;
        capacity?: number | null;
        allocation?: number | null;
      }[];
    },
    userId: string
  ): Promise<TeamRow> {
    const { member_ids, members, ...teamData } = teamInput;
    const createdTeam = await prisma.teams.create({
      data: {
        ...teamData,
        ...prismaAuditCreateWithoutStatus(userId),
      },
    });

    const parsedMembers = members 
      ? members 
      : (member_ids || []).map(id => ({ user_id: id }));

    if (parsedMembers.length > 0) {
      try {
        await insertTeamMembers(
          createdTeam.id,
          parsedMembers,
          userId,
          'Failed to add team members'
        );
      } catch (error) {
        await prisma.teams.delete({ where: { id: createdTeam.id } });
        throw error;
      }
    }

    const row = await this.findById(createdTeam.id);
    if (!row) {
      throw new Error('Create team DB error');
    }
    return row;
  }

  async update(
    teamId: string,
    teamInput: Partial<
      Omit<
        TeamRow,
        'id' | 'created_at' | 'updated_at' | 'created_by' | 'updated_by'
      >
    > & {
      member_ids?: string[];
      members?: {
        user_id: string;
        capacity?: number | null;
        allocation?: number | null;
      }[];
    },
    userId: string,
    expectedUpdatedAt: string
  ): Promise<TeamRow> {
    const { member_ids, members, ...teamData } = teamInput;
    const { count } = await prisma.teams.updateMany({
      where: { id: teamId, updated_at: prismaLockTimestamp(expectedUpdatedAt) },
      data: {
        ...teamData,
        ...prismaAuditUpdate(userId),
      },
    });

    const updatedTeam = await resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findById(teamId),
      fetchCurrent: () => this.findById(teamId),
      notFoundMessage: 'Team not found',
    });

    if (members || member_ids) {
      const parsedMembers = members 
        ? members 
        : (member_ids || []).map(id => ({ user_id: id }));

      try {
        await prisma.team_members.deleteMany({ where: { team_id: teamId } });
        await insertTeamMembers(
          teamId,
          parsedMembers,
          userId,
          'Failed to update team members'
        );
      } catch (memberError) {
        const detail =
          memberError instanceof Error
            ? memberError.message
            : 'Unknown membership error';
        throw new Error(
          `Failed to update team members after the team row was updated. Reload the team and retry: ${detail}`
        );
      }
    }

    return updatedTeam;
  }

  async findMember(
    teamId: string,
    userId: string
  ): Promise<TeamMemberRow | null> {
    const { data, error } = await this.db
      .from('team_members')
      .select('*')
      .eq('team_id', teamId)
      .eq('user_id', userId)
      .maybeSingle();

    if (error) {
      console.error('database query error find team member:', error.message);
      throw new Error('Failed to locate team member');
    }

    return data;
  }

  async updateMember(
    teamId: string,
    userId: string,
    patch: { capacity?: number | null; allocation?: number | null },
    actorId: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    const { count } = await prisma.team_members.updateMany({
      where: {
        team_id: teamId,
        user_id: userId,
        updated_at: prismaLockTimestamp(expectedUpdatedAt),
      },
      data: {
        ...patch,
        updated_by: actorId,
        updated_at: new Date(),
      },
    });

    await resolveOptimisticPrismaUpdate({
      count,
      fetchUpdated: () => this.findMember(teamId, userId),
      fetchCurrent: () => this.findMember(teamId, userId),
      notFoundMessage: 'Team member not found',
    });
  }

  async delete(teamId: string): Promise<void> {
    await prisma.teams.deleteMany({ where: { id: teamId } });
  }
}
