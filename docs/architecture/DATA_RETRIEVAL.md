# Data retrieval strategy (SSR vs Express)

Status: **Plan** (helper + work-items gate implemented; default `ssr`)  
Last updated: 2026-08-18  
Scope: `apps/web` server reads; Express Prisma GETs in `apps/api`

Alice has **two ways to load list/detail data**. Mutations stay on Express either way.

| Strategy  | Path                                               | Today                                                              |
| --------- | -------------------------------------------------- | ------------------------------------------------------------------ |
| **`ssr`** | RSC → supabase-js → Postgres                       | **Default** (no extra hop)                                         |
| **`api`** | RSC → `apiFetch` → Express GET → Prisma → Postgres | Implemented for work-items, **not called** until this toggle is on |

This is an **app toggle** (one deploy-time boolean for the whole product), not a per-feature flag service. Work-items is the first domain that **honors** it. Other domains keep SSR until they have a Prisma GET **and** are added to the code allowlist.

Related:

- [API_VERSIONING.md](./API_VERSIONING.md) — unused Express GETs are Prisma-only
- [PERFORMANCE.md](../guides/PERFORMANCE.md) — why `ssr` is the default
- [DATABASE.md](../guides/DATABASE.md) — web must not import `@repo/db`
- [TRD.md](./TRD.md) — app boundaries

---

## Decision

| Choice                                  | Why                                                                                                       |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| One boolean for the app                 | Present and future teams flip the same gate; no LaunchDarkly / per-page flags                             |
| Typed strategy in code (`ssr` \| `api`) | Boolean env in, readable branches at the fetch front                                                      |
| Server-only env (not `NEXT_PUBLIC_*`)   | Only RSC readers need it; client mutations already use Express; do not leak infra into the browser bundle |
| Default `ssr` / `false`                 | Keeps the hop-free path from [PERFORMANCE.md](../guides/PERFORMANCE.md)                                   |
| Code allowlist of domains               | Flip the boolean without breaking users/projects/sprints that still have no Express GET                   |
| Gate inside `*.service.server.ts`       | Pages keep calling `getWorkItemsPaginated` / `getWorkItem`; they never branch                             |

```text
Page / RSC
  → getWorkItemsPaginated() / getWorkItem()     ← stable API
       → shouldReadViaApi('work-items')?
            no  → supabase-js (today)
            yes → apiFetch GET /api/workItems     (Prisma on Express)
```

Client `apiFetch` in `*.service.ts` is **out of scope** (creates, patches, deletes, GitHub, signed URLs).

---

## Env (server-only)

| Name                 | Type                           | Default                   | Where it is read                  |
| -------------------- | ------------------------------ | ------------------------- | --------------------------------- |
| `DATA_READS_VIA_API` | boolean (`true` / `1` / `yes`) | **unset = false** (`ssr`) | `apps/web` **server** module only |

Do **not** add this to `apps/web/lib/env/env.ts` next to `NEXT_PUBLIC_*`. That file is the public env parser. Put the reader in a `*.server.ts` module (`apps/web/lib/data-retrieval.server.ts`) so client components cannot import it.

Do **not** name it `NEXT_PUBLIC_DATA_READS_VIA_API`. A public flag would:

- ship in the browser bundle
- invite client components to branch reads
- expose operational intent without a security benefit

CI (`GITHUB_ACTIONS=true`): treat as `false` (same as other web env mocks).

E2E / Cypress: leave unset so lists stay on SSR unless a job **explicitly** tests the `api` path.

### Vercel — runtime flag (no code change)

**Yes.** `DATA_READS_VIA_API` is already a **server runtime** switch. It is not a build-only `NEXT_PUBLIC_*` flag.

| What                         | Behavior                                                                                                                                    |
| ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Where to set it              | Vercel → **web** project → Environment Variables. Not the API project (Express GETs are always mounted).                                    |
| Preview vs Production        | Independent values. Trial `true` on Preview first.                                                                                          |
| Per request / per user       | **No.** One value for that deployment. Not a feature-flag SaaS.                                                                             |
| Client bundle                | Not included. `getDataRetrievalStrategy()` reads `process.env['DATA_READS_VIA_API']` **on each RSC call** (bracket access avoids inlining). |
| After changing the dashboard | Create a **new deployment** of web. Vercel binds env to a deployment; a running instance does not hot-swap. A code change is not required.  |
| Rebuild vs redeploy          | Redeploy is required. A full rebuild is only required if something else (e.g. `next.config` `env`) inlined the value — we do not do that.   |
| CI                           | `GITHUB_ACTIONS=true` still forces `ssr` even if the flag is `true`.                                                                        |

`turbo.json` lists the var under `globalEnv` / `build.env` so Turbo cache keys stay honest. That does **not** bake the value into the Next client bundle.

Production `true` still reintroduces the Express hop ([PERFORMANCE.md](../guides/PERFORMANCE.md)).

---

## Shared helper (app-wide)

```ts
type DataRetrievalStrategy = 'ssr' | 'api';
type DataRetrievalDomain = 'work-items'; // grow this union as GETs land

function getDataRetrievalStrategy(): DataRetrievalStrategy;
function shouldReadViaApi(domain: DataRetrievalDomain): boolean;
```

Rules:

