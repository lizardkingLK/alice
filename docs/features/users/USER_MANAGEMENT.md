# User Management

## Document metadata

| Field        | Value                            |
| ------------ | -------------------------------- |
| Project      | Alice                            |
| Area         | Web — `apps/web/app/users`       |
| Version      | 1.0                              |
| Status       | Implemented (phase-1 route RBAC) |
| Last updated | 2026-06-30                       |

Related:

- `docs/auth/AUTHENTICATION.md` — living auth guide (admin invite + reset sequences)
- `docs/auth/RBAC_AUTHORIZATION_SKELETON.md` — phase-1 role route matrix
- `docs/auth/FORGOT_PASSWORD_AUTH_PLAN.md` — original password-reset plan
- `docs/guides/DATABASE.md` — `public.users` schema and migrations
- `docs/features/access/ACCESS_ALLOWLIST.md` — admission allowlist; admin UI at `/users?tab=allowlist`
- `docs/features/users/ACCOUNT_DEACTIVATION.md` — offboarding plan (admin / self / webhook → shared helper)

---

## Overview

User management lets workspace administrators register team members, assign roles (`admin`, `manager`, `member`), and control whether accounts are active. Identity is provisioned through **Supabase Auth invite emails**; authorization data lives in the application-owned **`public.users`** table.

| Concern                 | Source of truth                                   |
| ----------------------- | ------------------------------------------------- |
| Sign-in / sessions      | Supabase Auth (`auth.users`)                      |
| Role, name, active flag | `public.users` (PostgreSQL)                       |
| Admin-only mutations    | Server Actions (`createUser`, `toggleUserActive`) |

---

## Routes and UI

| Route             | Access today                      | Purpose                             |
| ----------------- | --------------------------------- | ----------------------------------- |
| `/users`          | Admin only (layout RBAC)          | User registry list + add-user modal |
| `/auth/callback`  | Public (invite/reset links)       | Exchanges auth code for session     |
| `/reset-password` | User with recovery/invite session | Set initial or new password         |
| `/edit-profile`   | Signed-in user                    | Profile + self-deactivate           |

**Navigation:** Dashboard sidebar → **Users** (`/users`).

### Components

| File                          | Role                                                       |
| ----------------------------- | ---------------------------------------------------------- |
| `app/users/page.tsx`          | Server page — loads `public.users`, wraps `DashboardShell` |
| `app/users/user-registry.tsx` | Client list, activate/deactivate, add-user modal           |
| `app/users/user-form.tsx`     | Client form — name, email, role                            |
| `app/users/actions.ts`        | Server Actions — `createUser`, `toggleUserActive`          |
| `lib/auth.ts`                 | `getUser`, `getDbUser`, `getUserRole`                      |
| `lib/supabase/admin.ts`       | Service-role client (server-only) for invites and bans     |

---

## Data model — `public.users`

Defined in `packages/db/prisma/schema.prisma` and typed via `@repo/types`.

| Column       | Type            | Description                                        |
| ------------ | --------------- | -------------------------------------------------- |
| `id`         | UUID            | Matches `auth.users.id` after invite               |
| `email`      | string (unique) | Login email                                        |
| `name`       | string          | Display name                                       |
| `role`       | string          | `admin`, `manager`, or `member` (default `member`) |
| `active`     | boolean         | `false` blocks sign-in via `getUser()`             |
| `created_at` | timestamptz     | Registry timestamp                                 |

Roles are stored in **application data**, not in Supabase Auth metadata for authorization decisions (see RBAC skeleton).

---

## Adding a user (invitation email flow)

Only callers with `public.users.role === 'admin'` can successfully run `createUser`. The flow:

```mermaid
sequenceDiagram
  participant Admin
  participant Web as apps/web Server Action
  participant Auth as Supabase Auth
  participant DB as public.users
  participant Invitee

  Admin->>Web: Submit name, email, role
  Web->>Web: Validate (Zod) + verify admin role
  Web->>DB: Check email not already registered
  Web->>Auth: admin.inviteUserByEmail(email, redirectTo)
  Auth->>Invitee: Invitation email
  Web->>DB: INSERT user row (id = auth user id)
  Note over Web,DB: On DB failure → delete auth user (rollback)

  Invitee->>Web: Click link → /auth/callback?next=/reset-password
  Web->>Auth: exchangeCodeForSession
  Web->>Invitee: Redirect /reset-password
  Invitee->>Web: Set password (updateUser)
  Web->>Invitee: Redirect /dashboard
```

### Step-by-step

