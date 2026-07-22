# Performance

How Alice keeps dashboard pages fast, what has already been optimized, and the roadmap for further wins.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | **Living**                                   |
| Last updated | 2026-07-22                                   |
| Scope        | `apps/web` RSC data loading, `apps/api` auth |

Related:

- [architecture/TRD.md](../architecture/TRD.md) — system design and app boundaries
- [auth/AUTHENTICATION.md](../auth/AUTHENTICATION.md) — session, token, and API auth flow
- [guides/DATABASE.md](./DATABASE.md) — Supabase access patterns

---

## 1. The problem

Production dashboard pages were loading in ~6s (e.g. `/users` ~6.1s, `/work-items` ~6.28s, measured as document load in the Network tab).

### Root causes

Every dashboard route pays for a **double network hop** plus repeated auth:

```text
Browser
  → Vercel Next.js (proxy/middleware + RSC)
    → Supabase Auth (session / getUser)
    → HTTP to separate Vercel Express API   ← extra hop per read
      → Supabase Auth again (JWT verify)     ← repeated auth
      → Supabase DB query
```

The three biggest contributors:

1. **Sequential server fetches** — pages `await`ed each API call one after another.
2. **`web → api → Supabase` double hop** — reads went through Express instead of straight to the DB.
3. **Repeated auth per request** — session lookups in middleware **and** RSC, plus `requireApiAuth` re-verifying and touching `public.users` on every API call.

---

## 2. Implemented (quick wins)

**Result: ~6s → ~3.1s** on the slow list pages.

### 2.1 Cached access token per request

`apiFetch` previously created a Supabase client and called `getSession()` on **every** call. It now shares one token lookup per RSC request via React `cache()`.

```6:14:apps/web/lib/api/api-client.server.ts
/** One session lookup per RSC request, shared across all `apiFetch` calls. */
const getAccessToken = cache(async (): Promise<string | null> => {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  return session?.access_token ?? null;
});
```

**Why it helps:** a page that fires several `apiFetch` calls (e.g. work-items → projects + members + items) no longer repeats the session round trip for each one.

### 2.2 Deduplicated auth queries

`lib/auth.ts` split the Auth call and the `public.users` select into small `cache()`d readers so a page needing both `getUser()` and `getDbUser()` only hits Auth once and the DB once.

- `getAuthUser()` — one `supabase.auth.getUser()` per request
- `getDbUserRow()` — one `public.users` select per request
- `getUser()` / `getDbUser()` / `getUserRole()` reuse those

Inactive-user semantics are unchanged: a user is treated as signed-out only when a `public.users` row exists **and** `active === false`.

### 2.3 Parallel data fetching with `Promise.all`

Independent server fetches now run concurrently instead of sequentially. Each call is wrapped in the shared `safeServerFetch` guard, so one failure logs and falls back to a safe default instead of blanking the whole page.

```30:38:apps/web/app/work-items/page.tsx
  const [projects, projectMembers, workItemsResult] = await Promise.all([
    safeServerFetch(getProjectList(), [], 'fetch projects via API'),
    safeServerFetch(getUserList(), [], 'fetch users via API'),
    safeServerFetch(
      getWorkItemsPaginated(page, limit, search),
      EMPTY_WORK_ITEMS,
      'fetch work items list via API'
    ),
  ]);
```

`safeServerFetch` (`apps/web/lib/safe-server-fetch.ts`) replaced a `try/catch` block that was copy-pasted into every page — the wrapped promise is created by the caller, so concurrency inside `Promise.all` is preserved. Applied to: `work-items`, `projects`, `manager`, `projects/[id]`, `users`, `sprints`. (`backlog` uses a single surrounding `try/catch`.)

Paginated readers also share `pageRange` / `paginationMeta` (`apps/web/lib/db/pagination.ts`) for the range math and `{ totalCount, page, limit, totalPages }` shape, keeping the direct-read services free of duplicated pagination boilerplate.

### 2.4 Direct Supabase reads in RSC

GET/list pages now read **straight from Supabase in the server component** instead of hopping through the Express API. This removes one full network round trip (`web → api → Supabase`) per read, plus the `requireApiAuth` JWT verify + `public.users` touch that came with it.

- **Reads (direct):** work items, users, projects (list/detail/members), sprints (list + `getSprint`), teams — implemented in each feature's `_services/*.server.ts` using the SSR Supabase client (`@/lib/supabase/server`).
- **Mutations (unchanged):** create / update / delete / toggle still go through the API, which keeps Zod validation, audit columns, and the service-role client.

Each server reader mirrors the query in the matching API repository (same `select`, filters, ordering, and pagination) so results are identical.