1. `getDataRetrievalStrategy()` maps the boolean → `'ssr' | 'api'`.
2. `shouldReadViaApi(domain)` is `strategy === 'api' && ALLOWED_DOMAINS.has(domain)`.
3. **First allowlist entry:** `'work-items'` only.
4. A domain **not** on the allowlist always uses SSR, even if the boolean is true.
5. Call `shouldReadViaApi` at the **top** of each opted-in server reader — not in layouts, not inside supabase query builders, not in Express.

That is how one app toggle is limited to work-items without a second env var.

---

## What to gate (work-items first)

Only readers that already have a Prisma Express twin:

| Server function              | SSR today   | Express twin             | Gate?         |
| ---------------------------- | ----------- | ------------------------ | ------------- |
| `getWorkItemsPaginated`      | supabase-js | `GET /api/workItems`     | **Yes**       |
| `getWorkItem`                | supabase-js | `GET /api/workItems/:id` | **Yes**       |
| `getWorkItems` (unpaginated) | supabase-js | none yet                 | No — stay SSR |
| `getWorkItemAncestors`       | supabase-js | none yet                 | No — stay SSR |
| Worklogs / attachments list  | supabase-js | none / Storage           | No            |

When a later domain adds Prisma `listPaginated` / `getDetailById`:

1. Add the domain to `DataRetrievalDomain` + `ALLOWED_DOMAINS`.
2. Branch that domain’s `*.service.server.ts` the same way.
3. Do not add a new env var.

---

## Implementation steps

Do these in order. Do not scatter `if (process.env…)` in pages.

### 1. Types (~15 min)

- Add `DataRetrievalStrategy` and `DataRetrievalDomain` to `@repo/types` (small, shared).
- No Zod (this is not a mutation DTO).

### 2. Server helper (~30 min)

- Add `apps/web/lib/data-retrieval.server.ts`.
- Parse `DATA_READS_VIA_API`; default false; CI false.
- Export `getDataRetrievalStrategy` + `shouldReadViaApi`.
- Unit-test: unset / `true` / `false` / junk → strategy; allowlist hides non-work-items.

### 3. Work-items SSR readers (~2–3 h)

In `workItem.service.server.ts` (and only there for this cut):

1. Keep the current supabase-js bodies as private functions (`listPaginatedFromSupabase`, `getByIdFromSupabase`).
2. Add `listPaginatedFromApi` / `getByIdFromApi` using **server** `apiFetch` (`api-client.server.ts`) so the Bearer token stays request-cached.
3. Map list filters → query string (`projectId`, `sprintId=null`, `parentId` / `view=hierarchy`, `type`, `assigneeId`, `labels`, `search`, `page`, `limit`) using the same semantics as `listWorkItemsQuerySchema`.
4. Map Express JSON (ISO date strings) onto the `DbWorkItem` shape pages already consume. Do not change table/UI types in this step.
5. Public functions:

```ts
export async function getWorkItemsPaginated(...) {
  if (shouldReadViaApi('work-items')) {
    return listPaginatedFromApi(...);
  }
  return listPaginatedFromSupabase(...);
}
```

Same for `getWorkItem` (404 / null stays `null` for the page).

6. Wrap API errors with the existing `safeServerFetch` callers — pages should not need new try/catch.

### 4. Tests (~1 h)

- Helper tests (step 2).
- Work-item server tests: mock `shouldReadViaApi` true/false; assert supabase **or** `apiFetch` is used, never both.
- Do not switch Cypress to `api` in this cut.

### 5. Env / ops (~15 min)

- Document `DATA_READS_VIA_API` in this file and a **comment** in `apps/web/sample.env` (optional, server-only, default off).
- Vercel: set only on the **web** project when you want to trial the hop (Preview first). API needs no new var.

### 6. Later domains (repeat per feature)

After that domain’s Prisma GET exists ([API_VERSIONING.md](./API_VERSIONING.md) per-feature slice):

1. Extend `DataRetrievalDomain` + allowlist.
2. Branch its `*.service.server.ts`.
3. Tests as in step 4.

No new toggle.

---

## Non-goals

- Per-user, per-request, or UI switches
- Feature-flag SaaS
- Gating mutations, Auth, Storage, or optimistic-lock `getById` on the API
- Importing `@repo/db` / Prisma into `apps/web`
- Turning the toggle **on** in production as part of the first PR (ship helper + work-items branch **default off**)

---

## Performance and drift

Turning `DATA_READS_VIA_API=true` **reintroduces** `web → Express → DB` for allowlisted reads. That is intentional and measurable ([PERFORMANCE.md](../guides/PERFORMANCE.md)).

Two implementations will drift unless:

- Prisma `select` in `@repo/types` stays aligned with RSC `workItemListSelect`
- API unit tests cover Express GET filters
- Web tests cover both branches of the gated functions

---

## Rollout

| Step | Work                                           | Status                                 |
| ---- | ---------------------------------------------- | -------------------------------------- |
| 0    | This plan                                      | Done                                   |
| 1    | Helper + types + tests                         | **Done** (work-items allowlist)        |
| 2    | Gate work-items list/detail (default `ssr`)    | **Done**                               |
| 3    | Optional Preview env `DATA_READS_VIA_API=true` | After 2 is green                       |
| 4    | More domains as Prisma GETs land               | Later                                  |
| 5    | Production `true`                              | Explicit perf decision — not automatic |

---

## Testing the toggle locally

```bash
# default — RSC supabase-js
pnpm turbo run dev

# trial Express Prisma reads for allowlisted domains (work-items)
DATA_READS_VIA_API=true pnpm turbo run dev
```
