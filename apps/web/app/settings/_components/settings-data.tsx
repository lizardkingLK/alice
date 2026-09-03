import { redirect } from 'next/navigation';
import { EditProfileData } from '@/app/edit-profile/_components/edit-profile-data';
import { SettingsIntegrationsView } from '@/app/settings/_components/settings-integrations-view';
import { SettingsWorkspace } from '@/app/settings/_components/settings-workspace';
import { listWorkspaceIntegrations } from '@/app/settings/_services/integrations.reads.server';
import { getDbUser, getUser } from '@/lib/auth';
import { buildLoginPath } from '@/lib/auth-redirect';
import { getRequestPathForLoginNext } from '@/lib/auth-redirect.server';
import { isAdmin } from '@/lib/rbac';
import { parseIntegrationsCategoryFilter } from '@/app/settings/_services/settings-integrations-navigation.shared';
import {
  parseSettingsTab,
  resolveSettingsTabForUser,
  type RawSearchParams,
} from '@/lib/search-params';

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
  const tab = resolveSettingsTabForUser(requestedTab, userIsAdmin);
  const initialCategoryFilter = parseIntegrationsCategoryFilter(
    resolved.category
  );

  const workspaceIntegrations =
    tab === 'integrations' && userIsAdmin
      ? await listWorkspaceIntegrations()
      : [];

  return (
    <SettingsWorkspace activeTab={tab} isAdmin={userIsAdmin}>
      {tab === 'integrations' ? (
        <SettingsIntegrationsView
          initialIntegrations={workspaceIntegrations}
          initialCategoryFilter={initialCategoryFilter}
        />
      ) : (
        <EditProfileData section={tab} />
      )}
    </SettingsWorkspace>
  );
}
