# API versioning, Prisma reads, and mutation DTOs

Status: **Plan**  
Last updated: 2026-08-17 (Prisma-only unused Express GETs + retrieval toggle plan)  
Scope: `@repo/types`, `apps/api` HTTP contract, `apps/web` RSC + mutation fetches

Adopted direction (engineering): keep **SSR list/detail on supabase-js** for speed; **add matching Express GET/list handlers** (route → service → repository) so a future team can switch those reads to Prisma without rewriting the domain; **do not call those GETs from Next yet**. Those unused Express reads use **Prisma only** — not supabase-js — so the escape hatch is explicit. Zod + `z.infer` stay required for **mutation inputs**. Prisma `select` payload types cover **read** shapes inside the API. Existing mutation `getById` / optimistic-lock follow-up reads stay on supabase-js.

Related:

- [TRD.md](./TRD.md) — app boundaries (RSC reads vs Express mutations)
- [DI.md](./DI.md) — composition root (**prerequisite**)
- [DATABASE.md](../guides/DATABASE.md) — Prisma vs supabase-js; web must not import `@repo/db`
- [PERFORMANCE.md](../guides/PERFORMANCE.md) — why RSC still talks to Supabase (the extra hop we are _not_ turning on yet)
- [DATA_RETRIEVAL.md](./DATA_RETRIEVAL.md) — app toggle (`DATA_READS_VIA_API`) to choose SSR vs Express reads
- [SONAR.md](../guides/SONAR.md) — duplication if v1/v2 copy whole modules

---

## Decision

This matches current constraints and is the right maintainability trade:

| Choice                                                    | Why it is good                                                                                                                         |
| --------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Leave RSC on supabase-js                                  | Avoids the `web → Express → DB` hop that [PERFORMANCE.md](../guides/PERFORMANCE.md) already paid to remove                             |
| Implement Express GETs anyway, unused                     | Gives an escape hatch if PostgREST/`Tables<>` on the web app becomes painful; swap callers later, keep route/service/repo              |
| **Prisma client for unused Express GETs**                 | Makes future-team intent clear: this path can replace frontend supabase-js reads. supabase-js GETs behind Express would only add a hop |
| Leave mutation `getById` / lock follow-ups on supabase-js | Do not churn working optimistic-lock paths in this phase                                                                               |
| Prisma payload types for API reads                        | `work_itemsGetPayload<{ select: typeof listSelect }>` follows the query; no hand-written list DTO required                             |
| Zod + `z.infer` for mutations **and GET query params**    | Forms, `req.body`, and list filters are not Prisma selects; response bodies are                                                        |
| First `/api/v1` on **health**                             | Tiny, no persistence, proves mount + composition without a product domain                                                              |

**Caveats (do not skip):**

1. **Unused GETs rot** unless each Prisma list/detail path has API unit tests (where/select/order/pagination parity with the RSC reader).
2. **Two query implementations** (RSC supabase-js vs API Prisma) will drift. Same `select` field list (shared const in `@repo/types`) on both sides.
3. Prisma payload types are **not** an HTTP version. They are the repository return type. The JSON you `res.json` _is_ the v1 wire shape until you add a mapper. Omit secrets in the `select`, not after the fact.
4. Flipping RSC to Express later **reintroduces the hop**. That is an explicit product/perf decision, not an accident.

---

## Dual-path reads (now vs later)

```text
Now (used):
  Browser → Next proxy → RSC → supabase-js → Postgres

Now (implemented, unused — Prisma, not supabase-js):
  GET /api/…  →  route  →  service  →  repository (Prisma select)  →  Postgres

Later (optional switch via app toggle — see [DATA_RETRIEVAL.md](./DATA_RETRIEVAL.md)):
  Browser → Next → HTTP Express GET → Prisma → Postgres
  (extra hop; one query stack to maintain; `DATA_READS_VIA_API=true`)
```

Mutations stay on Express as today (`POST`/`PATCH`/`DELETE` + Zod). Mutation-side `getById` used by optimistic lock may keep supabase-js until a later pass.

### Which client owns which read

| Surface                                               | Client                                                | Why                                                    |
| ----------------------------------------------------- | ----------------------------------------------------- | ------------------------------------------------------ |
| RSC list/detail (used today)                          | supabase-js                                           | No Express hop                                         |
| Mutations + existing lock `getById`                   | Prisma write; current supabase-js reads **unchanged** | Do not churn working lock paths                        |
| New Express GET/list/detail (mounted, unused by Next) | **Prisma**                                            | Clear replacement for frontend fetches; tests required |

