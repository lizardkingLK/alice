# API versioning, Prisma reads, and mutation DTOs

Status: **Plan**  
Last updated: 2026-08-18 (versioned `@repo/types` schemas as wire DTOs)  
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
| First `/api/v1` on **health**                             | Tiny, no persistence, proves mount + composition + version-details schema without a product domain                                     |

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

Still on module singletons (as of this update): **users, projects, teams, saved-views**. Health can be versioned first because it has no repository. **Profile** is wired through composition but was previously unversioned on the HTTP mount table.

### Why the composition root is the versioning **factory** switchboard

Composition builds **which router instance** is v1 vs v2. It does **not** own URI prefixes.

```text
composition.ts
  usersRepository     × 1
  usersService        × 1
  createUsersV1Router(usersService)
  createUsersV2Router(usersService | usersServiceV2)
routing.ts          ← version mediator (path map)
  /api/users      → users.v1Router   (alias)
  /api/v1/users   → users.v1Router
  /api/v2/users   → users.v2Router
```

Without composition, v2 copies route+service+repo (Sonar duplication, two Prisma clients). With it, versioning is extra **factories**; with `routing.ts`, versioning is extra **mounts**.

### Where the version mediator lives

Today we already mediate versions as **explicit path maps** in `apps/api/src/config/routing.ts` (`routesConfig.use('/api/v1/health', health.router)`). That is **neither** Express middleware **nor** composition — and that is the right layer.

| Layer                       | Owns                                                                                                      | Does not own                                  |
| --------------------------- | --------------------------------------------------------------------------------------------------------- | --------------------------------------------- |
| **Composition**             | One router factory per domain; same v1 instance for aliases; a v2 factory only if behavior/schema breaks  | HTTP prefixes, `app.use`, `/api/v1` vs `/api` |
| **`routing.ts` (path map)** | Mount table: `/api/v1/<resource>` + unversioned alias. Future `mountVersioned(...)` helper lives **here** | Prisma, services, Zod                         |
| **Per-route middleware**    | Optional later: reject **unknown** versions (`/api/v3` → 404) **in front of** the path map                | Parsing `/api/vN` inside each handler         |
| **URL rewrite middleware**  | Not first. Hides mounts; v2 with a different router still needs a registry                                | Replacing the mount table                     |

**Do not** put prefixes in `composition.ts` — that mixes the DI graph with HTTP topology.

**Do not** copy `health.route.ts` → `health.v1.route.ts`. Extra **mounts**, not extra files.

When the mount list grows (product `/api/v1` aliases), replace the copy-pasted `use()` lines with a helper **in routing.ts**, for example:

```ts
mountAliased(routesConfig, health.v1Router, ['/api/health', '/api/v1/health']);
mountVersioned(routesConfig, {
  v2: health.v2Router,
  path: '/api/v2/health',
});
```

That helper is still the route-definition mediator. Composition exports `{ v1Router, v2Router, … }`; `routing.ts` owns prefixes.

Health ships a **reference** v2 at `/api/v2/health`. Product domains add v2 only when their wire or behavior breaks.

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

Work-items first cut lives in `packages/types/src/api/v1/work-items.ts`. Attachments, sprint, work-log, and profile v1 wire DTOs live in `packages/types/src/api/v1/attachments.ts`, `sprints.ts`, `work-item-worklogs.ts`, and `profile.ts` (profile is self detail only — no list).

Mutation example (unchanged rule):

```ts
export const createUserBodySchema = z.object({/* … */});
export type CreateUserBody = z.infer<typeof createUserBodySchema>;
```

Do not redeclare `CreateUserInput` in `apps/web` (users still do this today).

---

## How versioned types are the DTO

There is **no** Java/C# DTO class. The DTO is the **JSON wire shape** for that URL version. `@repo/types` `api/vN/` holds that shape as a **schema + inferred type**. The service return type is that type; `res.json(...)` is the DTO on the wire.

```text
@repo/types api/vN/<resource>.ts
  schema  →  type = z.infer<typeof schema>     (or Prisma GetPayload)
                 ↓
composition     HealthService.getVersionDetails(): ApiVersionDetails
                 ↓
route           res.json(service.getVersionDetails())   ← HTTP JSON = DTO
                 ↓
client          apiFetch<ApiVersionDetails>('/api/v1/health')
```

