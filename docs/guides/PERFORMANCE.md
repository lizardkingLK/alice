# Performance

How Alice keeps dashboard pages fast, what has already been optimized, and the roadmap for further wins.

| Field        | Value                                                          |
| ------------ | -------------------------------------------------------------- |
| Status       | **Living**                                                     |
| Last updated | 2026-08-14 (M1 table-list hops complete; paginated RSC helper) |
| Scope        | `apps/web` RSC data loading, `apps/api` auth                   |

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

`safeServerFetch` (`apps/web/lib/safe-server-fetch.ts`) replaced a `try/catch` block that was copy-pasted into every page — the wrapped promise is created by the caller, so concurrency inside `Promise.all` is preserved. Applied to: `work-items`, `projects`, `manager`, `projects/[id]`, `users`, `sprints`, `backlog` (via `getBacklogWorkspace()`), `views`.

Paginated readers share `pageRange` / `paginationMeta` (`apps/web/lib/db/pagination.ts`) and `runPaginatedSelect` (`apps/web/lib/db/query.ts`) for order + range + `{ rows, totalCount, page, limit, totalPages }`. Feature services keep table filters and map `rows` to their DTO key (`users`, `workItems`, …).

### 2.4 Direct Supabase reads in RSC

GET/list pages now read **straight from Supabase in the server component** instead of hopping through the Express API. This removes one full network round trip (`web → api → Supabase`) per read, plus the `requireApiAuth` JWT verify + `public.users` touch that came with it.

- **Reads (direct):** work items, users, projects (list/detail/members), sprints (list + `getSprint` + burndown series), teams, access allowlist — implemented in each feature's `_services/*.server.ts` using the SSR Supabase client (`@/lib/supabase/server`).
- **Mutations (unchanged):** create / update / delete / toggle still go through the API, which keeps Zod validation, audit columns, and the service-role client.

Each server reader mirrors the query in the matching API repository (same `select`, filters, ordering, and pagination) so results are identical.

**Security note:** the API uses the Supabase **service-role** key (bypasses RLS); the web SSR client uses the **anon key + user session**. Reads rely on default table grants for the `authenticated` role with RLS unenforced. If RLS is ever enforced, list/detail policies must be added for `work_items`, `projects`, `users`, `sprints`, `project_members`, `teams`, `team_members`, and `access_allowlist` before these reads keep working. Allowlist list is also **admin-gated in RSC** (`isAdmin`); do not treat table grants as the only control.

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

### 2.6 Suspense streaming on list routes (M3)

Dashboard list pages no longer block the entire RSC on Supabase reads. Each route renders `DashboardShell` immediately and streams table content inside `<Suspense>`:

- **Pattern:** sync `page.tsx` → `DashboardShell` → `<Suspense fallback={<RegistryPageSkeleton />}>` → async `*Data` server component (owns `searchParams` + `Promise.all` fetches).
- **Shared skeleton:** `apps/web/components/registry-page-skeleton.tsx` — mirrors search bar, optional tabs, card header, table rows, and pagination placeholders.
- **Client navigations:** route-level `loading.tsx` reuses the same skeleton inside `DashboardShell` for instant feedback.
- **Routes shipped:** `/work-items`, `/users`, `/projects`, `/manager`, `/sprints`, `/backlog`, `/board`, `/profile`, `/projects/[id]`, `/work-items/[id]`.

**Important:** a parent `loading.tsx` also wraps **nested child segments** under that folder. See §2.13 before adding list+detail pairs under one directory.

### 2.7 Short-TTL dropdown cache (M5)

Form dropdowns (`getUserList`, `getProjectList`) are shared across many pages and change infrequently. They now use Next.js `unstable_cache` with a **60s** safety-net TTL and **tag** invalidation on mutations.

| Piece                 | Location                                                           |
| --------------------- | ------------------------------------------------------------------ |
| Tags + cached loaders | `apps/web/lib/cache/dropdown-cache.ts`                             |
| Tag ids               | `dropdown-users`, `dropdown-projects`                              |
| Consumers             | `getUserList()` / `getProjectList()` in `*.service.server.ts`      |
| Invalidate            | Server Actions call `updateTag` via `invalidateDropdownCache(...)` |

**Why a cookie-free admin client inside the cache:** `unstable_cache` cannot call `cookies()`. The service-role client loads the shared list once; the outer helper still gates with `getUser()` so anonymous callers get `[]`.

