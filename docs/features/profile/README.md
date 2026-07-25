# Profile feature documentation

User profile surfaces: a read-only **Profile** page backed by the Supabase auth
session and `public.users`, plus an **Edit profile** account-settings page for
self-service updates (name + profile picture).

| Document                             | Description                                                          | Status |
| ------------------------------------ | -------------------------------------------------------------------- | ------ |
| This README                          | Profile + edit-profile surfaces overview                             | Living |
| [EDIT_PROFILE.md](./EDIT_PROFILE.md) | Edit profile, dual storage buckets, forever avatar URL, field matrix | Living |

| Surface      | Route           | Description                                                          | Status |
| ------------ | --------------- | -------------------------------------------------------------------- | ------ |
| Profile      | `/profile`      | Identity, About, Contact, Teams, and "Worked on" — auth session + DB | Living |
| Edit profile | `/edit-profile` | Self-service photo + name (other mock sections deferred)             | Living |

## Profile (`/profile`)

Server component that loads real data and passes it to a presentational view.

- Page: `apps/web/app/profile/page.tsx`
- View: `apps/web/app/profile/_components/profile-view.tsx`
- Server reads: `apps/web/app/profile/_services/profile.service.server.ts`
  - `getProfileTeams(userId)` — `team_members` → `teams` with member counts
  - `getProfileWorkedOn(userId)` — `work_items` where the user is assignee or reporter
- Identity/About/Contact are derived from `getUser()` + `getDbUser()` (`apps/web/lib/auth.ts`):
  name, avatar from `public.users.profile_picture`, role, sign-in provider,
  email-verified state, and member-since.

## Edit profile (`/edit-profile`)

Self-service settings for the **signed-in** user. See
[EDIT_PROFILE.md](./EDIT_PROFILE.md) for storage buckets, forever public URLs,
editable field matrix, API sketch, and phased rollout.

- Page: `apps/web/app/edit-profile/page.tsx`
- View: `apps/web/app/edit-profile/_components/edit-profile-view.tsx`
- Entry: **Manage your account** on `/profile` → `/edit-profile`

Profile picture updates write a public Storage URL to
`public.users.profile_picture` only (not Auth `user_metadata`). Name updates are
self-service on the same row. Admin-gated user APIs are not used here — see the
[authentication guide](../../auth/AUTHENTICATION.md).

Quick links:

- Shared UI primitives: `@repo/ui/components/ui/*` (Card, Input, Textarea, Switch, Dropzone, Avatar, Badge)
- SEO: both routes are `noindex` and blocked in `apps/web/app/robots.ts` — see [SEO guide](../../guides/SEO.md)
