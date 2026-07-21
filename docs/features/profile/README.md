# Profile feature documentation

User profile surfaces: a read-only **Profile** page backed by the Supabase auth
session and `public.users`, plus an **Edit profile** account-settings page
(currently a UI mock).

| Surface      | Route           | Description                                                                                       | Status                     |
| ------------ | --------------- | ------------------------------------------------------------------------------------------------- | -------------------------- |
| Profile      | `/profile`      | Identity, About, Contact, Teams, and "Worked on" — read from auth session + DB                    | Living                     |
| Edit profile | `/edit-profile` | Sectioned account settings (photo, public profile, contact, security, notifications, danger zone) | Plan (mock UI — not wired) |

## Profile (`/profile`)

Server component that loads real data and passes it to a presentational view.

- Page: `apps/web/app/profile/page.tsx`
- View: `apps/web/app/profile/_components/profile-view.tsx`
- Server reads: `apps/web/app/profile/_services/profile.service.server.ts`
  - `getProfileTeams(userId)` — `team_members` → `teams` with member counts
  - `getProfileWorkedOn(userId)` — `work_items` where the user is assignee or reporter
- Identity/About/Contact are derived from `getUser()` + `getDbUser()` (`apps/web/lib/auth.ts`):
  name, avatar (`profile_picture` / Google `avatar_url`), role, sign-in provider,
  email-verified state, and member-since.

## Edit profile (`/edit-profile`)

Visual scaffold only — fields are uncontrolled placeholders and nothing is
persisted yet. The "Manage your account" button on `/profile` links here.

- Page: `apps/web/app/edit-profile/page.tsx`
- View: `apps/web/app/edit-profile/_components/edit-profile-view.tsx`
- Mock data: `apps/web/app/edit-profile/_components/edit-profile-mock-data.ts`

When wiring it up, add a self-service action that updates `public.users` and
mirrors editable fields into Supabase Auth `user_metadata`
(name/avatar) — the current admin `updateUser` API is role-gated. See the
[authentication guide](../../auth/AUTHENTICATION.md).

Quick links:

- Shared UI primitives: `@repo/ui/components/ui/*` (Card, Input, Textarea, Switch, Dropzone, Avatar, Badge)
- SEO: both routes are `noindex` and blocked in `apps/web/app/robots.ts` — see [SEO guide](../../guides/SEO.md)
