import type { UserRole } from '../../users.js';
import type { BoardRuleMatcher } from './board-config.js';

/** Actor facts needed to evaluate role / team / user matchers. */
export type TransitionRuleActorContext = {
  readonly role: UserRole;
  readonly isActiveProjectMember: boolean;
  readonly activeTeamIds: readonly string[];
};

/**
 * Whether any matcher in `allowAnyOf` authorizes the actor.
 * Callers that treat empty `allowAnyOf` as "everyone" must skip this
 * (or use {@link isTransitionAllowedForActor}).
 */
export function doesTransitionRuleAllowActor(
  allowAnyOf: readonly BoardRuleMatcher[],
  actor: TransitionRuleActorContext | null,
  actorId: string
): boolean {
  if (!actor) {
    return false;
  }

  const activeTeamIds = new Set(
    actor.activeTeamIds.map((teamId) => teamId.toLowerCase())
  );
  return allowAnyOf.some((matcher) => {
    if (matcher.scope === 'role') {
      return matcher.role === actor.role;
    }
    if (matcher.scope === 'team') {
      return activeTeamIds.has(matcher.teamId.toLowerCase());
    }
    return (
      actor.isActiveProjectMember &&
      matcher.userId.toLowerCase() === actorId.toLowerCase()
    );
  });
}

/**
 * Empty `allowAnyOf` means everyone may take the transition.
 * Non-empty lists require at least one matching role, team, or user.
 */
export function isTransitionAllowedForActor(
  allowAnyOf: readonly BoardRuleMatcher[],
  actor: TransitionRuleActorContext | null,
  actorId: string
): boolean {
  if (allowAnyOf.length === 0) {
    return true;
  }
  return doesTransitionRuleAllowActor(allowAnyOf, actor, actorId);
}