Health is the smallest example:

| Piece               | v1 DTO                                      | v2 DTO                                          |
| ------------------- | ------------------------------------------- | ----------------------------------------------- |
| Schema              | `apiVersionDetailsSchema`                   | `apiVersionDetailsV2Schema`                     |
| Type                | `ApiVersionDetails` (`z.infer`)             | `ApiVersionDetailsV2`                           |
| Canonical / fixture | `API_V1_HEALTH` (`satisfies` the type)      | `apiV2HealthPayload(checkedAt)`                 |
| Service             | `HealthService` returns `ApiVersionDetails` | `HealthServiceV2` returns `ApiVersionDetailsV2` |
| Path                | `/api/v1/health`                            | `/api/v2/health`                                |

Same repository record. Different DTO because the **mapper in the version service** picks fields (`checkedAt` dropped on v1, required on v2). That is what “version the schema” means: **version the wire DTO**, not the table row.

### Three DTO kinds (same package)

| Kind                            | Source of truth                | Runtime?                                                                                                                                              | Example                                           |
| ------------------------------- | ------------------------------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------- |
| **Input DTO**                   | Zod schema in `api/vN/`        | **Yes** — `schema.safeParse(req.body \| req.query)` at the route                                                                                      | `listWorkItemsQuerySchema` → `ListWorkItemsQuery` |
| **Static / probe response DTO** | Zod schema + `z.infer`         | Schema is the contract; health does **not** `safeParse` every response (payload is built in the service). Tests and clients still use the schema/type | `ApiVersionDetails`                               |
| **Table-read response DTO**     | Prisma `select` + `GetPayload` | Compile-time only. `res.json(row)` **is** the v1 DTO until a mapper exists                                                                            | `WorkItemListRow`                                 |

Rules:

1. **Export schema and type together** (`export const xSchema` + `export type X = z.infer<typeof xSchema>`). The schema is the runtime DTO; the type is the compile-time DTO. Do not hand-write a parallel `interface`.
2. **Version folders version DTOs.** `api/v1/health.ts` and `api/v2/health.ts` are two contracts. Additive optional fields stay on the same version; required/rename/drop → new `api/vN/`.
3. **Prisma `GetPayload` is a DTO only while it matches the JSON.** It is the repository return type. The moment v2 JSON differs from the row (extra field, rename, omit), add a Zod (or mapped) type in `api/v2/` and map in `*ServiceV2` — same as health `checkedAt`.
4. **Clients import the type from `@repo/types`**, not a local copy:

   ```ts
   import type { ApiVersionDetails } from '@repo/types';
   const body = await apiFetch<ApiVersionDetails>('/api/v1/health');
   ```

5. **`satisfies` / fixture helpers** (`API_V1_HEALTH`, `apiV2HealthPayload`) prove a literal matches the DTO. They are not a second DTO.
6. **Shared identity, versioned extras.** Fields every health version returns (`status`, `runtime`, `name`) live on `apiHealthIdentitySchema`. v1/v2 **extend** that base (`version`, and v2 `checkedAt`). Do not copy the identity object into each version file.

### What is _not_ a DTO

- Repository records (`HealthVersionRecord`, Prisma rows before a mapper) — internal.
- Express `Request` / `Response`.
- RSC `Tables<'work_items'>` — DB/PostgREST shape, not the Express versioned wire (until the retrieval toggle points at the GET).

---

## `@repo/types` directory (application DTOs)

Stand this up **once** (~1h), then fill per feature:

