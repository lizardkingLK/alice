import type { User } from '@/app/users/_services/users.service';

export const userFactory = {
  build(overrides: Partial<User> = {}): User {
    return {
      id: 'user-123',
      name: 'Erlich Bachman',
      email: 'erlich@bachmanity.com',
      role: 'member',
      active: true,
      created_at: '2026-07-09T10:00:00Z',
      updated_at: '2026-07-09T10:00:00Z',
      created_by: null,
      profile_picture: null,
      status: 'active',
      updated_by: null,
      ...overrides,
    };
  },

  buildList(count: number, overrides: Partial<User> = {}): User[] {
    return Array.from({ length: count }, (_, index) =>
      userFactory.build({
        id: `user-${index + 1}`,
        name: `User ${index + 1}`,
        email: `user${index + 1}@example.com`,
        ...overrides,
      })
    );
  },
};
