import { describe, expect, it } from 'vitest';

import {
  SEED_SQUAD_MEMBERS,
  seedEmailFromName,
  squadSeedUsers,
} from '../src/seed-squad.js';

describe('seedEmailFromName', () => {
  it('uses firstname plus last-name initial on alice.dev', () => {
    expect(seedEmailFromName('Thibaut Courtois')).toBe('thibaut.c@alice.dev');
    expect(seedEmailFromName('Jude Bellingham')).toBe('jude.b@alice.dev');
  });

  it('folds accents and omits the last initial for single-token names', () => {
    expect(seedEmailFromName('Éder Militão')).toBe('eder.m@alice.dev');
    expect(seedEmailFromName('Vinícius Júnior')).toBe('vinicius.j@alice.dev');
    expect(seedEmailFromName('Kylian Mbappé')).toBe('kylian.m@alice.dev');
    expect(seedEmailFromName('Rodrygo')).toBe('rodrygo@alice.dev');
  });
});

describe('squadSeedUsers', () => {
  it('assigns a unique email to every squad member', () => {
    const users = squadSeedUsers();
    const emails = users.map((user) => user.email);

    expect(users).toHaveLength(SEED_SQUAD_MEMBERS.length);
    expect(new Set(emails).size).toBe(emails.length);
  });
});
