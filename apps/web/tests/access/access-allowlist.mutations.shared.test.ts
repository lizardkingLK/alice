import { describe, expect, it, vi } from 'vitest';
import { createAccessAllowlistService } from '@/app/access-allowlist/_services/access-allowlist.mutations.shared';
import { accessAllowlistFactory } from '../factories/accessAllowlist.factory';

describe('createAccessAllowlistService', () => {
  it('creates an allowlist entry via POST', async () => {
    // Arrange
    const entry = accessAllowlistFactory.build();
    const apiFetch = vi.fn().mockResolvedValue({ entry });
    const service = createAccessAllowlistService(apiFetch);
    const input = {
      kind: 'domain' as const,
      value: 'acme.com',
      label: 'Acme corp',
    };

    // Act
    const created = await service.createAccessAllowlistEntry(input);

    // Assert
    expect(apiFetch).toHaveBeenCalledWith('/api/accessAllowlist', {
      method: 'POST',
      body: JSON.stringify(input),
    });
    expect(created).toEqual(entry);
  });

  it('updates an allowlist entry via PUT', async () => {
    // Arrange
    const entry = accessAllowlistFactory.build({ label: 'Updated' });
    const apiFetch = vi.fn().mockResolvedValue({ entry });
    const service = createAccessAllowlistService(apiFetch);
    const input = { label: 'Updated', status: 'inactive' as const };

    // Act
    const updated = await service.updateAccessAllowlistEntry(
      entry.id,
      input,
      '2024-01-01T00:00:00.000Z'
    );

    // Assert
    expect(apiFetch).toHaveBeenCalledWith(`/api/accessAllowlist/${entry.id}`, {
      method: 'PUT',
      body: JSON.stringify({
        ...input,
        expectedUpdatedAt: '2024-01-01T00:00:00.000Z',
      }),
    });
    expect(updated).toEqual(entry);
  });

  it('deletes an allowlist entry via DELETE', async () => {
    // Arrange
    const apiFetch = vi.fn().mockResolvedValue({ success: true });
    const service = createAccessAllowlistService(apiFetch);

    // Act
    await service.deleteAccessAllowlistEntry(
      'allowlist-123',
      '2024-01-02T00:00:00.000Z'
    );

    // Assert
    expect(apiFetch).toHaveBeenCalledWith(
      '/api/accessAllowlist/allowlist-123',
      {
        method: 'DELETE',
        body: JSON.stringify({
          expectedUpdatedAt: '2024-01-02T00:00:00.000Z',
        }),
      }
    );
  });
});
