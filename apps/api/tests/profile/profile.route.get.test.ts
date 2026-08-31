import { beforeEach, describe, expect, it, vi } from 'vitest';

const { getOwnProfileMock } = vi.hoisted(() => ({
  getOwnProfileMock: vi.fn(),
}));

vi.mock('../../src/middlewares/auth', async () => {
  const { mockRequireApiAuth } = await import('../helpers/mock-api-auth.js');
  return { requireApiAuth: mockRequireApiAuth };
});

vi.mock('../../src/routes/api/profile/profile.service', () => ({
  ProfileService: class {
    getOwnProfile = getOwnProfileMock;
  },
}));

import { createProfileRouter } from '../../src/routes/api/profile/profile.route';
import type { ProfileService } from '../../src/routes/api/profile/profile.service';
import { createProfileDetailRow } from '../factories/profile.factory';
import { MOCK_AUTH_USER_ID } from '../helpers/mock-api-auth';
import { withMountedRouter } from '../helpers/route-test.harness';

const profileService = {
  getOwnProfile: getOwnProfileMock,
} as unknown as ProfileService;

const profileRouter = createProfileRouter({ profileService });

describe('profile unused Prisma self GET route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns the signed-in user profile', async () => {
    const row = createProfileDetailRow();
    getOwnProfileMock.mockResolvedValue(row);

    await withMountedRouter('/api/profile', profileRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/profile`);
      const body = await response.json();

      expect(response.status).toBe(200);
      expect(body).toEqual(JSON.parse(JSON.stringify(row)));
      expect(getOwnProfileMock).toHaveBeenCalledWith(MOCK_AUTH_USER_ID);
    });
  });

  it('returns 404 when the profile is missing', async () => {
    getOwnProfileMock.mockResolvedValue(null);

    await withMountedRouter('/api/profile', profileRouter, async (baseUrl) => {
      const response = await fetch(`${baseUrl}/api/profile`);
      expect(response.status).toBe(404);
    });
  });
});
