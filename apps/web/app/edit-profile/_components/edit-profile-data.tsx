import { redirect } from 'next/navigation';
import { EditProfileView } from '@/app/edit-profile/_components/edit-profile-view';
import {
  handleFromEmail,
  metadataString,
} from '@/app/profile/_helpers/profile-identity';
import { getDbUser, getUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import type { AccountSettingsTab } from '@/lib/search-params';

type EditProfileDataProps = {
  readonly section: AccountSettingsTab;
};

export async function EditProfileData({
  section,
}: Readonly<EditProfileDataProps>) {
  const [user, dbUser] = await Promise.all([getUser(), getDbUser()]);

  if (!user || !dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const metadata = (user.user_metadata ?? {}) as Record<string, unknown>;
  const email = user.email ?? dbUser.email;
  const name =
    dbUser.name || metadataString(metadata, 'name', 'full_name') || email;
  const emailVerified =
    Boolean(user.email_confirmed_at) || metadata.email_verified === true;

  return (
    <EditProfileView
      section={section}
      name={name}
      handle={handleFromEmail(email)}
      email={email}
      emailVerified={emailVerified}
      role={dbUser.role}
      avatarUrl={dbUser.profile_picture ?? null}
      userId={dbUser.id}
      updatedAt={dbUser.updated_at}
    />
  );
}
