# Performance

How Alice keeps dashboard pages fast, what has already been optimized, and the roadmap for further wins.

| Field        | Value                                        |
| ------------ | -------------------------------------------- |
| Status       | **Living**                                   |
| Last updated | 2026-07-21                                   |
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

Independent server fetches now run concurrently instead of sequentially. Each call keeps its own error boundary via `.catch()` so one failure doesn't blank the page.

```29:45:apps/web/app/work-items/page.tsx
  const [projects, projectMembers, workItemsResult] = await Promise.all([
    getProjectList().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch projects via API:', message);
      return [];
    }),
    getUserList().catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch users via API:', message);
      return [];
    }),
    getWorkItemsPaginated(page, limit, search).catch((error: unknown) => {
      const message = error instanceof Error ? error.message : 'Unknown error';
      console.error('error. failed to fetch work items list via API:', message);
      return EMPTY_WORK_ITEMS;
    }),
  ]);
```

Applied to: `work-items`, `projects`, `manager`, `projects/[id]`, `users`, `sprints`. (`backlog` already used `Promise.all`.)

### 2.4 Direct Supabase reads in RSC

GET/list pages now read **straight from Supabase in the server component** instead of hopping through the Express API. This removes one full network round trip (`web → api → Supabase`) per read, plus the `requireApiAuth` JWT verify + `public.users` touch that came with it.

- **Reads (direct):** work items, users, projects (list/detail/members), sprints — implemented in each feature's `_services/*.server.ts` using the SSR Supabase client (`@/lib/supabase/server`).
- **Mutations (unchanged):** create / update / delete / toggle still go through the API, which keeps Zod validation, audit columns, and the service-role client.

Each server reader mirrors the query in the matching API repository (same `select`, filters, ordering, and pagination) so results are identical.

**Security note:** the API uses the Supabase **service-role** key (bypasses RLS); the web SSR client uses the **anon key + user session**. Reads rely on default table grants for the `authenticated` role with RLS unenforced. If RLS is ever enforced, list/detail policies must be added for `work_items`, `projects`, `users`, `sprints`, `project_members` before these reads keep working.

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
| **M2** | Slim `requireApiAuth` — move profile auto-provisioning to login/signup/invite; keep JWT verify off the hot DB path.                | S      | Low–Med | −1 DB round trip per API call             | Planned           |
| **M3** | Suspense streaming — render the shell immediately, stream tables via `<Suspense>` + `loading.tsx`.                                 | M      | Low     | Large perceived speedup                   | Planned           |
| **M4** | Batch "workspace" API endpoints — collapse multi-call pages into one auth + fewer DB round trips (only where M1 isn't adopted).    | M      | Low     | Medium                                    | Planned           |
| **M5** | Short-TTL caching for stable dropdown data (`getUserList`, `getProjectList`) via `unstable_cache` + tag revalidation on mutations. | S–M    | Low–Med | Medium                                    | Planned           |
| **M6** | Infra alignment — same Vercel region for web/api/Supabase, verify prod API URL path, warm cold starts if needed.                   | S      | Low     | Medium (spiky)                            | Planned           |

**RLS reminder:** M1 reads run with the `authenticated` role and RLS unenforced. Before enabling RLS, add SELECT policies for `work_items`, `projects`, `users`, `sprints`, `project_members`.

---

## 5. How to measure

- **Chrome DevTools → Network:** `document` timing = server RSC time; split TTFB vs download. Watch for multiple sequential calls to `NEXT_PUBLIC_API_URL`.
- **Vercel logs:** compare `web` vs `api` function durations for one navigation; look for 1–3s cold starts on API invocations.
