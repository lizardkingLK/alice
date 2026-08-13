import { getDbUser, getUser } from '@/lib/auth';
import { isEmailAllowed } from '@/lib/access-allowlist';

export async function getMarketingSession() {
  const [user, dbUser] = await Promise.all([getUser(), getDbUser()]);
  const showAppLinks = user?.email ? await isEmailAllowed(user.email) : false;

  return {
    user,
    dbUser,
    showAppLinks,
    isSignedIn: Boolean(user),
  };
}