**How refresh works (important):**

1. Mutation succeeds → `updateTag('dropdown-users'|'dropdown-projects')` **expires** the Data Cache entry immediately (Next 16 Server Action API — prefer over `revalidateTag(tag, 'max')` for read-your-writes).
2. Same action also calls `revalidatePath(...)` so the **current** route’s RSC payload refreshes.
3. The **browser** does not receive a push. The next navigation / soft refresh / Server Action re-render that needs the dropdown hits Supabase again and stores a new cache entry.
4. Tabs already open with old props keep showing that snapshot until they remount or re-fetch (normal App Router behavior).

Paginated registry lists (`getUsersListPaginated`, `getProjectListPaginated`, etc.) are **not** cached this way — they stay request-fresh.

### 2.8 Backlog workspace loader (M4.1)

`/backlog` has the highest read fan-out (4 parallel Supabase calls). Data loading is centralized in `getBacklogWorkspace()` and streamed via Suspense:

| Piece              | Location                                                     |
| ------------------ | ------------------------------------------------------------ |
| Workspace loader   | `apps/web/app/backlog/_services/backlog.service.server.ts`   |
| Async RSC boundary | `apps/web/app/backlog/_components/backlog-data.tsx`          |
| Skeleton           | `apps/web/app/backlog/_components/backlog-page-skeleton.tsx` |
| Route shell        | `apps/web/app/backlog/page.tsx` + `loading.tsx`              |

Each read uses `safeServerFetch` (or `.catch` for sprints) so one failed query degrades gracefully instead of blanking the whole planning surface.

### 2.9 Work-item discussion SSR (M4.3)

`/work-items/[id]` no longer client-fetches comments on mount. Discussion data loads in RSC alongside the work item via a **direct Supabase read** (same M1 pattern as `getWorkItem` — no Express/`apiFetch` hop):

| Piece             | Location                                                                 |
| ----------------- | ------------------------------------------------------------------------ |
| Discussion reader | `getWorkItemDiscussion` → `listComments` in `comments.service.server.ts` |
| Parallel fetch    | `work-item-details-data.tsx` — item + discussion + attachments           |
| Props-only client | `apps/web/app/work-items/_components/workItem-details.tsx`               |

`CommentsFeed` still handles mutations client-side (API); only the **initial** thread is prefetched on the server.

### 2.10 Infra alignment (M6)

Production stack colocated in APAC (2026-07-23):

| Service        | Region    |
| -------------- | --------- |
| Supabase DB    | Sydney    |
| Vercel web     | Singapore |
| Vercel API     | Singapore |
| Resend (email) | Tokyo     |

Serverless functions no longer execute in US-East while the database runs in Sydney — RSC/API Supabase reads use Singapore → Sydney instead of New York → Sydney.

### 2.11 Project workspace loader (M4.2)

`/projects/[id]` fans out to details, members, users dropdown, and project-scoped work items. Loading is centralized and streamed:

| Piece              | Location                                                              |
| ------------------ | --------------------------------------------------------------------- |
| Workspace loader   | `apps/web/app/projects/_services/project-workspace.server.ts`         |
| Async RSC boundary | `apps/web/app/projects/[id]/_components/project-details-data.tsx`     |
| Skeleton           | `apps/web/app/projects/[id]/_components/project-details-skeleton.tsx` |
| Route shell        | `apps/web/app/projects/[id]/page.tsx` + `loading.tsx`                 |

### 2.12 Detail / board / profile streaming (M3 follow-on)

Same shell-first Suspense pattern applied to remaining authenticated surfaces (2026-07-24):

| Route              | Data component                | Skeleton                          |
| ------------------ | ----------------------------- | --------------------------------- |
| `/work-items/[id]` | `work-item-details-data.tsx`  | `work-item-details-skeleton.tsx`  |
| `/board`           | `board-data.tsx`              | `board-page-skeleton.tsx`         |
| `/profile`         | `profile-data.tsx`            | `profile-page-skeleton.tsx`       |
| `/dashboard`       | `dashboard-overview-data.tsx` | `dashboard-overview-skeleton.tsx` |

**Dashboard burndown (2026-08-01):** Overview streams the shell first, then `getDashboardBurndownBootstrap()` (direct Supabase: active sprints + default sprint burndown series). The client widget reuses SSR data and only calls `loadSprintBurndownAction` when board-defaults localStorage selects a different sprint — no `apiFetch` for list or burndown on the hot path.

