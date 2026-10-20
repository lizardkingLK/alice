/**
 * Minimal user shape used to enrich flat postgres_changes rows
 * (comments author, activity actor, work-log user).
 */
export type RealtimeUserLookup = {
  readonly id: string;
  readonly name: string;
  readonly email?: string;
  readonly profile_picture?: string | null;
  readonly role?: string;
};

export type RealtimeUserResolved = {
  readonly id: string;
  readonly name: string;
  readonly email: string;
  readonly profile_picture: string | null;
  readonly role?: string;
};

/**
 * Resolve a user id against a local lookup list. Missing ids become
 * `{ name: 'Unknown', … }` so feed UIs still render.
 */
export function resolveRealtimeUserLookup(
  userId: string,
  users: readonly RealtimeUserLookup[]
): RealtimeUserResolved {
  const match = users.find((user) => user.id === userId);
  if (!match) {
    return {
      id: userId,
      name: 'Unknown',
      email: '',
      profile_picture: null,
    };
  }
  return {
    id: match.id,
    name: match.name,
    email: match.email ?? '',
    profile_picture: match.profile_picture ?? null,
    ...(match.role !== undefined ? { role: match.role } : {}),
  };
}