Do **not** implement unused Express GETs with supabase-js. That would still leave PostgREST to maintain and would not be an escape hatch.

---

## Prerequisite — finish the composition root

Do **not** mount `/api/v1` on product domains until remaining routers are wired through `composition.ts` ([DI.md](./DI.md)).

Still on module singletons (as of this update): **users, projects, teams, profile, saved-views**. Health can be versioned first because it has no repository.

### Why the composition root is the versioning switchboard

```text
composition.ts
  usersRepository     × 1
  usersService        × 1
  createUsersV1Router(usersService)
  createUsersV2Router(usersService | usersServiceV2)
routing.ts
  /api/users      → users.v1Router   (alias)
  /api/v1/users   → users.v1Router
  /api/v2/users   → users.v2Router
```

Without it, v2 copies route+service+repo (Sonar duplication, two Prisma clients). With it, versioning is extra **factories and mounts**.

### Sonar

| Mechanism                       | What to do                                | What not to do                                      |
| ------------------------------- | ----------------------------------------- | --------------------------------------------------- |
| One repo, one (or two) services | Inject the same instance into v1 and v2   | `UsersRepositoryV1` / `V2` with the same `findMany` |
| Route factories                 | Parameterize schema / status mapping      | Copy `users.route.ts` → `users.v2.route.ts`         |
| Alias v1                        | Same router at `/api` and `/api/v1`       | Two routers that differ only by path                |
| Shared select                   | One `select` object → Prisma payload type | Duplicate column lists in RSC and API               |

---

## Types: Prisma payloads vs Zod DTOs

We do **not** need a hand-written output DTO per table. We **do** need Zod for writes.

| Kind                       | Source of truth                                     | Where it lives                                                           |
| -------------------------- | --------------------------------------------------- | ------------------------------------------------------------------------ |
| List/detail **read** (API) | Prisma `select` + `GetPayload`                      | Next to the repository query (or a shared select const in `@repo/types`) |
| List/detail **read** (RSC) | supabase-js `select` string + `Tables` / mapped row | Existing `*.service.server.ts` until a switch                            |
| Create/update **body**     | Zod schema; type = `z.infer<typeof schema>`         | `@repo/types` (schema-first dual export)                                 |
| Secrets / tokens           | Never in `select`                                   | Repository `select` only                                                 |

```ts
const workItemListSelect = {
  id: true,
  title: true,
  status: true,
  // no jira_token / github_token
} satisfies Prisma.work_itemsSelect;

export type WorkItemListRow = Prisma.work_itemsGetPayload<{
  select: typeof workItemListSelect;
}>;
```

Work-items first cut lives in `packages/types/src/api/v1/work-items.ts` (`workItemListSelect`, `workItemDetailSelect`, `listWorkItemsQuerySchema`).

Mutation example (unchanged rule):

```ts
export const createUserBodySchema = z.object({/* … */});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
```

Do not redeclare `CreateUserInput` in `apps/web` (users still do this today).

---

## `@repo/types` directory (application DTOs)

Stand this up **once** (~1h), then fill per feature:

```text
packages/types/src/
  api/
    v1/
      index.ts              # re-export v1 mutation schemas + shared selects
      health.ts             # optional; health may stay inline
      users.ts
      work-items.ts
      …
    selects/                # optional: Prisma/PostgREST select consts shared with RSC
  generated/                # prisma + supabase — not a public UI import
```

Export via `packages/types/src/index.ts` or `@repo/types/api/v1`. Mutation Zod files that already live at the types root (`users.ts`, `projects.ts`, `access-allowlist.ts`) **move or re-export** into `api/v1/` as domains are touched — do not leave two schemas.

---

## Per-feature Prisma adaptation

For **each** member-owned feature, in order:

| Slice               | Work                                                                                                                                 | Est. |
| ------------------- | ------------------------------------------------------------------------------------------------------------------------------------ | ---- |
| Composition         | `createXConfig()` + `createXRouter` + mount from `routing.ts`; inject peer services (e.g. notifications)                             | ~1h  |
| Unused Express GETs | List/detail (and pagination) in **route → service → repository** using Prisma `select`. **Do not** change RSC/`apiFetch` callers yet | ~4h  |
| Mutation types      | Move/confirm Zod in `@repo/types`; `z.infer` on web forms and API `safeParse`; drop duplicate hand-written inputs                    | ~2h  |

Repository owns Prisma. Service orchestrates. Route parses query/body and maps status codes.