With these, the original medium-wins roadmap is **complete for existing product surfaces**. New features (e.g. richer board filters, discussion boards) should follow the same patterns in §3.

### 2.13 Isolating Suspense boundaries (`loading.tsx` + route groups)

#### Why this matters

In the App Router, `loading.tsx` in a folder wraps that folder’s `page.js` **and nested children** in a Suspense boundary. Instant client navigations therefore can flash the **parent** skeleton before (or instead of briefly alongside) the **child** skeleton.

Symptom we hit: click a row on `/work-items` → briefly see the **registry/table** skeleton (`work-items/loading.tsx`), then the **detail** skeleton (`work-items/[id]/loading.tsx` / page Suspense). Same class of bug exists for projects list → project detail.

#### Inventory (2026-07-24)

| Parent `loading.tsx`            | Nested page route?            | Awkward dual-skeleton risk                     | Status                  |
| ------------------------------- | ----------------------------- | ---------------------------------------------- | ----------------------- |
| `work-items/(list)/loading.tsx` | Sibling of `[id]`, not parent | Resolved — list loading no longer wraps detail | ✅ Shipped (2026-07-24) |
| `projects/(list)/loading.tsx`   | Sibling of `[id]`, not parent | Resolved — list loading no longer wraps detail | ✅ Shipped (2026-07-24) |
| `users/loading.tsx`             | No                            | No                                             | OK                      |
| `sprints/loading.tsx`           | No                            | No                                             | OK                      |
| `manager/loading.tsx`           | No                            | No                                             | OK                      |
| `backlog/loading.tsx`           | No                            | No                                             | OK                      |
| `board/loading.tsx`             | No                            | No                                             | OK                      |
| `profile/loading.tsx`           | No                            | No                                             | OK                      |
| `dashboard/loading.tsx`         | No (leaf overview)            | No                                             | OK                      |
| `work-items/[id]/loading.tsx`   | No (leaf)                     | No                                             | OK                      |
| `projects/[id]/loading.tsx`     | No (leaf)                     | No                                             | OK                      |

When adding nested routes under a folder that already has `loading.tsx`, re-check this table — prefer a `(list)` (or similar) route group so list loading stays a sibling of detail, not a parent.

#### Fix applied: route groups (URLs unchanged)

List vs detail each own their Suspense boundary:

```text
work-items/
  layout.tsx                 # shared metadata / section wrapper
  (list)/                    # route group — does not appear in the URL
    page.tsx                 # /work-items
    loading.tsx              # registry skeleton ONLY for the list
  [id]/
    page.tsx                 # /work-items/[id]
    loading.tsx              # detail skeleton ONLY for the detail

projects/
  layout.tsx
  (list)/
    page.tsx                 # /projects
    loading.tsx
  [id]/
    page.tsx                 # /projects/[id]
    loading.tsx
```

**Why route groups (not “delete parent loading”):**

- List navigations from elsewhere still get an instant `loading.tsx` fallback.
- Detail navigations no longer inherit the list Suspense boundary.
- Public URLs stay `/work-items` and `/work-items/[id]` — `(list)` is organizational only.

**Also keep** the in-page `<Suspense>` around async `*Data` components so the shell can stream on first paint; `loading.tsx` covers **client soft navigations**, page Suspense covers **RSC streaming within the segment**.

Both tracked pairs (`work-items`, `projects`) use this grouping.

---

## 3. Contributor patterns

Follow these when adding or editing server-rendered pages:

1. **Parallelize independent reads** — batch unrelated fetches in `Promise.all`; only chain when one result feeds the next.
2. **Reuse cached readers** — call `getUser` / `getDbUser` / `getUserRole` from `lib/auth.ts`; don't re-query Auth or `public.users` directly in pages.
3. **Guard each concurrent call** — attach `.catch()` returning a safe fallback so a single failure degrades gracefully.
4. **Don't fetch what SSR already has** — pass server-fetched data into client components as props rather than refetching on mount.
5. **Prefer SSR/RSC prefetch** over client-side fetching for initial page data (see workspace rules).
6. **Dropdown lists** — use `getUserList` / `getProjectList` (cached). After mutating users or projects, call `invalidateDropdownCache(DROPDOWN_CACHE_TAGS.*)` in the Server Action (already wired for `/users` and `/projects` actions).
7. **Nested routes + `loading.tsx`** — never leave a list `loading.tsx` as the parent of a detail segment. Use a `(list)` route group (§2.13) so list and detail Suspense boundaries stay isolated.

