import { requireUserWithRole } from '../../../lib/auth-helpers';
import {
  UserRoleEnum,
  RecordStatusEnum,
  OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE,
  EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE,
  isOwnAllowlistDomainLockout,
  emailDomainFromAddress,
  type ListAccessAllowlistQuery,
} from '@repo/types';
import {
  AccessAllowlistRepository,
  type AccessAllowlistKind,
  type AccessAllowlistPaginatedList,
  type AccessAllowlistRow,
  type AccessAllowlistStatus,
  type AccessAllowlistTransaction,
} from './access-allowlist.repository';
import { notifyAllowlistedEmail } from './notify-allowlisted-email';
import type { AccessRequestsService } from '../access-requests/access-requests.service';

async function requireAdmin(actorId: string) {
  return await requireUserWithRole(
    actorId,
    [UserRoleEnum.admin],
    'Unauthorized. Only administrators can manage the access allowlist.'
  );
}

function rejectOwnDomainLockout(
  entry: AccessAllowlistRow,
  actorEmail: string,
  options: { deleting?: boolean; nextStatus?: string | null }
): void {
  if (
    isOwnAllowlistDomainLockout({
      entry,
      actorEmail,
      deleting: options.deleting,
      nextStatus: options.nextStatus,
    })
  ) {
    throw new Error(OWN_ALLOWLIST_DOMAIN_LOCKOUT_MESSAGE);
  }
}

async function notifyIfEmailAllowlisted(entry: AccessAllowlistRow) {
  if (entry.kind !== 'email' || entry.status !== RecordStatusEnum.active) {
    return;
  }

  try {
    await notifyAllowlistedEmail(entry.value);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error('error. allowlist admission email failed:', message);
  }
}

export type CreateAccessAllowlistInput = {
  kind: AccessAllowlistKind;
  value: string;
  label?: string | null;
  expires_at?: string | null;
  allowed_project_ids?: string[] | null;
  status?: AccessAllowlistStatus;
  requestId?: string;
};

export type UpdateAccessAllowlistInput = {
  label?: string | null;
  expires_at?: string | null;
  allowed_project_ids?: string[] | null;
  status?: AccessAllowlistStatus;
  expectedUpdatedAt: string;
};

export class AccessAllowlistService {
  constructor(
    private readonly accessAllowlistRepository: AccessAllowlistRepository,
    private readonly accessRequestsService?: AccessRequestsService
  ) {}

  async requireAdminAllowlistEntry(
    actorId: string,
    id: string
  ): Promise<{
    actor: { email: string };
    entry: AccessAllowlistRow;
  }> {
    const actor = await requireAdmin(actorId);
    const entry = await this.accessAllowlistRepository.findById(id);
    if (!entry) {
      throw new Error('Access allowlist entry not found');
    }

    return { actor, entry };
  }

  async listAccessAllowlistPaginated(
    actorId: string,
    query: ListAccessAllowlistQuery
  ): Promise<AccessAllowlistPaginatedList> {
    await requireAdmin(actorId);
    return this.accessAllowlistRepository.listPaginated(query);
  }

  async createAccessAllowlist(
    actorId: string,
    input: CreateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    await requireAdmin(actorId);

    if (input.kind === 'email') {
      const domain = emailDomainFromAddress(input.value);
      if (domain) {
        const domainRow =
          await this.accessAllowlistRepository.findActiveDomainByValue(domain);
        if (domainRow) {
          throw new Error(EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE);
        }
      }
    }

    const status = input.status ?? RecordStatusEnum.active;
    const createEntry = (transaction?: AccessAllowlistTransaction) =>
      this.accessAllowlistRepository.create(
        {
          actorId,
          kind: input.kind,
          value: input.value,
          label: input.label,
          expires_at: input.expires_at,
          allowed_project_ids: input.allowed_project_ids,
          status,
        },
        transaction
      );

    const accessRequestsService = this.accessRequestsService;
    let entry: AccessAllowlistRow;
    if (
      input.kind === 'email' &&
      status === RecordStatusEnum.active &&
      accessRequestsService
    ) {
      entry = await this.accessAllowlistRepository.withTransaction(
        async (transaction) => {
          const created = await createEntry(transaction);
          if (input.requestId) {
            await accessRequestsService.markGrantedForRequest(
              actorId,
              input.requestId,
              created.value,
              transaction
            );
          } else {
            await accessRequestsService.markGrantedForEmail(
              actorId,
              created.value,
              transaction
            );
          }
          return created;
        }
      );
    } else {
      entry = await createEntry();
    }

    await notifyIfEmailAllowlisted(entry);

    return entry;
  }

  async updateAccessAllowlist(
    actorId: string,
    id: string,
    input: UpdateAccessAllowlistInput
  ): Promise<AccessAllowlistRow> {
    const { actor, entry: previous } = await this.requireAdminAllowlistEntry(
      actorId,
      id
    );
    rejectOwnDomainLockout(previous, actor.email, {
      nextStatus: input.status,
    });

    const updateEntry = (transaction?: AccessAllowlistTransaction) =>
      this.accessAllowlistRepository.update(
        {
          actorId,
          id,
          label: input.label,
          expires_at: input.expires_at,
          allowed_project_ids: input.allowed_project_ids,
          status: input.status,
          expectedUpdatedAt: input.expectedUpdatedAt,
        },
        transaction
      );
    const isReactivatingEmail =
      previous.kind === 'email' &&
      input.status === RecordStatusEnum.active &&
      previous.status !== RecordStatusEnum.active;
    const accessRequestsService = this.accessRequestsService;

    let entry: AccessAllowlistRow;
    if (isReactivatingEmail && accessRequestsService) {
      entry = await this.accessAllowlistRepository.withTransaction(
        async (transaction) => {
          const updated = await updateEntry(transaction);
          await accessRequestsService.markGrantedForEmail(
            actorId,
            updated.value,
            transaction
          );
          return updated;
        }
      );
    } else {
      entry = await updateEntry();
    }

    if (
      input.status === RecordStatusEnum.active &&
      previous.status !== RecordStatusEnum.active
    ) {
      await notifyIfEmailAllowlisted(entry);
    }

    return entry;
  }

  async deleteAccessAllowlist(
    actorId: string,
    id: string,
    expectedUpdatedAt: string
  ): Promise<void> {
    const { actor, entry } = await this.requireAdminAllowlistEntry(actorId, id);
    rejectOwnDomainLockout(entry, actor.email, { deleting: true });

    return await this.accessAllowlistRepository.hardDelete({
      id,
      expectedUpdatedAt,
    });
  }
}
