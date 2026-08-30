import { requireUserWithRole } from '../../../lib/auth-helpers';
import { encryptSecretIfPresent } from '../../../lib/secrets/token-crypto';
import {
  INTEGRATION_SECRET_KEYS,
  UserRoleEnum,
  isPlainRecord,
  withoutIntegrationConfigSecrets,
  type ChatModelOption,
  type IntegrationConfigPublic,
  type CreateIntegrationBody,
  type IntegrationConfigPatch,
  type IntegrationConfigStored,
  type IntegrationDetailWire,
  type IntegrationListRow,
  type IntegrationWire,
  type ListIntegrationsQuery,
  type PatchIntegrationBody,
} from '@repo/types';
import { IntegrationStatus, Prisma } from '@repo/types/prisma';
import type { IntegrationsRepository } from './integrations.repository';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage integrations.'
  );
}

function encryptConfigSecrets(
  config: Record<string, unknown>
): Record<string, unknown> {
  const encrypted = { ...config };

  for (const secretKey of INTEGRATION_SECRET_KEYS) {
    if (!(secretKey in encrypted)) {
      continue;
    }

    const value = encrypted[secretKey];
    if (typeof value !== 'string') {
      continue;
    }

    encrypted[secretKey] = encryptSecretIfPresent(value);
  }

  return encrypted;
}

function prepareStoredConfigForCreate(
  config: IntegrationConfigStored
): Prisma.InputJsonValue {
  return encryptConfigSecrets(config) as Prisma.InputJsonValue;
}

function applyPatchFields(
  base: Record<string, unknown>,
  patch: IntegrationConfigPatch
): void {
  for (const [key, value] of Object.entries(patch)) {
    if (value != null) {
      base[key] = value;
    }
  }
}

function restoreExistingSecret(
  base: Record<string, unknown>,
  existing: unknown,
  secretKey: string
): void {
  if (isPlainRecord(existing) && typeof existing[secretKey] === 'string') {
    base[secretKey] = existing[secretKey];
  } else {
    delete base[secretKey];
  }
}

function applySecretPatch(
  base: Record<string, unknown>,
  existing: unknown,
  patch: IntegrationConfigPatch,
  secretKey: (typeof INTEGRATION_SECRET_KEYS)[number]
): void {
  if (!(secretKey in patch)) {
    return;
  }

  const value = (patch as Record<string, unknown>)[secretKey];
  if (
    value === undefined ||
    (typeof value === 'string' && value.length === 0)
  ) {
    restoreExistingSecret(base, existing, secretKey);
    return;
  }

  if (typeof value === 'string') {
    base[secretKey] = encryptSecretIfPresent(value);
  }
}

function prepareStoredConfigForPatch(
  existing: unknown,
  patch: IntegrationConfigPatch
): Prisma.InputJsonValue {
  const base = isPlainRecord(existing) ? { ...existing } : {};

  applyPatchFields(base, patch);

  for (const secretKey of INTEGRATION_SECRET_KEYS) {
    applySecretPatch(base, existing, patch, secretKey);
  }

  return base as Prisma.InputJsonValue;
}

function stripIntegrationSecrets<T extends IntegrationListRow>(
  row: T
): Omit<T, 'config'> & { config: IntegrationConfigPublic } {
  const { config, ...rest } = row;
  return {
    ...rest,
    config: withoutIntegrationConfigSecrets(config) as IntegrationConfigPublic,
  };
}

function toChatModelOption(row: IntegrationListRow): ChatModelOption | null {
  if (!isPlainRecord(row.config) || row.config.kind !== 'chat_model') {
    return null;
  }

  const model = row.config.model;
  const displayLabel = row.config.display_label;
  if (typeof model !== 'string' || typeof displayLabel !== 'string') {
    return null;
  }

  return {
    id: row.id,
    provider: row.provider,
    name: row.name,
    is_default: row.is_default,
    model,
    display_label: displayLabel,
    model_version:
      typeof row.config.model_version === 'string'
        ? row.config.model_version
        : undefined,
  };
}

export class IntegrationsService {
  constructor(
    private readonly integrationsRepository: IntegrationsRepository
  ) {}

  async listIntegrations(
    actorId: string,
    query: ListIntegrationsQuery
  ): Promise<IntegrationWire[]> {
    await requireAdmin(actorId);
    const rows = await this.integrationsRepository.list(query);
    return rows.map(stripIntegrationSecrets);
  }

  async getIntegrationDetail(
    actorId: string,
    id: string
  ): Promise<IntegrationDetailWire | null> {
    await requireAdmin(actorId);
    const row = await this.integrationsRepository.findById(id);
    if (!row) {
      return null;
    }
    return stripIntegrationSecrets(row);
  }

  async listChatModels(actorId: string): Promise<ChatModelOption[]> {
    await requireUserWithRole(
      actorId,
      [UserRoleEnum.admin, UserRoleEnum.manager, UserRoleEnum.member],
      'Unauthorized.'
    );

    const rows = await this.integrationsRepository.listActiveChatModels();
    return rows
      .map(toChatModelOption)
      .filter((option): option is ChatModelOption => option !== null);
  }

  async createIntegration(
    actorId: string,
    input: CreateIntegrationBody
  ): Promise<IntegrationDetailWire> {
    await requireAdmin(actorId);

    const row = await this.integrationsRepository.create({
      actorId,
      catalog_id: input.catalog_id,
      category: input.category,
      provider: input.provider,
      name: input.name,
      status: input.status ?? IntegrationStatus.draft,
      config: prepareStoredConfigForCreate(input.config),
      is_default: input.is_default ?? false,
      sort_order: input.sort_order ?? 0,
    });

    return stripIntegrationSecrets(row);
  }

  async patchIntegration(
    actorId: string,
    id: string,
    input: PatchIntegrationBody
  ): Promise<IntegrationDetailWire> {
    await requireAdmin(actorId);

    const existing = await this.integrationsRepository.findById(id);
    if (!existing) {
      throw new Error('Integration not found');
    }

    const row = await this.integrationsRepository.update({
      actorId,
      id,
      ...(input.catalog_id !== undefined
        ? { catalog_id: input.catalog_id }
        : {}),
      ...(input.category !== undefined ? { category: input.category } : {}),
      ...(input.provider !== undefined ? { provider: input.provider } : {}),
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      ...(input.config !== undefined
        ? {
            config: prepareStoredConfigForPatch(existing.config, input.config),
          }
        : {}),
      ...(input.is_default !== undefined
        ? { is_default: input.is_default }
        : {}),
      ...(input.sort_order !== undefined
        ? { sort_order: input.sort_order }
        : {}),
    });

    return stripIntegrationSecrets(row);
  }

  async deleteIntegration(actorId: string, id: string): Promise<void> {
    await requireAdmin(actorId);
    await this.integrationsRepository.disable(id, actorId);
  }
}
