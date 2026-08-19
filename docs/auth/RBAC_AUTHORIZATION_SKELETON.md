# RBAC and Dashboard Authorization (Phase 1)

## Document Metadata

- Project: Alice
- Area: Web Authorization (`apps/web`)
- Version: 1.0 (Phase 1)
- Status: Implemented
- Owner: TBD
- Last Updated: 2026-08-03

## 1. Understood Requirements

- Use **Supabase Auth** for authentication only (sign-in, sessions, JWT identity).
- Do **not** store application roles in Supabase Auth `user_metadata` for authorization decisions.
- Authorize from `public.users.role` (`admin` | `manager` | `member`) and `public.users.active`.
- Enforce route access with defense in depth: sidebar hide + RSC layout redirects + Server Action / API guards.

Related: `AUTHENTICATION.md`, `docs/features/users/USER_MANAGEMENT.md`, `docs/README.md`.

## 2. Problem Statement

- Signed-in users must not reach System or Projects admin surfaces without the right app role.
- Access decisions need one policy module shared by UI and server gates.
- Hide-in-UI alone is not security; layouts and mutations must enforce the same rules.

## 3. Scope

### In Scope (Phase 1)

- Role hierarchy helpers and route/nav policy in `apps/web/lib/rbac/`.
- Layout guards: `/users` (admin); `/projects`, `/sprints`, `/manager` (manager+).
- Sidebar filtering for System and Projects groups.
- Shared `requireAdmin` / `requireManagerOrAdmin` (and existing `requireManagerRole` wrapper).

### Out of Scope (Phase 2+)

- Separate `roles` / `permissions` / `role_permissions` tables.
- Admin permission-matrix UI.
- Fine-grained field-level grants or object-level ACLs beyond project membership.
- Putting role into JWT / trusting `user_metadata` for authz.
- Middleware path→role redirects via server-only role cookie (optional later).

## 4. Terminology

- **Authenticated User:** Identity verified by Supabase Auth (`getUser()`).
- **App role:** Value of `public.users.role` — `member` < `manager` < `admin`.
- **Nav group:** Sidebar section keyed by policy (`platform`, `system`, `projects`, …).

## 5. Phase 1 Role × Route Matrix

| Role        | Platform | Projects (`/projects`, `/sprints`, `/manager`) | System (`/users`) |
| ----------- | -------- | ---------------------------------------------- | ----------------- |
| **admin**   | yes      | yes (superset)                                 | yes               |
| **manager** | yes      | yes                                            | no                |
| **member**  | yes      | no                                             | no                |

Platform / Account / Help (e.g. `/dashboard`, `/backlog`, `/board`, `/work-items`, `/member`, `/profile`, `/docs`, `/help`, `/roadmap`) remain available to any authenticated admitted role.

**Explicit default:** Admin is a Projects superset. Manager cannot open System. Member stays on Platform / Account / Help.

**Project object ACL (beyond this matrix):** Opening `/projects/[id]` and which rows appear on the `/projects` registry also require admin, project owner, or active `project_members` — see [features/projects/README.md](../features/projects/README.md) (Access model).

## 6. Enforcement Layers

```text
Request → proxy (session + allowlist) → RSC layout (assertRoleOrRedirect) → page
                                              ↓ deny
                                     redirect('/dashboard')
Mutations → requireAdmin / requireManagerRole (never client-only)
```

| Layer                | Responsibility                                                  |
| -------------------- | --------------------------------------------------------------- |
| `proxy.ts`           | Session refresh + admission allowlist (not full RBAC)           |
| `lib/rbac/*`         | Single source of truth for roles + path/nav policy              |
| Route layouts        | Thin wrappers around `RoleGatedLayout` (authoritative redirect) |
| Sidebar              | UX hide via `canAccessNavGroup`                                 |
| Server Actions / API | Mutation guards                                                 |

Denied layout access uses `redirect('/dashboard')` — do not throw opaque digests for expected authz failures.

## 7. Policy Module

- `roles.ts` — `AppRole`, `roleAtLeast`, `isAdmin`, `isManagerOrAdmin`
- `route-policy.ts` — `canAccessNavGroup`, `canAccessPath`, `minimumRoleForPath`
- `require-role.ts` — `requireRole`, `requireAdmin`, `assertAdminOrRedirect`, `assertManagerOrRedirect`
- `role-gated-layout.tsx` — shared `RoleGatedLayout` + `roleGatedPageMetadata` for route segments
- `require-manager-role.ts` — thin wrapper over `requireManagerOrAdmin`

**Deny-by-default for new admin routes:** register the path prefix in `route-policy` before shipping UI links.

## 8. Security Considerations

- Never use `user_metadata` JWT claims for authorization (user-editable).
- Use `getUser()` on the server, not `getSession()` alone.
- Continue `public.users.active` admission; deactivated users stay out.
- Log denials with `warn.` prefixes for observability.
- API routes continue validating Bearer tokens via `requireApiAuth` plus role checks where applicable.

## 9. Phase 2 (Deferred)

- Custom RBAC tables and permission matrix UI (previous skeleton §§6–8).
- Field-level and richer object ACLs.
- Optional middleware role cookie for earlier redirects.

## 10. Test Plan

- Unit: route policy matrix and role hierarchy.
- Component: sidebar omits System for manager/member; omits Projects for member.
- Guard: non-admin hitting `/users` layout redirects; member hitting Projects layouts redirects.
