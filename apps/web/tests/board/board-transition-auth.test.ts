import { describe, expect, it } from 'vitest';
import type { TransitionRuleActorContext } from '@repo/types/api/v1';
import {
  isBoardTransitionLocallyAllowed,
  type BoardTransitionAuthRule,
} from '@/app/board/_helpers/board-transition-auth';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const FROM = 'state-todo';
const TO = 'state-done';

const actor: TransitionRuleActorContext = {
  role: 'member',
  isActiveProjectMember: true,
  activeTeamIds: [],
};

const restrictedRules: BoardTransitionAuthRule[] = [
  {
    from: FROM,
    to: TO,
    allowAnyOf: [{ scope: 'role', role: 'manager' }],
  },
];

describe('isBoardTransitionLocallyAllowed', () => {
  it('allows when rules list is empty', () => {
    expect(isBoardTransitionLocallyAllowed([], FROM, TO, actor, ACTOR_ID)).toBe(
      true
    );
  });

  it('allows when no rule matches the from/to pair', () => {
    expect(
      isBoardTransitionLocallyAllowed(
        restrictedRules,
        FROM,
        'other',
        actor,
        ACTOR_ID
      )
    ).toBe(true);
  });

  it('allows when the matching edge has empty allowAnyOf', () => {
    expect(
      isBoardTransitionLocallyAllowed(
        [{ from: FROM, to: TO, allowAnyOf: [] }],
        FROM,
        TO,
        actor,
        ACTOR_ID
      )
    ).toBe(true);
  });

  it('denies when restricted and actor does not match', () => {
    expect(
      isBoardTransitionLocallyAllowed(
        restrictedRules,
        FROM,
        TO,
        actor,
        ACTOR_ID
      )
    ).toBe(false);
  });

  it('allows when restricted and actor matches', () => {
    expect(
      isBoardTransitionLocallyAllowed(
        restrictedRules,
        FROM,
        TO,
        { ...actor, role: 'manager' },
        ACTOR_ID
      )
    ).toBe(true);
  });

  it('allows when from id or actor id is missing (API still enforces)', () => {
    expect(
      isBoardTransitionLocallyAllowed(
        restrictedRules,
        null,
        TO,
        actor,
        ACTOR_ID
      )
    ).toBe(true);
    expect(
      isBoardTransitionLocallyAllowed(restrictedRules, FROM, TO, actor, null)
    ).toBe(true);
  });
});