```text
packages/types/src/
  api/
    v1/
      index.ts              # re-export v1 mutation schemas + shared selects
      health.ts             # apiVersionDetailsSchema + API_V1_HEALTH
      users.ts
      work-items.ts
      …
    v2/
      index.ts              # re-export v2 wire schemas (when a version breaks)
      health.ts             # apiVersionDetailsV2Schema (+ checkedAt)
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

## First versioning example: health (v1 + v2 reference)

Health is the **reference slice** for URL versioning: shared repository, version-specific services and route factories, mounts in `routing.ts`. There is no real database table — the repository is a stand-in for `repository → service → router` wiring.

`GET /` is **not** a health alias — it is a plain listening status from `createRootRouter`.

### v1 (compat + explicit)

| Piece                | Path                                                                               |
| -------------------- | ---------------------------------------------------------------------------------- |
| Schema               | `packages/types/src/api/v1/health.ts` (`apiVersionDetailsSchema`, `API_V1_HEALTH`) |
| Repository           | `health.repository.ts` — `getVersionRecord()` (shared; injectable clock for tests) |
| Service              | `HealthService` — maps record → v1 wire (drops `checkedAt`)                        |
| Route factory        | `createHealthRouter({ healthService })`                                            |
| Composition          | `composition.ts` → `health` (`healthRepository`, `healthService`, `v1Router`)      |
| Mounts (same router) | `GET /api/health`, `GET /api/v1/health`                                            |

v1 payload:

```json
{
  "status": "ok",
  "runtime": "express",
  "name": "alice-api",
  "version": "v1"
}
```

### v2 (breaking wire — additive required field)

Introduced when the **response contract** changes. v1 stays mounted for existing probes; v2 gets its **own path only** (no unversioned alias).

| Piece         | Path                                                                                 |
| ------------- | ------------------------------------------------------------------------------------ |
| Schema        | `packages/types/src/api/v2/health.ts` (`apiVersionDetailsV2Schema`, `checkedAt`)     |
| Repository    | **Same** `HealthRepository` instance as v1                                           |
| Service       | `HealthServiceV2` — maps the same record → v2 wire (includes `checkedAt`, `version`) |
| Route factory | `createHealthV2Router({ healthService: healthServiceV2 })`                           |
| Composition   | `healthServiceV2`, `v2Router` alongside v1 exports                                   |
| Mount         | `GET /api/v2/health` only                                                            |

v2 payload:

```json
{
  "status": "ok",
  "runtime": "express",
  "name": "alice-api",
  "version": "v2",
  "checkedAt": "2026-08-18T06:00:00.000Z"
}
```

```text
composition.ts
  healthRepository   × 1          ← shared
  HealthService      → v1Router   ← /api/health, /api/v1/health
  HealthServiceV2    → v2Router   ← /api/v2/health
routing.ts
  routesConfig.use('/api/health', health.v1Router);
  routesConfig.use('/api/v1/health', health.v1Router);
  routesConfig.use('/api/v2/health', health.v2Router);
```

`status` + `runtime` stay on both versions so existing probes still work. v2 adds `checkedAt` as the **breaking** demonstration (required on v2, absent on v1).

Pattern to copy for product resources:

1. Zod (or Prisma `select`) in `@repo/types` `api/v1/`; new wire → `api/v2/` (or `vN/`).
2. **One repository** per domain; version services map to their contract.
3. `createXRouter` / `createXV2Router` — no `export default router`; no `health.v1.route.ts` file copies.
4. `createXConfig()` in `composition.ts` exports `v1Router`, `v2Router` (when needed).
5. Mount v1 at `/api/<resource>` (compat) **and** `/api/v1/<resource>`; mount v2 at `/api/v2/<resource>` only.
6. Do **not** remove v1 until callers migrate.

Do **not** copy `health.route.ts` into `health.v1.route.ts`. Versioning is extra **factories and mounts**, not duplicated route files.

---

## Version “middleware” when you scale to many versions (v1..v5)

When you have 5+ versions, the main risk is letting version parsing/validation get duplicated inside each feature handler.

Keep this rule:

1. **`routing.ts` remains the mount table** for versioned routes (factory outputs are mounted under `/api/vN/...`).
2. Optional middleware becomes a **single guard in front of the mount table**, so unknown versions get a consistent response (and you avoid doing this check per-feature).

### Recommended shape

Put an Express “version guard” router directly under the version prefix, before the mounts:

```ts
// routing.ts
const knownVersions = new Set(['v1', 'v2', 'v3', 'v4', 'v5']);

