import { describe, expect, it } from 'vitest';
import { createTeamSchema } from '@repo/types';

const validTeamInput = {
  name: 'Development',
  description: null,
  manager_id: '11111111-1111-4111-8111-111111111111',
  project_id: '22222222-2222-4222-8222-222222222222',
  tech_stack: null,
  status: 'active' as const,
};

describe('createTeamSchema', () => {
  it.each(['  ', ' A ', '', 'A'])(
    'rejects a team name shorter than two characters after trimming: %j',
    (name) => {
      const parsed = createTeamSchema.safeParse({
        ...validTeamInput,
        name,
      });

      expect(parsed.success).toBe(false);
      if (!parsed.success) {
        expect(parsed.error.issues).toEqual(
          expect.arrayContaining([
            expect.objectContaining({
              path: ['name'],
              message: 'Name must be at least 2 characters.',
            }),
          ])
        );
      }
    }
  );

  it('accepts a two-character team name', () => {
    const parsed = createTeamSchema.safeParse({
      ...validTeamInput,
      name: 'AB',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('AB');
    }
  });

  it('accepts and normalizes a padded valid team name', () => {
    const parsed = createTeamSchema.safeParse({
      ...validTeamInput,
      name: '  Development  ',
    });

    expect(parsed.success).toBe(true);
    if (parsed.success) {
      expect(parsed.data.name).toBe('Development');
    }
  });

  it('preserves standalone team support for both membership formats', () => {
    const parsed = createTeamSchema.safeParse({
      ...validTeamInput,
      member_ids: ['33333333-3333-4333-8333-333333333333'],
      members: [
        {
          user_id: '44444444-4444-4444-8444-444444444444',
          allocation: 50,
        },
      ],
    });

    expect(parsed.success).toBe(true);
  });
});
