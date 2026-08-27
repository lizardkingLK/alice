import { prisma } from '../../../lib/prisma';
import type {
  JiraConnectionDto,
  JiraConnectionRow,
  UpdateJiraConnectionTokensInput,
  UpsertJiraConnectionInput,
} from './jira.types';

const PUBLIC_SELECT = {
  id: true,
  user_id: true,
  cloud_id: true,
  site_url: true,
  account_email: true,
  scopes: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

function toDto(row: {
  id: string;
  user_id: string;
  cloud_id: string;
  site_url: string;
  account_email: string | null;
  scopes: string;
  status: JiraConnectionDto['status'];
  created_at: Date;
  updated_at: Date;
}): JiraConnectionDto {
  return {
    id: row.id,
    user_id: row.user_id,
    cloud_id: row.cloud_id,
    site_url: row.site_url,
    account_email: row.account_email,
    scopes: row.scopes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

export class JiraRepository {
  async listByUserId(userId: string): Promise<JiraConnectionDto[]> {
    const rows = await prisma.jira_connections.findMany({
      where: { user_id: userId },
      select: PUBLIC_SELECT,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toDto);
  }

  async findById(id: string): Promise<JiraConnectionRow | null> {
    return await prisma.jira_connections.findUnique({ where: { id } });
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<JiraConnectionRow | null> {
    return await prisma.jira_connections.findFirst({
      where: { id, user_id: userId },
    });
  }

  async upsertByUserAndCloud(
    input: UpsertJiraConnectionInput
  ): Promise<JiraConnectionDto> {
    const row = await prisma.jira_connections.upsert({
      where: {
        user_id_cloud_id: {
          user_id: input.user_id,
          cloud_id: input.cloud_id,
        },
      },
      create: {
        user_id: input.user_id,
        cloud_id: input.cloud_id,
        site_url: input.site_url,
        account_email: input.account_email ?? null,
        refresh_token_enc: input.refresh_token_enc,
        access_token_enc: input.access_token_enc ?? null,
        access_token_expires_at: input.access_token_expires_at ?? null,
        scopes: input.scopes,
        status: input.status ?? 'active',
      },
      update: {
        site_url: input.site_url,
        account_email: input.account_email ?? null,
        refresh_token_enc: input.refresh_token_enc,
        access_token_enc: input.access_token_enc ?? null,
        access_token_expires_at: input.access_token_expires_at ?? null,
        scopes: input.scopes,
        status: input.status ?? 'active',
      },
      select: PUBLIC_SELECT,
    });
    return toDto(row);
  }

  async updateTokens(
    id: string,
    input: UpdateJiraConnectionTokensInput
  ): Promise<void> {
    await prisma.jira_connections.update({
      where: { id },
      data: {
        ...(input.refresh_token_enc !== undefined
          ? { refresh_token_enc: input.refresh_token_enc }
          : {}),
        ...(input.access_token_enc !== undefined
          ? { access_token_enc: input.access_token_enc }
          : {}),
        ...(input.access_token_expires_at !== undefined
          ? { access_token_expires_at: input.access_token_expires_at }
          : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
      },
    });
  }

  async deleteByIdForUser(id: string, userId: string): Promise<boolean> {
    const result = await prisma.jira_connections.deleteMany({
      where: { id, user_id: userId },
    });
    return result.count > 0;
  }
}