---

## 4. Roadmap (medium wins)

Targeting sub-1.5s. Ordered by impact-to-effort.

| ID     | Work                                                                                                                          | Effort | Risk    | Expected impact                           | Status                       |
| ------ | ----------------------------------------------------------------------------------------------------------------------------- | ------ | ------- | ----------------------------------------- | ---------------------------- |
| **M1** | Direct Supabase reads in RSC for GET/list pages — drop the `web → api` hop for reads; keep API for mutations/admin.           | M–L    | Medium  | 40–60% of remaining latency on read pages | ✅ Shipped (§2.4)            |
| **M2** | Slim `requireApiAuth` — move profile auto-provisioning to login/signup/invite; keep JWT verify off the hot DB path.           | S      | Low–Med | −1 DB round trip per API call             | ✅ Shipped (§2.5)            |
| **M3** | Suspense streaming — render the shell immediately, stream tables via `<Suspense>` + `loading.tsx`.                            | M      | Low     | Large perceived speedup                   | ✅ Shipped (lists + details) |
| **M4** | Batch "workspace" loaders — see §5                                                                                            | M      | Low     | Medium on high fan-out pages              | ✅ Shipped (§5)              |
| **M5** | Short-TTL caching for stable dropdown data (`getUserList`, `getProjectList`) via `unstable_cache` + `updateTag` on mutations. | S–M    | Low–Med | Medium                                    | ✅ Shipped (§2.7)            |
| **M6** | Infra alignment — same Vercel region for web/api/Supabase, verify prod API URL path, warm cold starts if needed.              | S      | Low     | Medium (spiky)                            | ✅ Shipped (§2.10)           |
| **M7** | Evaluate Prisma Client (or `pg`) vs PostgREST for hot queries — protocol win is real; full-app swap is not the default.       | L      | High    | High on _some_ queries; mixed for Alice   | 📋 Evaluated (§8)            |

**Roadmap complete for existing features (2026-07-24).** Unused Express GET reads were removed 2026-08-14 (§6), including the allowlist table list. API table mutations use Prisma Client (2026-08-14). Paginated RSC lists share `runPaginatedSelect` (2026-08-14). New surfaces should adopt §3 patterns as they land. **Do not move RSC page reads onto Prisma** until a measured hot query justifies it (§8).

**RLS reminder:** M1 reads run with the `authenticated` role and RLS unenforced. Before enabling RLS, add SELECT policies for `work_items`, `projects`, `users`, `sprints`, `project_members`, `teams`, and `team_members`. Dropdown cache (§2.7) uses the **service-role** client inside `unstable_cache` only.

---

## 5. M4 — workspace loaders (shipped)

Classic M4 (“one Express workspace GET”) was superseded by named RSC loaders after M1.

### Audit

| Route                                  | Parallel reads                           | Status      | Notes                                                |
| -------------------------------------- | ---------------------------------------- | ----------- | ---------------------------------------------------- |
| `/backlog`                             | 4 — projects, users, work items, sprints | ✅ Shipped  | `getBacklogWorkspace()` + Suspense                   |
| `/projects/[id]`                       | 4 — details, members, users, work items  | ✅ Shipped  | `getProjectWorkspace(id)` + Suspense (§2.11)         |
| `/work-items/[id]`                     | 2 — item + discussion                    | ✅ Shipped  | `getWorkItemDiscussion` + Suspense (§2.9 / §2.12)    |
| `/manager`                             | 4                                        | N/A         | Dropdown caching (M5) + list Suspense sufficient     |
| `/work-items`, `/projects`, `/sprints` | 3                                        | N/A         | M1 + Promise.all + M3                                |
| `/board`                               | 1                                        | ✅ Streamed | Suspense + skeleton (§2.12); no multi-read fan-out   |
| `/profile`                             | auth + teams + worked-on                 | ✅ Streamed | Suspense + skeleton (§2.12)                          |
| `/dashboard`                           | 2 — sprints list + default burndown      | ✅ Streamed | `getDashboardBurndownBootstrap()` + Suspense (§2.12) |

