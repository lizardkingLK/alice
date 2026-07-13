import { env } from '../../config/env';
import { createClient } from '@supabase/supabase-js';
import type { NextFunction, Request, Response } from 'express';
import { supabase as dbSupabase } from '../../lib/supabase';
import { auditCreate } from '../../lib/audit';

export type AuthenticatedRequest = Request & {
  userId?: string;
};

export async function requireApiAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const supabase = createClient(env.SUPABASE_URL, env.SUPABASE_ANON_KEY);

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser(token);

  if (error || !user) {
    console.error('API Auth Error:', error);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  // Ensure user profile exists in public.users table
  try {
    const { data: existingUser, error: dbError } = await dbSupabase
      .from('users')
      .select('id')
      .eq('id', user.id)
      .maybeSingle();

    if (dbError) {
      console.error('Error looking up public user profile:', dbError.message);
    } else if (!existingUser) {
      const metadataName = user.user_metadata?.name;
      const displayName =
        typeof metadataName === 'string' && metadataName.trim().length >= 2
          ? metadataName.trim()
          : user.email?.split('@')[0]?.trim() || 'New User';

      const metadataRole = user.user_metadata?.role;
      const role =
        typeof metadataRole === 'string' &&
        ['admin', 'manager', 'member'].includes(metadataRole)
          ? (metadataRole as 'admin' | 'manager' | 'member')
          : 'member';

      const { error: insertError } = await dbSupabase.from('users').insert({
        id: user.id,
        email: user.email || '',
        name: displayName,
        role,
        active: true,
        ...auditCreate(user.id),
      });

      if (insertError) {
        console.error(
          'Failed to auto-create public user profile:',
          insertError.message
        );
        res.status(500).json({ error: 'Failed to initialize user profile' });
        return;
      }
    }
  } catch (error) {
    console.error(
      'Exception during public user profile check/creation:',
      error
    );
    res.status(500).json({ error: 'Failed to verify user profile' });
    return;
  }

  req.userId = user.id;
  next();
}
