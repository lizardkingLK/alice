import {
  isTransitionAllowedForActor,
  type BoardRuleMatcher,
  type TransitionRuleActorContext,
} from '@repo/types/api/v1';

/** Compact edge auth for client-side move checks (from/to = state or column ids). */
export type BoardTransitionAuthRule = {
  readonly from: string;
  readonly to: string;
  readonly allowAnyOf: readonly BoardRuleMatcher[];
};

export function findBoardTransitionAuthRule(
  rules: readonly BoardTransitionAuthRule[],
  fromId: string,
  toId: string
): BoardTransitionAuthRule | null {
  return rules.find((rule) => rule.from === fromId && rule.to === toId) ?? null;
}

/**
 * Local pre-check before calling the status API.
 * Missing rules (no matching edge) do not deny — the API still validates graph.
 * Empty allowAnyOf means everyone.
 */
export function isBoardTransitionLocallyAllowed(
  rules: readonly BoardTransitionAuthRule[],
  fromId: string | null,
  toId: string,
  actor: TransitionRuleActorContext | null,
  actorId: string | null
): boolean {
  if (!fromId || !actorId) {
    return true;
  }

  const rule = findBoardTransitionAuthRule(rules, fromId, toId);
  if (!rule) {
    return true;
  }

  return isTransitionAllowedForActor(rule.allowAnyOf, actor, actorId);
}