const versionGuard = Router();
versionGuard.use('/:v', (req, res, next) => {
  const { v } = req.params; // e.g. "v3"
  if (!knownVersions.has(v)) {
    return res.status(404).json({ error: 'unknown_api_version' });
  }
  return next();
});

routesConfig.use('/api/v', versionGuard);

// Mount versioned routers after the guard.
routesConfig.use('/api/v1/health', health.v1Router);
routesConfig.use('/api/v2/health', health.v2Router);
// ...
routesConfig.use('/api/v5/workItems', workItems.v5Router);
```

### Why a single guard instead of per-route middleware

- It avoids duplicated “does vN exist?” logic across 10+ feature routes.
- It preserves the DI boundary: feature routers still only implement behavior, not HTTP version negotiation.
- It stays compatible with the current approach where versioning is handled by explicit mounts in `routing.ts`.

### What not to do

- Do not put version switching in each handler (e.g. inside `workItems.route.ts`).
- Do not hide the mount table behind a rewrite that would make it unclear which router owns `/api/vN/<resource>`.

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

| Place                                                     | Zod?                                                                    |
| --------------------------------------------------------- | ----------------------------------------------------------------------- |
| Express mutation body / query that is not a Prisma select | **Always** `safeParse`                                                  |
| Next forms                                                | Same **input** schema (UX); API still parses                            |
| Express unused GET                                        | Query params (page, search) yes; **response body** no                   |
| Health / version details                                  | Schema in `@repo/types`; static payload, no `safeParse` on each request |
| RSC supabase-js lists                                     | No parse of every row                                                   |

---

## Mutation schema migration (work-items pilot)

**Goal:** one Zod input schema per write DTO in `@repo/types` `api/v1/<resource>.ts`, imported by Express **and** web form/mutation clients. API still `safeParse`s every mutation; web may `safeParse` before `fetch` for faster UX.

### Current state (work-items)

| Layer          | Location                                  | Notes                                                  |
| -------------- | ----------------------------------------- | ------------------------------------------------------ |
| API            | `apps/api/.../workItems.schemas.ts`       | Create + PATCH body Zod (to move)                      |
| Types v1 reads | `packages/types/src/api/v1/work-items.ts` | Prisma selects + `listWorkItemsQuerySchema` only       |
| Web            | `work-items.mutations.client.ts`          | Hand-built `FormData` → `Record` → JSON; no shared Zod |

### Target layout

```text
packages/types/src/api/v1/work-items.ts
  # reads (existing)
  workItemListSelect, listWorkItemsQuerySchema, …
  # writes (new)
  createWorkItemBodySchema, patchWorkItemBodySchema
  workItemLifecycleActionBodySchema, patchWorkItemStatusBodySchema
  preprocessWorkItemMutationBody()   # description JSON + labels coerce
  isBlockedPastDueDateChange()       # PATCH-only due_date rule (pure fn)
  z.infer types: CreateWorkItemBody, PatchWorkItemBody, …

apps/api/.../workItems.schemas.ts
  re-export from @repo/types/api/v1 (thin shim until imports updated)

apps/web/app/work-items/_helpers/work-item-mutation-body.ts
  parseCreateWorkItemFormData(formData)  → safeParse via v1 schema
  parsePatchWorkItemFormData(formData, expectedUpdatedAt)

apps/web/.../work-items.mutations.client.ts
  use parsers; typed bodies instead of Record<string, unknown>
