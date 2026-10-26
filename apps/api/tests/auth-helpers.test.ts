import { beforeEach, describe, expect, it, vi } from 'vitest';

const { fromMock, singleMock } = vi.hoisted(() => {
  const singleMock = vi.fn();
  const eqMock = vi.fn(() => ({ single: singleMock }));
  const selectMock = vi.fn(() => ({ eq: eqMock }));
  const fromMock = vi.fn(() => ({ select: selectMock }));
  return { fromMock, singleMock };
});

vi.mock('../src/lib/supabase', () => ({
  supabase: { from: fromMock },
}));

import {
  ActorUserLookupError,
  ActorUserNotFoundError,
  getActorUser,
} from '../src/lib/auth-helpers';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';

describe('auth helpers', () => {
  beforeEach(() => vi.clearAllMocks());

  it('returns an existing Alice profile', async () => {
    singleMock.mockResolvedValueOnce({
      data: { role: 'manager', email: 'manager@alice.dev' },
      error: null,
    });

    await expect(getActorUser(ACTOR_ID)).resolves.toEqual({
      id: ACTOR_ID,
      role: 'manager',
      email: 'manager@alice.dev',
    });
  });

  it('distinguishes a missing profile from a lookup failure', async () => {
    singleMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST116', message: 'zero rows' },
    });
    await expect(getActorUser(ACTOR_ID)).rejects.toBeInstanceOf(
      ActorUserNotFoundError
    );

    singleMock.mockResolvedValueOnce({
      data: null,
      error: { code: 'PGRST500', message: 'database unavailable' },
    });
    await expect(getActorUser(ACTOR_ID)).rejects.toBeInstanceOf(
      ActorUserLookupError
    );
  });
});