Unused GET still needs:

- Prisma `findMany` / `findUnique` (or `count`) in the repository — not supabase-js
- `requireApiAuth` (same as other product routes)
- API unit tests for the Prisma query (select, `where`, order, pagination) **and** the HTTP handler
- The same pagination/filter semantics as `runPaginatedSelect` / the feature’s server reader

First domain: **work-items** (`GET /api/workItems`, `GET /api/workItems/:id`). Next.js still reads via RSC supabase-js.

---

## First versioning example: health (~1h)

After composition + types tree exist, version **health** before a product resource.

Today: `GET /` → `{ status: 'ok', runtime: 'express' }` (`health.route.ts`, default export).

Target:

1. `createHealthRouter()` (composition, even with no repository).
2. Mount **the same router** at `/` (compat) and **`/api/v1/health`**.
3. No Zod, no Prisma. Proves URI prefix + factory without domain risk.
4. Optional: `GET /api/v1/health` in API tests.

Do **not** invent `/api/v2/health` until a real breaking change exists.

Product `/api/v1/<resource>` aliases follow the same pattern once that domain is composed and has unused GETs.

---

## What is versioned (not only JSON keys)

| Layer            | Version when…                                            | Share across v1/v2 when…                     |
| ---------------- | -------------------------------------------------------- | -------------------------------------------- |
| **Routes**       | Path, method, query, status, error envelope              | Alias `/api` → same v1 router                |
| **Zod inputs**   | Required field change, rename, drop                      | Additive optional fields                     |
| **Services**     | Behavior change (hard delete vs archive, page vs cursor) | Same use-case; only select/JSON keys changed |
| **Repositories** | Almost never                                             | Always (one Prisma `select` per query)       |

Anti-pattern: `WorkItemServiceV1` and `V2` that both `findMany` the same table.

---

## Where Zod runs

| Place                                                     | Zod?                                                  |
| --------------------------------------------------------- | ----------------------------------------------------- |
| Express mutation body / query that is not a Prisma select | **Always** `safeParse`                                |
| Next forms                                                | Same **input** schema (UX); API still parses          |
| Express unused GET                                        | Query params (page, search) yes; **response body** no |
| RSC supabase-js lists                                     | No parse of every row                                 |

---

## Rollout

| Step | Work                                                                                                    | Status                                                                                                  |
| ---- | ------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| 0    | This plan                                                                                               | **Now**                                                                                                 |
| 1    | Composition root for remaining domains (users, projects, teams, profile, saved-views)                   | In progress                                                                                             |
| 2    | `packages/types/src/api/v1/` directory tree (~1h)                                                       | **Started** (work-items selects + list query Zod)                                                       |
| 3    | Per feature: unused Prisma GETs (~4h) + Zod isolation (~2h)                                             | **Started** (work-items list/detail; mutation Zod stays in `workItems.schemas.ts` until web imports it) |
| 4    | Health as `/api/v1/health` (~1h)                                                                        | After 1–2                                                                                               |
| 5    | Product `/api/v1` aliases once GETs exist                                                               | After 3–4                                                                                               |
| 6    | Optional: point RSC at Express GETs via [DATA_RETRIEVAL.md](./DATA_RETRIEVAL.md) (`DATA_READS_VIA_API`) | Plan (default off)                                                                                      |
| 7    | Mark this doc **Living**                                                                                | After 4                                                                                                 |

---

## Testing

Unused Prisma GETs are not optional to test. Each new fetch path needs:

- **Where/filter builder** (or equivalent) vs the RSC filter semantics (project, sprint/backlog, parent/hierarchy, type, assignee, labels OR, title/labels search, `created_at` desc, page/limit).
- **Repository** with a mocked Prisma client: assert `select`, `where`, `orderBy`, `skip`/`take` (and `count` for lists).
- **HTTP handler** (auth + 400/404/200): list envelope and detail 404. Do not rely on Next/Cypress to cover unused GETs.

Also:

- Mutation schemas: one `safeParse` fixture per write DTO in types or API tests.
- Health: `GET /api/v1/health` → `{ status: 'ok', runtime: 'express' }`.
- Do not add Zod parse of list pages in Cypress.

---

## Non-goals (this phase)

- Switching RSC list pages to Express (hop)
- Hand-written output DTO classes that duplicate Prisma `GetPayload`
- Zod-parsing every SSR row
- Next.js `app/api` as the product CRUD API
- OpenAPI generation
- `/api/v2` without a breaking behavior or wire change
