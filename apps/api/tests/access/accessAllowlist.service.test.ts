import { beforeEach, describe, expect, it, vi } from 'vitest';

const { createMock, updateMock, findByIdMock, notifyMock, selectSingleMock } =
  vi.hoisted(() => ({
    createMock: vi.fn(),
    updateMock: vi.fn(),
    findByIdMock: vi.fn(),
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
  '../../src/routes/api/accessAllowlist/accessAllowlist.repository',
  () => ({
    accessAllowlistRepository: {
      create: createMock,
      update: updateMock,
      findById: findByIdMock,
    },
  })
);

vi.mock(
  '../../src/routes/api/accessAllowlist/notify-allowlisted-email',
  () => ({
    notifyAllowlistedEmail: notifyMock,
  })
);

import { AccessAllowlistService } from '../../src/routes/api/accessAllowlist/accessAllowlist.service';

const emailEntry = {
  id: 'allow-1',
  kind: 'email' as const,
  value: 'client@partner.com',
  label: 'Pilot',
  expires_at: null,
  status: 'active' as const,
  created_by: 'admin-1',
  created_at: '2026-01-01T00:00:00.000Z',
  updated_by: 'admin-1',
  updated_at: '2026-01-01T00:00:00.000Z',
};

describe('AccessAllowlistService admission email', () => {
  const service = new AccessAllowlistService();

  beforeEach(() => {
    vi.clearAllMocks();
    selectSingleMock.mockResolvedValue({
      data: { role: 'admin' },
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
