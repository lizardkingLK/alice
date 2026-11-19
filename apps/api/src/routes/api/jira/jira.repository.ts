import {
  buildJiraProviderConfig,
  tryParseJiraProviderConfig,
} from '@repo/types';
import {
  ProjectManagementConnectionStatus,
  ProjectManagementVendor,
  type Prisma,
} from '@repo/types/prisma';
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
  vendor: true,
  external_id: true,
  display_label: true,
  provider_config: true,
  scopes: true,
  status: true,
  created_at: true,
  updated_at: true,
} as const;

const FULL_SELECT = {
  ...PUBLIC_SELECT,
  refresh_token_enc: true,
  access_token_enc: true,
  access_token_expires_at: true,
} as const;

type PublicRow = {
  id: string;
  user_id: string;
  vendor: ProjectManagementVendor;
  external_id: string;
  display_label: string | null;
  provider_config: Prisma.JsonValue;
  scopes: string;
  status: ProjectManagementConnectionStatus;
  created_at: Date;
  updated_at: Date;
};

type FullRow = PublicRow & {
  refresh_token_enc: string;
  access_token_enc: string | null;
  access_token_expires_at: Date | null;
};

function toDto(row: PublicRow): JiraConnectionDto {
  const config = tryParseJiraProviderConfig(row.provider_config);
  return {
    id: row.id,
    user_id: row.user_id,
    cloud_id: row.external_id,
    site_url: config?.site_url ?? row.display_label ?? '',
    account_email: config?.account_email ?? null,
    scopes: row.scopes,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function toRow(row: FullRow): JiraConnectionRow {
  return {
    ...toDto(row),
    refresh_token_enc: row.refresh_token_enc,
    access_token_enc: row.access_token_enc,
    access_token_expires_at: row.access_token_expires_at,
    vendor: ProjectManagementVendor.jira,
    external_id: row.external_id,
    provider_config: row.provider_config,
  };
}

export class JiraRepository {
  async listByUserId(userId: string): Promise<JiraConnectionDto[]> {
    const rows = await prisma.project_management_connections.findMany({
      where: { user_id: userId, vendor: ProjectManagementVendor.jira },
      select: PUBLIC_SELECT,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toDto);
  }

  /** Active connections across the workspace (manager shared-view fallback). */
  async listAllActive(): Promise<JiraConnectionDto[]> {
    const rows = await prisma.project_management_connections.findMany({
      where: {
        status: ProjectManagementConnectionStatus.active,
        vendor: ProjectManagementVendor.jira,
      },
      select: PUBLIC_SELECT,
      orderBy: { created_at: 'desc' },
    });
    return rows.map(toDto);
  }

  async findById(id: string): Promise<JiraConnectionRow | null> {
    const row = await prisma.project_management_connections.findFirst({
      where: { id, vendor: ProjectManagementVendor.jira },
      select: FULL_SELECT,
    });
    return row ? toRow(row) : null;
  }

  async findByIdForUser(
    id: string,
    userId: string
  ): Promise<JiraConnectionRow | null> {
    const row = await prisma.project_management_connections.findFirst({
      where: { id, user_id: userId, vendor: ProjectManagementVendor.jira },
      select: FULL_SELECT,
    });
    return row ? toRow(row) : null;
  }

  async upsertByUserAndCloud(
    input: UpsertJiraConnectionInput
  ): Promise<JiraConnectionDto> {
    const providerConfig = buildJiraProviderConfig({
      site_url: input.site_url,
      account_email: input.account_email,
    });
    const status = input.status ?? ProjectManagementConnectionStatus.active;

    const row = await prisma.project_management_connections.upsert({
      where: {
        user_id_vendor_external_id: {
          user_id: input.user_id,
          vendor: ProjectManagementVendor.jira,
          external_id: input.cloud_id,
        },
      },
      create: {
        user_id: input.user_id,
        vendor: ProjectManagementVendor.jira,
        external_id: input.cloud_id,
        display_label: input.site_url,
        provider_config: providerConfig,
        refresh_token_enc: input.refresh_token_enc,
        access_token_enc: input.access_token_enc ?? null,
        access_token_expires_at: input.access_token_expires_at ?? null,
        scopes: input.scopes,
        status,
      },
      update: {
        display_label: input.site_url,
        provider_config: providerConfig,
        refresh_token_enc: input.refresh_token_enc,
        access_token_enc: input.access_token_enc ?? null,
        access_token_expires_at: input.access_token_expires_at ?? null,
        scopes: input.scopes,
        status,
      },
      select: PUBLIC_SELECT,
    });
    return toDto(row);
  }

  async updateTokens(
    id: string,
    input: UpdateJiraConnectionTokensInput
  ): Promise<void> {
    await prisma.project_management_connections.update({
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
    const result = await prisma.project_management_connections.deleteMany({
      where: { id, user_id: userId, vendor: ProjectManagementVendor.jira },
    });
    return result.count > 0;
  }
}
