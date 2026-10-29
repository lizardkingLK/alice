import { type UserRole } from '@repo/types';
import { supabase } from './supabase';

const POSTGREST_SINGLE_ROW_NOT_FOUND = 'PGRST116';

export class ActorUserNotFoundError extends Error {
  constructor() {
    super('Not authenticated.');
    this.name = 'ActorUserNotFoundError';
  }
}

export class ActorUserLookupError extends Error {
  constructor() {
    super('Failed to load authenticated user.');
    this.name = 'ActorUserLookupError';
  }
}

export class UserRoleDeniedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'UserRoleDeniedError';
  }
}

export async function getActorUser(
  actorId: string
): Promise<{ id: string; role: UserRole; email: string }> {
  const { data: user, error } = await supabase
    .from('users')
    .select('role, email')
    .eq('id', actorId)
    .single();

  if (error) {
    if (error.code === POSTGREST_SINGLE_ROW_NOT_FOUND) {
      throw new ActorUserNotFoundError();
    }
    throw new ActorUserLookupError();
  }
  if (!user) {
    throw new ActorUserNotFoundError();
  }

  return {
    id: actorId,
    role: user.role as UserRole,
    email: user.email,
  };
}

export async function requireUserWithRole(
  actorId: string,
  allowedRoles: UserRole[],
  errorMessage: string
) {
  const user = await getActorUser(actorId);

  if (!allowedRoles.includes(user.role)) {
    throw new UserRoleDeniedError(errorMessage);
  }
  return user;
}
