# Profile feature documentation

User profile surfaces: a read-only **Profile** page backed by the Supabase auth
session and `public.users` (with cover upload on the banner), plus **Settings**
tabs for self-service account updates (General, Security, Notifications,
Preferences).

| Document                             | Description                                                          | Status |
| ------------------------------------ | -------------------------------------------------------------------- | ------ |
| This README                          | Profile + settings surfaces overview                                 | Living |
| [EDIT_PROFILE.md](./EDIT_PROFILE.md) | General settings, storage buckets, forever avatar/cover URLs, fields | Living |

| Surface  | Route       | Description                                                | Status |
| -------- | ----------- | ---------------------------------------------------------- | ------ |
| Profile  | `/profile`  | Identity, About, Contact, Teams, "Worked on", cover upload | Living |
| Settings | `/settings` | Tabs: General, Security, Notifications, Preferences        | Living |

## Profile (`/profile`)

Server component that loads real data and passes it to a presentational view.

- Page: `apps/web/app/profile/page.tsx`
- View: `apps/web/app/profile/_components/profile-view.tsx`
- Cover banner (client dialog upload): `profile-cover-banner.tsx`
- Server reads: `apps/web/app/profile/_services/profile.service.server.ts`
  - `getProfileTeams(userId)` — `team_members` → `teams` with member counts
  - `getProfileWorkedOn(userId)` — `work_items` where the user is assignee or reporter
- Identity/About/Contact are derived from `getUser()` + `getDbUser()` (`apps/web/lib/auth.ts`):
  name, avatar from `public.users.profile_picture`, cover from
  `public.users.cover_picture`, role, sign-in provider, email-verified state,
  and member-since.

## Settings (`/settings`)

Self-service account settings for the **signed-in** user, split by tab:

| Tab           | Query                | Content                                             |
| ------------- | -------------------- | --------------------------------------------------- |
| General       | `?tab=general`       | Photo, public profile (name/handle), contact & role |
| Security      | `?tab=security`      | Password/sessions (deferred), danger zone           |
| Notifications | `?tab=notifications` | Email notification toggles (deferred)               |
| Preferences   | `?tab=preferences`   | Browser-local preferences (e.g. create-form mode)   |

See [EDIT_PROFILE.md](./EDIT_PROFILE.md) for storage buckets, forever public URLs,
editable field matrix, API sketch, and phased rollout.

- Page: `apps/web/app/settings/page.tsx`
- Workspace (left sidebar): `apps/web/app/settings/_components/settings-workspace.tsx`
- Tab content: `apps/web/app/edit-profile/_components/edit-profile-view.tsx`
- Entry: **Manage your account** on `/profile`, or **Settings** in the app sidebar
- Legacy `/edit-profile` permanently redirects to `/settings?tab=general`

Profile picture updates write a public Storage URL to
`public.users.profile_picture` only (not Auth `user_metadata`). Name updates are
self-service on the same row. Admin-gated user APIs are not used here — see the
[authentication guide](../../auth/AUTHENTICATION.md).

Quick links:

- Shared UI primitives: `@repo/ui/components/ui/*` (Card, Input, Textarea, Switch, Dropzone, Avatar, Badge)
- SEO: settings/profile are `noindex` and blocked in `apps/web/app/robots.ts` — see [SEO guide](../../guides/SEO.md)
