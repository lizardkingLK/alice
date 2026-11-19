import { describe, expect, it } from 'vitest';
import {
  doesTransitionRuleAllowActor,
  isTransitionAllowedForActor,
  type TransitionRuleActorContext,
} from '@repo/types/api/v1';

const ACTOR_ID = '11111111-1111-4111-8111-111111111111';
const TEAM_ID = '22222222-2222-4222-8222-222222222222';
const OTHER_USER = '33333333-3333-4333-8333-333333333333';

const memberActor: TransitionRuleActorContext = {
  role: 'member',
  isActiveProjectMember: true,
  activeTeamIds: [TEAM_ID],
};

describe('doesTransitionRuleAllowActor', () => {
  it('denies when actor is null', () => {
    expect(
      doesTransitionRuleAllowActor(
        [{ scope: 'role', role: 'member' }],
        null,
        ACTOR_ID
      )
    ).toBe(false);
  });

  it('allows when role matcher hits', () => {
    expect(
      doesTransitionRuleAllowActor(
        [{ scope: 'role', role: 'member' }],
        memberActor,
        ACTOR_ID
      )
    ).toBe(true);
  });

  it('allows when team matcher hits (case-insensitive)', () => {
    expect(
      doesTransitionRuleAllowActor(
        [{ scope: 'team', teamId: TEAM_ID.toUpperCase() }],
        memberActor,
        ACTOR_ID
      )
    ).toBe(true);
  });

  it('allows when user matcher hits for an active project member', () => {
    expect(
      doesTransitionRuleAllowActor(
        [{ scope: 'user', userId: ACTOR_ID }],
        memberActor,
        ACTOR_ID
      )
    ).toBe(true);
  });

  it('denies user matcher when actor is not an active project member', () => {
    expect(
      doesTransitionRuleAllowActor(
        [{ scope: 'user', userId: ACTOR_ID }],
        { ...memberActor, isActiveProjectMember: false },
        ACTOR_ID
      )
    ).toBe(false);
  });

  it('denies when no matcher hits', () => {
    expect(
      doesTransitionRuleAllowActor(
        [
          { scope: 'role', role: 'manager' },
          { scope: 'user', userId: OTHER_USER },
        ],
        memberActor,
        ACTOR_ID
      )
    ).toBe(false);
  });
});

describe('isTransitionAllowedForActor', () => {
  it('allows everyone when allowAnyOf is empty', () => {
    expect(isTransitionAllowedForActor([], null, ACTOR_ID)).toBe(true);
  });

  it('requires a matcher hit when restricted', () => {
    expect(
      isTransitionAllowedForActor(
        [{ scope: 'role', role: 'admin' }],
        memberActor,
        ACTOR_ID
      )
    ).toBe(false);
  });
});
