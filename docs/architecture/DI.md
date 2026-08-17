# API dependency injection (composition root)

**Status:** Plan (Living for work-items, sprints, and chat slices)  
**Scope:** `apps/api` only — Express routers, services, repositories  
**Last updated:** August 17, 2026

Related: [TRD.md](./TRD.md), [API_VERSIONING.md](./API_VERSIONING.md) (composition prerequisite, unused Express GETs, `/api/v1`).

## 1. Why

Today most API domains wire themselves with **module-level singletons**:

```ts
export const workItemRepository = new WorkItemRepository();
export const workItemService = new WorkItemService();
// route imports workItemService at module load
```

That works for a single process and is fine while services stay **stateless**. It becomes brittle when we want to:

- Unit-test a route/service with fakes (without mocking the module graph)
- Swap clients (e.g. Supabase) at the edge of the process
- Self-host or run multiple workers with a clear boot boundary
- Avoid accidentally parking request/session state on a shared instance

We are not introducing Nest, Inversify, or a DI container. The pattern is **manual composition root + constructor injection**.

## 2. Principles

1. **Composition root** — `apps/api/src/config/composition.ts` builds domain graphs once per process; `routing.ts` mounts them; `index.ts` stays thin.
2. **Constructor injection** — repositories take `db`; services take repositories; routers take services via a factory.
3. **Process singletons are intentional** — shared HTTP clients (`supabase`, `authClient`) and the built service graph live once per process. They must remain **stateless** (no request Maps, no session fields).
4. **No per-request services** — do not `new WorkItemService()` inside handlers.
5. **Migrate by slice** — convert one domain at a time; other routes may keep module singletons until touched. **All product domains must be composed before API URL versioning** ([API_VERSIONING.md](./API_VERSIONING.md) prerequisite).
6. **Narrow deps** — prefer `Pick<Service, 'method'>` (or a small interface) at the router boundary so tests can pass stubs.

## 3. Target shape

```mermaid
flowchart TB
  root["config/composition.ts"]
  db["supabase client"]
  repo["new WorkItemRepository(db)"]
  svc["new WorkItemService(repo)"]
  notif["notifications (composed)"]
  router["createWorkItemsRouter({ workItemService, notificationsService })"]
  routing["routing.ts mounts workItems.router"]
  app["index.ts → app.use(routesConfig)"]

  root --> db
  root --> repo
  root --> svc
  root --> notif
  root --> router
  routing --> router
  app --> routing
  repo --> db
  svc --> repo
  router --> svc
  router --> notif
```

| Layer                   | Responsibility                         | Receives                          |
| ----------------------- | -------------------------------------- | --------------------------------- |
| Repository              | Supabase / data access                 | `SupabaseClient<Database>`        |
| Service                 | Domain orchestration                   | Repository instance(s)            |
| Route factory           | HTTP, validation, status codes         | Service(s) (+ cross-cutting deps) |
| `config/composition.ts` | Wire domains; export injection configs | Shared clients + peer services    |
| `config/routing.ts`     | Mount routers; export `routesConfig`   | Composed routers from composition |
| `index.ts`              | Middleware + `app.use(routesConfig)`   | —                                 |

## 4. Migrated slices (reference)

### Work-items (first)

| Piece            | Path                                                                             |
| ---------------- | -------------------------------------------------------------------------------- |
| Repository       | `apps/api/src/routes/api/workItems/workItems.repository.ts`                      |
| Service          | `apps/api/src/routes/api/workItems/workItems.service.ts`                         |
| Route factory    | `apps/api/src/routes/api/workItems/workItems.route.ts` → `createWorkItemsRouter` |
| Injection config | `apps/api/src/config/composition.ts` → `workItems`                               |
| Route mount      | `apps/api/src/config/routing.ts` → `workItems.router`                            |
| Boot             | `apps/api/src/index.ts` → `app.use(routesConfig)`                                |

Notifications are composed (`composition.ts` → `notifications`) and injected into the work-items **and** comments routers/services so assign/mention side-effects stay testable.

Unused Prisma reads on this slice: `WorkItemRepository.listPaginated` / `getDetailById` → `WorkItemService.listWorkItemsPaginated` / `getWorkItemDetail` → `GET /api/workItems` and `GET /api/workItems/:id`. Mutation `getById` remains supabase-js. Next.js does not call the new GETs yet.

### Sprints

| Piece            | Path                                                                      |
| ---------------- | ------------------------------------------------------------------------- |
| Repositories     | `sprints.repository.ts` (`SprintsRepository`, `SprintBurndownRepository`) |
| Services         | `sprints.service.ts`                                                      |
| Route factory    | `createSprintsRouter`                                                     |
| Injection config | `composition.ts` → `sprints`                                              |
| Route mount      | `routing.ts` → `sprints.router`                                           |

