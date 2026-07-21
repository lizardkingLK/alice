import { redirect } from 'next/navigation';
import { DashboardShell } from '@/app/dashboard/_components/dashboard-shell';
import { ProfileView } from '@/app/profile/_components/profile-view';
import {
  getProfileTeams,
  getProfileWorkedOn,
} from '@/app/profile/_services/profile.service.server';
import { getDbUser, getUser } from '@/lib/auth';
import { safeServerFetch } from '@/lib/safe-server-fetch';

function metadataString(
  metadata: Record<string, unknown>,
  ...keys: string[]
): string | null {
  for (const key of keys) {
    const value = metadata[key];
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }
  return null;
}

function handleFromEmail(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local ? `@${local}` : '@user';
}

export default async function ProfilePage() {
  const [user, dbUser] = await Promise.all([getUser(), getDbUser()]);

  if (!user) {
    redirect('/login');
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? dbUser?.email ?? '';
  const name =
    dbUser?.name ?? metadataString(metadata, 'name', 'full_name') ?? email;
  const avatarUrl =
    dbUser?.profile_picture ??
    metadataString(metadata, 'avatar_url', 'picture');
  const role =
    dbUser?.role ?? metadataString(metadata, 'role') ?? 'member';
  const provider = user.app_metadata?.provider ?? 'email';
  const emailVerified =
    Boolean(user.email_confirmed_at) || metadata.email_verified === true;

  const [teams, workedOn] = await Promise.all([
    safeServerFetch(getProfileTeams(user.id), [], 'fetch profile teams'),
    safeServerFetch(getProfileWorkedOn(user.id), [], 'fetch profile worked-on'),
  ]);

  return (
    <DashboardShell
      description="Your profile and account details."
      sidebarDefaultOpen={false}
      contentClassName="p-0"
    >
      <ProfileView
        name={name}
        handle={handleFromEmail(email)}
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
    </DashboardShell>
  );
}