```

### Per-feature checklist (work-items first)

1. **Move wire schemas** from API-local file → `packages/types/src/api/v1/<resource>.ts`; export from `api/v1/index.ts`.
2. **API route** imports schemas from `@repo/types`; local file becomes re-export shim (or delete when call sites updated).
3. **Shared preprocessors** (FormData/JSON description parse, labels coerce) live in types when API and web both need them.
4. **Web mutation client** parses through the same schema before `apiFetch`; throw/ surface `z.treeifyError` for forms.
5. **Tests:** keep `safeParse` fixtures in API tests importing `@repo/types` (types package has no Vitest yet).
6. **Rollout order after work-items:** comments → projects → teams → users → sprints (each follows the same checklist).

### Out of scope (this slice)

- Client-side Zod in every form component (optional UX follow-up; mutation client parse is the minimum).
- Zod output/response schemas for mutation responses (Prisma payload / existing wire shape stays as-is).
- `/api/v1/workItems` mount (step 5; schemas are version-agnostic until a breaking wire change).
- Prisma Client inside `apps/web` for reads — use [DATA_RETRIEVAL.md](./DATA_RETRIEVAL.md) (`reads.api.server.ts` + toggle) instead.

---

## Rollout

| Step | Work                                                                                                    | Status                                                                                                                                                                                                                                                                                                                            |
| ---- | ------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 0    | This plan                                                                                               | **Now**                                                                                                                                                                                                                                                                                                                           |
| 1    | Composition root for remaining domains (users, projects, teams, saved-views)                            | In progress (profile composition **done**)                                                                                                                                                                                                                                                                                        |
| 2    | `packages/types/src/api/v1/` directory tree (~1h)                                                       | **Started** (work-items selects + list query Zod)                                                                                                                                                                                                                                                                                 |
| 3    | Per feature: unused Prisma GETs (~4h) + Zod isolation (~2h)                                             | **Started** (work-items, sprints, **attachments** + **worklogs** list GET; **profile** v1 Zod in `@repo/types`; work-items **mutation** Zod → `@repo/types` v1; **saved-views** mutation Zod + wire DTOs in `@repo/types` `api/v1/saved-views.ts` — see [Mutation schema migration](#mutation-schema-migration-work-items-pilot)) |
| 3b   | Web form/mutation clients import v1 input schemas (work-items pilot)                                    | **Done** (create/patch/status/lifecycle + force-patch + link PR; `work-items.mutations.client.ts`)                                                                                                                                                                                                                                |
| 4    | Health v1 as `/api/v1/health` (~1h)                                                                     | **Done** (alias `/api/health`; `GET /` is root status)                                                                                                                                                                                                                                                                            |
| 4b   | Health v2 reference (`/api/v2/health`, shared repo, `HealthServiceV2`)                                  | **Done** (template for product v2)                                                                                                                                                                                                                                                                                                |
| 5    | Product `/api/v1` aliases once GETs exist                                                               | **Started** (`/api/v1/attachments`, `/api/v1/worklogs`, `/api/v1/profile`, `/api/v1/saved-views`, `/api/v1/integrations` aliases mounted)                                                                                                                                                                                         |
| 6    | Optional: point RSC at Express GETs via [DATA_RETRIEVAL.md](./DATA_RETRIEVAL.md) (`DATA_READS_VIA_API`) | Plan (default off)                                                                                                                                                                                                                                                                                                                |
| 7    | Mark this doc **Living**                                                                                | After 4                                                                                                                                                                                                                                                                                                                           |

---

## Testing

Unused Prisma GETs are not optional to test. Each new fetch path needs:

- **Where/filter builder** (or equivalent) vs the RSC filter semantics (project, sprint/backlog, parent/hierarchy, type, assignee, labels OR, title/labels search, `created_at` desc, page/limit).
- **Repository** with a mocked Prisma client: assert `select`, `where`, `orderBy`, `skip`/`take` (and `count` for lists).
- **HTTP handler** (auth + 400/404/200): list envelope and detail 404. Do not rely on Next/Cypress to cover unused GETs.

Also:

- Mutation schemas: one `safeParse` fixture per write DTO in types or API tests.
- Health v1: `GET /api/v1/health` (and `/api/health`) → `{ status, runtime, name, version }` matching `apiVersionDetailsSchema`.
- Health v2: `GET /api/v2/health` → v2 shape with `checkedAt` matching `apiVersionDetailsV2Schema`.
- Repository: `HealthRepository.getVersionRecord()` unit-tested (injectable clock).
- Root: `GET /` → plain listening status (not JSON version details).
- Do not add Zod parse of list pages in Cypress.

---

## Non-goals (this phase)

- Switching RSC list pages to Express (hop)
- Hand-written output DTO classes that duplicate Prisma `GetPayload`
- Zod-parsing every SSR row
- Next.js `app/api` as the product CRUD API
- OpenAPI generation
- `/api/v2` without a breaking behavior or wire change
