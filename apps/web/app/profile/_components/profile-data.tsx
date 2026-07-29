import { redirect } from 'next/navigation';
import { ProfileView } from '@/app/profile/_components/profile-view';
import {
  getProfileTeams,
  getProfileWorkedOn,
} from '@/app/profile/_services/profile.service.server';
import {
  displayHandleFromEmail,
  metadataString,
} from '@/app/profile/_helpers/profile-identity';
import { getDbUser, getUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import { safeServerFetch } from '@/lib/safe-server-fetch';

export async function ProfileData() {
  const [user, dbUser] = await Promise.all([getUser(), getDbUser()]);

  if (!user) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? dbUser?.email ?? '';
  const name =
    dbUser?.name ?? metadataString(metadata, 'name', 'full_name') ?? email;
  const avatarUrl = dbUser?.profile_picture ?? null;
  const role = dbUser?.role ?? metadataString(metadata, 'role') ?? 'member';
  const provider = user.app_metadata?.provider ?? 'email';
  const emailVerified =
    Boolean(user.email_confirmed_at) || metadata.email_verified === true;

  const [teams, workedOn] = await Promise.all([
    safeServerFetch(getProfileTeams(user.id), [], 'fetch profile teams'),
    safeServerFetch(getProfileWorkedOn(user.id), [], 'fetch profile worked-on'),
  ]);

  return (
    <ProfileView
      name={name}
      handle={displayHandleFromEmail(email)}
      email={email}
      phone={user.phone || null}
      avatarUrl={avatarUrl}
      role={role}
      provider={provider}
      emailVerified={emailVerified}
      memberSince={user.created_at ?? null}
      teams={teams}
      workedOn={workedOn}
    />
  );
}