**Security note:** the API uses the Supabase **service-role** key (bypasses RLS); the web SSR client uses the **anon key + user session**. Reads rely on default table grants for the `authenticated` role with RLS unenforced. If RLS is ever enforced, list/detail policies must be added for `work_items`, `projects`, `users`, `sprints`, `project_members`, `teams`, and `team_members` before these reads keep working.

```1:10:apps/web/app/work-items/_services/workItem.service.server.ts
import { User as DbUser } from '@/app/users/_services/users.service';
import { createClient } from '@/lib/supabase/server';
import { Tables } from '@repo/types';

type DbUserEssentials = Pick<DbUser, 'id' | 'name' | 'email'>;

export type DbWorkItem = Tables<'work_items'> & {
  assignee: DbUserEssentials | null;
  reporter?: DbUserEssentials | null;
};
```

### 2.5 Slim `requireApiAuth`

The API auth middleware used to do three things per request: verify the JWT, **SELECT** the caller's `public.users` row, and **INSERT** it if missing (auto-provisioning). Steps 2–3 added a DB round trip to every authenticated API call.

Profile provisioning already happens idempotently at every auth entry point via `ensurePublicUser` (`apps/web/lib/ensure-public-user.ts`):

- **Sign up** and **login** — `apps/web/app/auth/actions.ts`
- **OAuth / email-confirm callback** — `apps/web/app/auth/callback/route.ts`
- **Admin invite** — the API inserts the `public.users` row directly (`users.service.ts`, with Auth rollback on failure)

So the middleware no longer touches the DB — it just verifies the token and sets `req.userId`. The stateless anon client is also hoisted to module scope instead of being re-created per request.

```25:50:apps/api/src/middlewares/auth/index.ts
export async function requireApiAuth(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  const authHeader = req.headers.authorization;
  const token = authHeader?.startsWith('Bearer ')
    ? authHeader.slice(7)
    : undefined;

  if (!token) {
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  const {
    data: { user },
    error,
  } = await authClient.auth.getUser(token);

  if (error || !user) {
    console.error('API Auth Error:', error);
    res.status(401).json({ error: 'Unauthorized' });
    return;
  }

  req.userId = user.id;
  next();
}
```

**Trade-off:** admin-only mutations still do their own `public.users` role lookup (`requireAdmin`), so authorization is unaffected. The only removed behavior is lazy self-provisioning on a random API call — which was already redundant given the entry-point provisioning above.

---

## 3. Contributor patterns

Follow these when adding or editing server-rendered pages:

1. **Parallelize independent reads** — batch unrelated fetches in `Promise.all`; only chain when one result feeds the next.
2. **Reuse cached readers** — call `getUser` / `getDbUser` / `getUserRole` from `lib/auth.ts`; don't re-query Auth or `public.users` directly in pages.
3. **Guard each concurrent call** — attach `.catch()` returning a safe fallback so a single failure degrades gracefully.
4. **Don't fetch what SSR already has** — pass server-fetched data into client components as props rather than refetching on mount.
5. **Prefer SSR/RSC prefetch** over client-side fetching for initial page data (see workspace rules).

---

## 4. Roadmap (medium wins)

Targeting sub-1.5s. Ordered by impact-to-effort.

