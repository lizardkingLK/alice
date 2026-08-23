import { EditProfileData } from '@/app/edit-profile/_components/edit-profile-data';
import { SettingsWorkspace } from '@/app/settings/_components/settings-workspace';
import { parseSettingsTab, type RawSearchParams } from '@/lib/search-params';

type SettingsDataProps = {
  readonly searchParams: Promise<RawSearchParams>;
};

export async function SettingsData({
  searchParams,
}: Readonly<SettingsDataProps>) {
  const resolved = await searchParams;
  const tab = parseSettingsTab(resolved.tab);

  return (
    <SettingsWorkspace activeTab={tab}>
      <EditProfileData section={tab} />
    </SettingsWorkspace>
  );
}
