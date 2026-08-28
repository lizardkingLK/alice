import { redirect } from 'next/navigation';
import { EditProfileData } from '@/app/edit-profile/_components/edit-profile-data';
import { SettingsIntegrationsView } from '@/app/settings/_components/settings-integrations-view';
import { SettingsWorkspace } from '@/app/settings/_components/settings-workspace';
import { getDbUser, getUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import { isAdmin } from '@/lib/rbac';
import { parseSettingsTab, type RawSearchParams } from '@/lib/search-params';

type SettingsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function SettingsData({
  searchParams,
}: Readonly<SettingsDataProps>) {
  const resolved = await searchParams;
  const requestedTab = parseSettingsTab(resolved.tab);

  const [user, dbUser] = await Promise.all([getUser(), getDbUser()]);
  if (!user || !dbUser) {
    redirect(buildLoginPath(await getRequestPathForLoginNext()));
  }

  const userIsAdmin = isAdmin(dbUser.role);
  const tab =
    requestedTab === 'integrations' && !userIsAdmin ? 'general' : requestedTab;

  return (
    <SettingsWorkspace activeTab={tab} isAdmin={userIsAdmin}>
      {tab === 'integrations' ? (
        <SettingsIntegrationsView />
      ) : (
        <EditProfileData section={tab} />
      )}
    </SettingsWorkspace>
  );
}