| ID     | Work                                                                                                                               | Effort | Risk    | Expected impact                           | Status            |
| ------ | ---------------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ----------------------------------------- | ----------------- |
| **M1** | Direct Supabase reads in RSC for GET/list pages — drop the `web → api` hop for reads; keep API for mutations/admin.                | M–L    | Medium  | 40–60% of remaining latency on read pages | ✅ Shipped (§2.4) |
| **M2** | Slim `requireApiAuth` — move profile auto-provisioning to login/signup/invite; keep JWT verify off the hot DB path.                | S      | Low–Med | −1 DB round trip per API call             | ✅ Shipped (§2.5) |
| **M3** | Suspense streaming — render the shell immediately, stream tables via `<Suspense>` + `loading.tsx`.                                 | M      | Low     | Large perceived speedup                   | Planned           |
| **M4** | Batch "workspace" API endpoints — collapse multi-call pages into one auth + fewer DB round trips (only where M1 isn't adopted).    | M      | Low     | Medium                                    | Planned           |
| **M5** | Short-TTL caching for stable dropdown data (`getUserList`, `getProjectList`) via `unstable_cache` + tag revalidation on mutations. | S–M    | Low–Med | Medium                                    | Planned           |
| **M6** | Infra alignment — same Vercel region for web/api/Supabase, verify prod API URL path, warm cold starts if needed.                   | S      | Low     | Medium (spiky)                            | Planned           |

**RLS reminder:** M1 reads run with the `authenticated` role and RLS unenforced. Before enabling RLS, add SELECT policies for `work_items`, `projects`, `users`, `sprints`, `project_members`, `teams`, and `team_members`.

---

## 6. Unused API read paths (post-M1)

After M1, dashboard **RSC pages** read from Supabase directly. The Express API remains the write path (Zod, audit, service-role). Several **GET** routes are no longer on the hot path from `apps/web`.

Legend:

| Status                 | Meaning                                                                                     |
| ---------------------- | ------------------------------------------------------------------------------------------- |
| **Unused (web)**       | No current `apps/web` caller; safe to treat as legacy read surface                          |
| **Client-only**        | Still hit from client components (`*.service.ts` / `apiFetch`) — migrate in next M1 cleanup |
| **Active (mutations)** | POST/PUT/PATCH/DELETE still used — keep                                                     |

### Read routes — web usage audit

| API route                       | Status           | Web caller today   | Notes                                                                                                         |
| ------------------------------- | ---------------- | ------------------ | ------------------------------------------------------------------------------------------------------------- |
| `GET /api/users`                | **Unused (web)** | —                  | `/users` uses `users.service.server.ts`                                                                       |
| `GET /api/users/secure`         | **Unused (web)** | —                  | Auth smoke test only                                                                                          |
| `GET /api/projects`             | **Unused (web)** | —                  | SSR + forms pass `getProjectList()` from `projects.service.server.ts` (since 2026-07-22)                      |
| `GET /api/projects/:id`         | **Unused (web)** | —                  | Edit form uses row data via `projectToEdit`; detail page uses server `getProjectDetails`                      |
| `GET /api/projects/:id/members` | **Unused (web)** | —                  | `team-form` uses server action `fetchProjectMembersForForm`; `/projects/[id]` uses server `getProjectMembers` |
| `GET /api/teams`                | **Unused (web)** | —                  | `/manager` uses `teams.service.server.ts` (since 2026-07-22)                                                  |
| `GET /api/sprints`              | **Unused (web)** | —                  | `/sprints`, `/backlog` use `sprints.service.server.ts`                                                        |
| `GET /api/sprints/:id`          | **Unused (web)** | —                  | Server mirror `getSprint()` in `sprints.service.server.ts`; forms use `sprintToEdit` from list state          |
| `GET /api/workItems`            | **Unused (web)** | —                  | List/detail use `workItem.service.server.ts`                                                                  |
| `GET /api/workItems/:id`        | **Unused (web)** | —                  | `[id]/page` uses server `getWorkItem`                                                                         |
| `GET /` (health)                | Active           | Deploy / probes    | Not a data read                                                                                               |
| `POST /api/notifications/send`  | Active           | Server-side notify | No GET on this router                                                                                         |
| `POST /api/files`               | Active           | `upload-form.tsx`  | Upload only                                                                                                   |

There is **no** `/api/team-members` or `/api/project-members` router. Membership is nested:

- **Team members** — embedded in `GET /api/teams` select (`members:team_members(*)`) and in team create/update; profile reads `team_members` direct from Supabase.
- **Project members** — `GET /api/projects/:id/members`; server mirror in `getProjectMembers()`.

### Dead client exports (mirror API GET, removed)

These were removed from `*.service.ts` after client forms stopped refetching (2026-07-22). Client modules now export **mutations only** plus shared types:

| Module                | Removed GET helpers                                                                                 |
| --------------------- | --------------------------------------------------------------------------------------------------- |
| `users.service.ts`    | `getUsersList`, `getUsersListPaginated`, `getUserList`                                              |
| `projects.service.ts` | `getProjectList`, `getProjectListPaginated`, `getProjectDetails`, `getProject`, `getProjectMembers` |
| `teams.service.ts`    | `getTeamList`, `getTeamListPaginated`                                                               |
| `sprints.service.ts`  | `listSprints`, `getSprint`                                                                          |

Dynamic form reads that still need a round trip (e.g. project members on project select in `team-form`) use the server action `fetchProjectMembersForForm` in `apps/web/lib/form-read-actions.ts` — direct Supabase, not Express.

### Cleanup order (remaining)

1. ~~**Client forms** — stop read refetch via `projects.service.ts` / `sprints.service.ts`~~ ✅ Done (2026-07-22).
2. ~~**Add `getSprint` server reader**~~ ✅ Done — `sprints.service.server.ts` mirrors `sprintsRepository.findById`.
3. **Optional:** mark unused GET handlers deprecated in API or keep for non-web consumers / M4 batch endpoints.
4. **Dedup refactor (deferred):** shared paginated-list helper for `*.service.server.ts` files.

---

## 7. How to measure

- **Chrome DevTools → Network:** `document` timing = server RSC time; split TTFB vs download. Watch for multiple sequential calls to `NEXT_PUBLIC_API_URL`.
- **Vercel logs:** compare `web` vs `api` function durations for one navigation; look for 1–3s cold starts on API invocations.