### Delivered

1. ~~**M4.1** — `getBacklogWorkspace()`~~ ✅
2. ~~**M4.2** — `getProjectWorkspace(id)`~~ ✅ — `apps/web/app/projects/_services/project-workspace.server.ts`
3. ~~**M4.3** — `getWorkItemDiscussion(id)`~~ ✅
4. **Out of scope (kept)** — re-batching already-optimized list pages; new Express batch routers for web-only reads.

---

## 6. Unused API read paths (post-M1)

After M1, dashboard **RSC pages** read from Supabase directly. The Express API remains the write path (Zod, audit, service-role). Unused list/detail **GET** handlers were removed (2026-08-14), including `GET /api/accessAllowlist`. Remaining GETs are capability-kept (Storage, signed URLs, GitHub proxy, cron, health) or non-web — not leftover page table reads.

Legend:

| Status                 | Meaning                                                                                |
| ---------------------- | -------------------------------------------------------------------------------------- |
| **Removed**            | Express GET deleted; web reads via RSC Supabase                                        |
| **Not implemented**    | Never had an Express GET; web reads via RSC                                            |
| **Client-only**        | Still hit from client components (`*.service.ts` / `apiFetch`) — do not delete yet     |
| **Kept**               | Capability-required (Storage, signed URLs, cron, probes, non-web) — not an M1 leftover |
| **Active (mutations)** | POST/PUT/PATCH/DELETE still used — keep                                                |

### Read routes — web usage audit

| API route                                | Status              | Web caller today     | Notes                                                                                                            |
| ---------------------------------------- | ------------------- | -------------------- | ---------------------------------------------------------------------------------------------------------------- |
| `GET /api/users`                         | **Removed**         | —                    | `/users` uses `users.service.server.ts`                                                                          |
| `GET /api/users/secure`                  | **Removed**         | —                    | Auth smoke test only                                                                                             |
| `GET /api/projects`                      | **Removed**         | —                    | SSR + forms pass `getProjectList()` from `projects.service.server.ts` (incl. `/views` Share)                     |
| `GET /api/projects/:id`                  | **Removed**         | —                    | Edit form uses row data via `projectToEdit`; detail page uses server `getProjectDetails`                         |
| `GET /api/projects/:id/members`          | **Removed**         | —                    | Work-item form uses `fetchProjectMembersForForm`; share/team forms already RSC                                   |
| `GET /api/projects/jira/settings`        | **Removed**         | —                    | Preview/import resolve credentials internally; `PUT /jira/settings` kept                                         |
| `GET /api/teams`                         | **Removed**         | —                    | `/manager` + project workspace use `teams.service.server.ts` (direct Supabase, 2026-08-14)                       |
| `GET /api/sprints`                       | **Not implemented** | —                    | List reads are RSC-only (`sprints.service.server.ts`); `/dashboard` uses `getDashboardBurndownBootstrap()`       |
| `GET /api/sprints/:id`                   | **Not implemented** | —                    | Server mirror `getSprint()` in `sprints.service.server.ts`; forms use `sprintToEdit` from list state             |
| `GET /api/sprints/:id/burndown`          | **Kept**            | —                    | Dashboard uses `sprint-burndown.server.ts` + server action; Express handler kept for non-web consumers           |
| `GET /api/workItems`                     | **Removed**         | —                    | List/detail use `workItem.service.server.ts`                                                                     |
| `GET /api/workItems/:id`                 | **Removed**         | —                    | `[id]/page` uses server `getWorkItem`                                                                            |
| `GET /api/workItems/:id/github`          | **Client-only**     | Work-item sidebar    | `getLinkedPRs()` — GitHub API via service-role on Express                                                        |
| `GET /api/workItems/:id/worklogs`        | **Removed**         | —                    | Detail uses `workItem-worklogs.service.server.ts`; client only **POST**s worklogs                                |
| `GET /api/comments`                      | **Removed**         | —                    | RSC reads use `listComments` / `getWorkItemDiscussion`; client GET helper had no callers                         |
| `GET /api/saved-views`                   | **Removed**         | —                    | `/views` uses `getSavedViewsPaginated` in `saved-views.service.server.ts`                                        |
| `GET /api/saved-views/shared-with-me`    | **Removed**         | —                    | Same SSR reader (`tab=shared`)                                                                                   |
| `GET /api/chat/conversations`            | **Removed**         | —                    | Page + drawer use `listChatConversations` / `listChatConversationsAction` (direct Supabase)                      |
| `GET /api/chat`, `GET /api/chat/:id`     | **Kept**            | `/chat` RSC + drawer | History is Storage (service-role); RSC uses server `apiFetch`; drawer client `apiFetch`                          |
| `GET /api/attachments/:id`               | **Kept**            | Attachments UI       | Mints signed preview/download URLs (private bucket)                                                              |
| `GET /api/accessAllowlist`               | **Removed**         | —                    | `/users` uses `listAccessAllowlist` in `accessAllowlist.service.server.ts` (admin-gated); mutations stay Express |
| `GET /api/notifications/check-due-dates` | **Kept**            | Vercel cron          | Not a page read                                                                                                  |
| `GET /` (health)                         | **Kept**            | Deploy / probes      | Not a data read                                                                                                  |
| `POST /api/notifications/send`           | Active              | Server-side notify   | No GET on this router                                                                                            |
| `POST /api/attachments`                  | Active              | `upload-form.tsx`    | Upload only (private bucket; signed URL)                                                                         |

