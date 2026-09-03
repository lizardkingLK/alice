import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AccessAllowlistService } from '../../src/routes/api/accessAllowlist/accessAllowlist.service';
import type { AccessAllowlistRepository } from '../../src/routes/api/accessAllowlist/accessAllowlist.repository';
import { EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE } from '@repo/types';

const {
  createMock,
  updateMock,
  findByIdMock,
  hardDeleteMock,
  findActiveDomainByValueMock,
  notifyMock,
  selectSingleMock,
} = vi.hoisted(() => ({
  createMock: vi.fn(),
  updateMock: vi.fn(),
  findByIdMock: vi.fn(),
  hardDeleteMock: vi.fn(),
  findActiveDomainByValueMock: vi.fn(),
  notifyMock: vi.fn(),
  selectSingleMock: vi.fn(),
}));

vi.mock('../../src/lib/supabase', () => ({
  supabase: {
    from: vi.fn(() => ({
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: selectSingleMock,
        })),
      })),
    })),
  },
}));

vi.mock(
  '../../src/routes/api/accessAllowlist/notify-allowlisted-email',
  () => ({
    notifyAllowlistedEmail: notifyMock,
  })
);

const repository = {
  create: createMock,
  update: updateMock,
  findById: findByIdMock,
  hardDelete: hardDeleteMock,
  findActiveDomainByValue: findActiveDomainByValueMock,
} as unknown as AccessAllowlistRepository;

const accessRequestsService = {
  markGrantedForEmail: vi.fn(),
} as never;

const emailEntry = {
  id: 'allow-1',
  kind: 'email' as const,
  value: 'client@partner.com',
  label: 'Pilot',
  expires_at: null,
  allowed_project_ids: null,
  status: 'active' as const,
  created_by: 'admin-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'admin-1',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('AccessAllowlistService admission email', () => {
  const service = new AccessAllowlistService(repository, accessRequestsService);

  beforeEach(() => {
    vi.clearAllMocks();
    findActiveDomainByValueMock.mockResolvedValue(null);
    selectSingleMock.mockResolvedValue({
      data: { role: 'admin', email: 'admin@alice.dev' },
      error: null,
    });
    notifyMock.mockResolvedValue(undefined);
  });

  it('emails an active email row after create', async () => {
    createMock.mockResolvedValue(emailEntry);

    await service.createAccessAllowlist('admin-1', {
      kind: 'email',
      value: 'client@partner.com',
    });

    expect(notifyMock).toHaveBeenCalledWith('client@partner.com');
  });

  it('rejects email create when the domain is already allowlisted', async () => {
    findActiveDomainByValueMock.mockResolvedValue({
      id: 'domain-1',
      kind: 'domain',
      value: 'partner.com',
      status: 'active',
    });

    await expect(
      service.createAccessAllowlist('admin-1', {
        kind: 'email',
        value: 'client@partner.com',
      })
    ).rejects.toThrow(EMAIL_ALLOWLIST_DOMAIN_CONFLICT_MESSAGE);

    expect(createMock).not.toHaveBeenCalled();
  });

  it('does not email domain rows', async () => {
    createMock.mockResolvedValue({
      ...emailEntry,
      kind: 'domain',
      value: 'acme.com',
    });

    await service.createAccessAllowlist('admin-1', {
      kind: 'domain',
      value: 'acme.com',
    });

    expect(notifyMock).not.toHaveBeenCalled();
  });

  it('emails when an email row is reactivated', async () => {
    findByIdMock.mockResolvedValue({ ...emailEntry, status: 'inactive' });
    updateMock.mockResolvedValue(emailEntry);

    await service.updateAccessAllowlist('admin-1', 'allow-1', {
      status: 'active',
      expectedUpdatedAt: emailEntry.updated_at,
    });

    expect(notifyMock).toHaveBeenCalledWith('client@partner.com');
  });

  it('does not email when an already-active row is edited', async () => {
    findByIdMock.mockResolvedValue(emailEntry);
    updateMock.mockResolvedValue({ ...emailEntry, label: 'Updated' });

    await service.updateAccessAllowlist('admin-1', 'allow-1', {
      label: 'Updated',
      status: 'active',
      expectedUpdatedAt: emailEntry.updated_at,
    });

    expect(notifyMock).not.toHaveBeenCalled();
  });
});

describe('AccessAllowlistService delete own domain', () => {
  const service = new AccessAllowlistService(repository, accessRequestsService);
  const domainEntry = {
    ...emailEntry,
    kind: 'domain' as const,
    value: 'alice.dev',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    selectSingleMock.mockResolvedValue({
      data: { role: 'admin', email: 'admin@alice.dev' },
      error: null,
    });
  });

  it('rejects deleting the domain that matches the actor email', async () => {
    findByIdMock.mockResolvedValue(domainEntry);

    await expect(
      service.deleteAccessAllowlist(
        'admin-1',
        domainEntry.id,
        domainEntry.updated_at
      )
    ).rejects.toThrow(
      'You cannot delete or deactivate the domain that matches your email.'
    );

    expect(hardDeleteMock).not.toHaveBeenCalled();
  });

  it('deletes a domain that is not the actor email domain', async () => {
    findByIdMock.mockResolvedValue({ ...domainEntry, value: 'partner.com' });
    hardDeleteMock.mockResolvedValue(undefined);

    await service.deleteAccessAllowlist(
      'admin-1',
      domainEntry.id,
      domainEntry.updated_at
    );

    expect(hardDeleteMock).toHaveBeenCalledWith({
      id: domainEntry.id,
      expectedUpdatedAt: domainEntry.updated_at,
    });
  });

  it('deletes an email row even when the domain matches', async () => {
    findByIdMock.mockResolvedValue({
      ...emailEntry,
      value: 'admin@alice.dev',
    });
    hardDeleteMock.mockResolvedValue(undefined);

    await service.deleteAccessAllowlist(
      'admin-1',
      emailEntry.id,
      emailEntry.updated_at
    );

    expect(hardDeleteMock).toHaveBeenCalled();
  });

  it('rejects deactivating the domain that matches the actor email', async () => {
    findByIdMock.mockResolvedValue(domainEntry);

    await expect(
      service.updateAccessAllowlist('admin-1', domainEntry.id, {
        status: 'inactive',
        expectedUpdatedAt: domainEntry.updated_at,
      })
    ).rejects.toThrow(
      'You cannot delete or deactivate the domain that matches your email.'
    );

    expect(updateMock).not.toHaveBeenCalled();
  });

  it('allows label edits on the actor own domain while status stays active', async () => {
    findByIdMock.mockResolvedValue(domainEntry);
    updateMock.mockResolvedValue({ ...domainEntry, label: 'Company' });

    await service.updateAccessAllowlist('admin-1', domainEntry.id, {
      label: 'Company',
      status: 'active',
      expectedUpdatedAt: domainEntry.updated_at,
    });

    expect(updateMock).toHaveBeenCalled();
  });
});