1. **Admin opens** `/users` → **Add User** → fills name, email, workspace role.
2. **`createUser` Server Action** validates input and confirms the current user is an admin (`getDbUser().role === 'admin'`).
3. **Duplicate check** — rejects if email already exists in `public.users`.
4. **Supabase invite** — `auth.admin.inviteUserByEmail` with:
   - `redirectTo`: `{origin}/auth/callback?next=/reset-password`
   - `data`: `{ name, role }` (auth metadata only; not used for RBAC enforcement)
5. **Database insert** — row in `public.users` with `id` from the invited auth user, `active: true`.
6. **Rollback** — if insert fails, `auth.admin.deleteUser` removes the orphaned auth record.
7. **Invitee** receives email, completes callback, sets password on `/reset-password`, then lands on `/dashboard`.

### Supabase dashboard requirements

- **Authentication → URL configuration:** allow `http://localhost:3000/auth/callback` and production callback URL.
- **Email provider** enabled; customize invite template if needed.
- **Service role key** available to the web app server (`SUPABASE_SERVICE_ROLE_KEY` in `lib/env.ts`) — never exposed to the browser.

---

## Activate / deactivate users

Shared kill switch lives in the API as `deactivateUser` (see [ACCOUNT_DEACTIVATION.md](./ACCOUNT_DEACTIVATION.md)).

| Path    | Who                | Mechanism                                                 |
| ------- | ------------------ | --------------------------------------------------------- |
| Admin   | Admin on `/users`  | `PATCH /api/users/:id/toggle-active`                      |
| Self    | Any signed-in user | Edit profile Danger zone → same `toggle-active` on own id |
| Webhook | External (phase 2) | Planned                                                   |

| Action     | `public.users`   | Supabase Auth                       |
| ---------- | ---------------- | ----------------------------------- |
| Deactivate | `active = false` | `ban_duration: '87600h'`            |
| Activate   | `active = true`  | `ban_duration: 'none'` (admin only) |

**Last-admin guard:** the API rejects deactivating the last remaining active admin.
**Sign-in gate:** `getUser()` returns `null` when `active` is `false`.

---

## Authorization status (RBAC)

Phase-1 enforcement uses `apps/web/lib/rbac` (`requireAdmin`, layout `assertAdminOrRedirect`, sidebar `canAccessNavGroup`).

| Surface                 | Enforcement                                                          |
| ----------------------- | -------------------------------------------------------------------- |
| **`/users` page**       | `app/users/layout.tsx` — admin only; others redirect to `/dashboard` |
| **System sidebar**      | Hidden unless role is `admin`                                        |
| **`createUser` / edit** | Server Actions via shared `requireAdmin()`                           |
| **`toggleUserActive`**  | Same `requireAdmin()` gate                                           |

Phase-2 (permission tables / matrix UI) remains deferred — see `docs/auth/RBAC_AUTHORIZATION_SKELETON.md`.

---

## Auth helpers

```typescript
// lib/auth.ts (simplified)
getUser(); // Supabase auth user + active check against public.users
getDbUser(); // Full public.users row for current email
getUserRole(); // dbUser.role or null
```

Use `getDbUser()` / `getUserRole()` for authorization checks in Server Actions and RSC pages.

---

## Environment variables

Required in `apps/web` (see `sample.env`):

| Variable                        | Used for                                             |
| ------------------------------- | ---------------------------------------------------- |
| `NEXT_PUBLIC_SUPABASE_URL`      | Browser + server clients                             |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Session client                                       |
| `SUPABASE_SERVICE_ROLE_KEY`     | `createAdminClient()` — invites, bans, admin inserts |

---

## SEO and security notes

- `/users` is an **authenticated internal route** — it must not be indexed (add `robots: { index: false }` on a layout and `disallow: /users` in `robots.ts` per `docs/guides/SEO.md` when that route is classified).
- Never import `lib/supabase/admin.ts` from client components.
- Invitation links must use the allow-listed `redirectTo` host in Supabase.

---

## Testing checklist

- [ ] Admin can invite a new user → email received → password set → can sign in
- [ ] Non-admin calling `createUser` receives unauthorized error
- [ ] Duplicate email rejected
- [ ] Deactivated user cannot access dashboard (`getUser()` returns null)
- [ ] Admin cannot deactivate self
- [ ] DB insert failure rolls back auth user

---

## Open questions

- Should managers read the registry without mutate permissions?
- Should invite metadata (`data.role`) be removed entirely to avoid confusion with `public.users.role`?
- Audit log for invite / deactivate events?