### Attachments

| Piece            | Path                                                            |
| ---------------- | --------------------------------------------------------------- |
| Repository       | `apps/api/src/routes/api/attachments/attachments.repository.ts` |
| Service          | `apps/api/src/routes/api/attachments/attachments.service.ts`    |
| Route factory    | `createAttachmentsRouter`                                       |
| Injection config | `composition.ts` → `attachments`                                |
| Route mount      | `routing.ts` → `attachments.router`                             |

Prisma mutations stay on the process `prisma` client (same as work-items). PostgREST reads (`getById`, `workItemExists`) use the injected `SupabaseClient`.

### Comments

| Piece            | Path                                                                         |
| ---------------- | ---------------------------------------------------------------------------- |
| Repository       | `apps/api/src/routes/api/comments/comments.repository.ts`                    |
| Service          | `CommentsService` — receives `notificationsService` for mention side-effects |
| Route factory    | `createCommentsRouter`                                                       |
| Injection config | `composition.ts` → `comments`                                                |
| Route mount      | `routing.ts` → `comments.router`                                             |

### Access allowlist

| Piece            | Path                                                                    |
| ---------------- | ----------------------------------------------------------------------- |
| Repository       | `apps/api/src/routes/api/accessAllowlist/accessAllowlist.repository.ts` |
| Service          | `AccessAllowlistService`                                                |
| Route factory    | `createAccessAllowlistRouter`                                           |
| Injection config | `composition.ts` → `accessAllowlist`                                    |
| Route mount      | `routing.ts` → `accessAllowlist.router`                                 |

### Notifications

| Piece            | Path                                                                               |
| ---------------- | ---------------------------------------------------------------------------------- |
| Repository       | `apps/api/src/routes/api/notifications/notifications.repository.ts`                |
| Service          | `NotificationsService` — builders, due-date rules, UUID gate; no direct DB clients |
| Route factory    | `createNotificationsRouter`                                                        |
| Injection config | `composition.ts` → `notifications` (built **before** comments and work-items)      |
| Route mount      | `routing.ts` → `notifications.router`                                              |

PostgREST reads (admins, actor name, due work items, existing due-date rows) use the injected client. Prisma writes stay on the process `prisma` helper (`insert` / `insertMany` / `create`).

### Chat

| Piece            | Path                                                           |
| ---------------- | -------------------------------------------------------------- |
| Repository       | `apps/api/src/routes/api/chat/chat.repository.ts`              |
| Service          | `apps/api/src/routes/api/chat/chat.service.ts` → `ChatService` |
| Route factory    | `createChatRouter`                                             |
| Injection config | `composition.ts` → `chat`                                      |
| Route mount      | `routing.ts` → `chat.router`                                   |

Chat receives `workItemService` and `sprintsService` from the composition root for tool mutations (avoids importing `composition.ts` from the service). Projects create/list still use the projects module singletons until that domain is migrated. Pure helpers (`chatHistoryToMarkdown`, `markdownToChatHistory`, `sanitizeLog`) stay module-level.

## 5. Migration checklist (next domain)

When converting e.g. projects or users:

1. Add a constructor to the repository (`db: SupabaseClient<Database>`).
2. Add a constructor to the service (inject repository).
3. Replace `export default router` with `createXRouter(deps)`.
4. Add a `createXConfig()` + export (e.g. `projects`) in `config/composition.ts`.
5. Mount `x.router` from `routing.ts` instead of the old default import.
6. Remove bottom-of-file `export const xService = new …` once nothing imports it.
7. Leave unrelated domains on singletons.

### Do not in the first pass for a domain

- Per-request service creation
- Injecting Zod schemas / pure helpers
- Rewriting every cross-domain dependency in the same PR (pass existing singletons)
- Changing `apps/web` — this is API-only

## 6. Testing sketch

```ts
const fakeRepo = { getById: async () => ({ id: '…' /* … */ }) };
const workItemService = new WorkItemService(fakeRepo as WorkItemRepository);
const notificationsService = {
  createAssignNotification: async () => {},
};
const router = createWorkItemsRouter({ workItemService, notificationsService });
// mount on a test Express app and assert status / body
```

## 7. Multi-instance note

Process singletons are safe across multiple hosts **only if they hold no in-memory business state**. Prefer Postgres / Redis for anything that must be shared. DI makes the boot graph explicit; it does not by itself make stateful singletons safe.

## Related

- [TRD.md](./TRD.md) — system architecture
- [INFRASTRUCTURE.md](../guides/INFRASTRUCTURE.md) — hosting notes