There is **no** `/api/team-members` or `/api/project-members` router. Membership is nested:

- **Team members** — embedded in RSC `teams.service.server.ts` select (`members:team_members(*)`) and in team create/update; profile reads `team_members` direct from Supabase.
- **Project members** — RSC `getProjectMembers()`; work-item form refreshes via `fetchProjectMembersForForm`. Mutations stay `POST`/`DELETE /api/projects/:id/members`.

### Dead client exports (mirror API GET, removed)

These were removed from `*.service.ts` after client forms stopped refetching (2026-07-22). Client modules now export **mutations only** plus shared types:

| Module                       | Removed GET helpers                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------- |
| `users.service.ts`           | `getUsersList`, `getUsersListPaginated`, `getUserList`                                              |
| `projects.service.ts`        | `getProjectList`, `getProjectListPaginated`, `getProjectDetails`, `getProject`, `getProjectMembers` |
| `teams.service.ts`           | `getTeamList`, `getTeamListPaginated`                                                               |
| `sprints.service.ts`         | `listSprints`, `getSprint`                                                                          |
| `saved-views.client.ts`      | `listMySavedViews`, `listSharedWithMeSavedViews`                                                    |
| `comments.service.ts`        | `getCommentsList` (2026-08-14)                                                                      |
| `accessAllowlist.service.ts` | `listAccessAllowlist` (2026-08-14)                                                                  |

Dynamic form reads that still need a round trip (project members on project select in share-view / team / work-item forms) use server actions in `apps/web/lib/form-read-actions.ts` — direct Supabase, not Express.

### Cleanup order (remaining)

1. ~~**Client forms** — stop read refetch via `projects.service.ts` / `sprints.service.ts`~~ ✅ Done (2026-07-22).
2. ~~**Add `getSprint` server reader**~~ ✅ Done — `sprints.service.server.ts` mirrors `sprintsRepository.findById`.
3. ~~**Remove unused Express GET handlers**~~ ✅ Done (2026-08-14). Remaining GETs: chat Storage history, attachment signed URLs, GitHub PR list, burndown (non-web), cron, health. Leftover **repository** list/paginated methods with no HTTP GET were removed; `projectsRepository.listAll` stays for chat tools. `GET /api/accessAllowlist` removed with the RSC reader.
4. ~~**Work-item members hook + chat drawer list**~~ ✅ Done (2026-08-14) — `fetchProjectMembersForForm` + `listChatConversationsAction`.
5. ~~**Dedup paginated RSC lists**~~ ✅ Done (2026-08-14) — `runPaginatedSelect` in `apps/web/lib/db/query.ts` (allowlist list uses it).
6. ~~**Move `GET /api/accessAllowlist` to RSC**~~ ✅ Done (2026-08-14) — `listAccessAllowlist` in `accessAllowlist.service.server.ts`.

---

## 7. How to measure

- **Chrome DevTools → Network:** `document` timing = server RSC time; split TTFB vs download. Watch for multiple sequential calls to `NEXT_PUBLIC_API_URL`.
- **Vercel logs:** compare `web` vs `api` function durations for one navigation; look for 1–3s cold starts on API invocations.
- **Before any Prisma / `pg` swap:** pick 2–3 slow pages, record TTFB + query count. Re-measure the same navigation after a _single_ hot path is rewritten. Do not treat “PostgREST is HTTP” as proof of a whole-app win.

---

## 8. PostgREST (`supabase-js`) vs Prisma Client (M7)

Prisma already owns **schema and migrations** in `@repo/db`. Runtime **reads** in `apps/web` (and remaining API list/detail) use **`supabase-js` → PostgREST → Postgres`**. Express **table mutations** use Prisma Client over pooled `DATABASE_URL` (`apps/api/src/lib/prisma.ts`). That split is intentional ([DATABASE.md](./DATABASE.md), [TRD.md](../architecture/TRD.md)).

### What the manager is describing (true)

```text
supabase-js
  → HTTPS to PostgREST (Data API)
    → PostgREST plans SQL, runs it, builds JSON
    → HTTP response to the app
```

Prisma Client (with a pooled Postgres URL) instead:

```text
Prisma Client
  → TCP to Postgres (usually via Supavisor / PgBouncer)
    → SQL + binary/text protocol
    → mapped objects in-process
```

So yes: each `.from().select()` pays an **HTTP round trip** and PostgREST’s JSON assembly. Nested `select('*, assignee:users(...)')` is convenient but can become several SQL statements or a heavy embed. Prisma can emit one SQL join (or a known query plan) over a persistent/pooled connection.

What is **not** generally true: PostgREST does not “SELECT * then filter in Node.” A well-written client query (`select` columns, `.eq` / `.in`, `.range`) becomes SQL with `LIMIT`/`OFFSET`. The waste is the **protocol and fan-out**, not “the database returns the whole table and we throw it away.”

### Why a full-app Prisma swap is a weak next move for Alice

The last ~6s → ~3s drop came from **removing `web → Express → Supabase`**, parallel reads, auth `cache()`, and region alignment — not from replacing PostgREST. Remaining latency is mostly Singapore → Sydney plus **how many** round trips a page fires.

A wholesale Prisma Client rollout would:

| Cost                       | Why it matters here                                                                                                                                                                              |
| -------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| **Serverless connections** | Prisma Client uses `@prisma/adapter-pg`, which needs Supavisor **session** mode (`DATABASE_URL` on the pooler host, port 5432). Transaction mode (6543) can stall mutations indefinitely.        |
| **RLS / identity**         | RSC reads today use the **user JWT + anon key**. Prisma typically uses a DB role (often bypassing RLS unless you set `SET LOCAL` / `request.jwt.claim`). Auth stays on `supabase-js` either way. |
| **Two type systems**       | Apps consume `@repo/types` `Database` / `Tables<>`. Prisma generates a second client. Dual sources of truth unless we drop generated Supabase types.                                             |
| **Still need supabase-js** | Auth, Storage (chat history, attachments), Realtime if we add it. Prisma does not replace those products.                                                                                        |
| **Rewrite surface**        | Every `*.service.server.ts` and API repository — high regression risk vs incremental RPC/`select` fixes.                                                                                         |

### When Prisma (or `pg` / an RPC) _is_ worth it

Use a **direct Postgres** path for a **named hot query**, not as a default for every `.from()`:

- Aggregations / reports (burndown math, dashboards) that PostgREST expresses poorly.
- Deep graphs that today fan out as many HTTP embeds.
- Mutations that already live in Express with the service-role key (connection pooling is easier to own in `apps/api` than in every RSC).

Prefer in this order:

1. **Fewer round trips** — one workspace loader, narrower `select`, indexes (see Postgres best practices).
2. **`supabase.rpc(...)`** — SQL function, still RLS-aware if `SECURITY INVOKER`, one HTTP call.
3. **Prisma or `pg` in `apps/api` only** — service-role-equivalent DB user, pooled `DATABASE_URL`, keep RSC on supabase-js until measured.
4. **Prisma in RSC** — last; requires a pooling + RLS story and a types decision.

### Decision (2026-08-14)

**Do not migrate RSC / page reads to Prisma Client.** Keep PostgREST for CRUD list/detail reads. Express mutations use Prisma Client with pooled `DATABASE_URL`; Auth, Storage, and guarded RPCs stay on supabase-js. If a page is still slow after §3 patterns, profile that query and add an RPC or an API-side Prisma/`pg` reader for that path only.
