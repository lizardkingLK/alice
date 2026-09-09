# Alice Assistant

Status: **Implemented**

Conversational assistant for creating and inspecting projects, sprints, and
work items. UI labels: **Alice** / sidebar **Alice**. System prompt
name: **Alice Assistant**. Provider: **Google Gemini** (REST
`generateContent` + function calling).

Related:

- Feature index: [README.md](./README.md)
- Workspace integrations (model pool, DB): [SETTINGS_INTEGRATIONS.md](../integrations/SETTINGS_INTEGRATIONS.md)
- Auth: [AUTHENTICATION.md](../../auth/AUTHENTICATION.md),
  [RBAC](../../auth/RBAC_AUTHORIZATION_SKELETON.md)
- Domain APIs: `apps/api/src/routes/api/{projects,sprints,workItems}/`
- Product roadmap (broader AI ideas): [ROADMAP.md](../../product/ROADMAP.md)

---

## Goals

- Let signed-in users ask in natural language to list/create **projects**,
  **sprints**, and **work items**.
- Attach and process documents (**JSON**, **CSV**, **Text**, and **Images**) directly in the chat composer.
- Use a **direct-to-storage upload session** flow to avoid Vercel/serverless request payload size limits.
- Automatically parse attached documents into hierarchical and flat work item trees (`parse_work_item_attachment`).
- Run **duplicate checking and similarity analysis** against existing project items (`check_work_item_duplicates`).
- Execute **batch work item imports** with hierarchy links and sprint assignments (`batch_import_work_items`).
- Enforce strict **project scope guardrails** keeping Alice dedicated solely to ALICE system operations.
- Persist multi-turn conversations and attachment metadata per user (sidebar history on `/chat`).
- Surface Alice from the dashboard **navbar** (between notifications and
  profile) without leaving the current route.
- Confirm intent in conversation before mutating (prompt-guided; no separate
  approval UI).

## Non-goals (current)

- Streaming token responses
- Vector RAG / embeddings over workspace content
- Slack / Teams / external chat integrations (see ROADMAP)
- Chat-specific RBAC beyond “authenticated user”
- Dedicated `chat_messages` table (history lives in Storage)
- Automatic triage, NL backlog search, or other ROADMAP AI items

---

## UX surfaces

| Surface         | Location                                  | Behavior                                                                                                                      |
| --------------- | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------- |
| Full page       | `/chat`                                   | Edge-to-edge in the dashboard shell (no card chrome); toggleable history sidebar; New Chat, delete, suggestions, action cards |
| Navbar launcher | All `DashboardShell` pages except `/chat` | Header control between notifications and profile → right drawer; same `ChatClient` (`variant="drawer"`)                       |
| Nav             | Platform → **Alice** (`Sparkles` icon)    | Links to `/chat`                                                                                                              |

Empty-state suggestions cover common flows (e.g. create a bug, list projects).
Successful mutations can render **executed action** cards with deep links to
the created entity. Header model: “Gemini 3.6” (dropdown).

### Composer

- Shared `@repo/ui` `Textarea` (page + drawer).
- **Enter** sends the message; **Shift+Enter** inserts a new line.
- Message bubbles use `whitespace-pre-wrap` so line breaks render in history.

### Message layout

- **Alice** messages stay **left** (bot avatar + label + muted card).
- **You** messages stay **right** (label + primary card + user profile avatar).
- User avatar uses `public.users.profile_picture` via shared `UserAvatar`
  (SSR props on `/chat`; dashboard shell passes the same into the drawer).

### Panel headers

Main **Alice** toolbar has a fixed `h-14` height.

### Data loading (PERFORMANCE.md)

| Surface         | Initial conversations                          | Initial message history                        | Interactions after mount                     |
| --------------- | ---------------------------------------------- | ---------------------------------------------- | -------------------------------------------- |
| `/chat` page    | RSC direct Supabase (`chat.service.server.ts`) | RSC `apiFetch` → API (Storage is service-role) | Client `apiFetch` for send / switch / delete |
| Floating drawer | Server action `listChatConversationsAction`    | Client `apiFetch` on open (Storage)            | Same                                         |

`/chat` uses `Suspense` + `safeServerFetch(getChatPageBootstrap())` so the
shell streams first; the client receives bootstrap props and **does not**
`useEffect`-fetch the same data again.

---

## Architecture

```text
ChatClient / FloatingChatWidget
  → apiFetch (Bearer JWT) → Express /api/chat
    → requireApiAuth
    → load/create chat_conversations row
    → inject workspace snapshot into system instruction
    → Gemini generateContent (+ tools), up to 5 tool rounds
    → domain services (projects / sprints / work items / users)
    → upsert history markdown in Supabase Storage
    → JSON { reply, history, actions, conversationId, title }
```

No Vercel AI SDK / OpenAI client — Gemini is called with `fetch` from
`ChatService` (`chat.service.ts`).

### API routes

All routes require `requireApiAuth`. Wired via composition root
(`config/composition.ts` → `chat.router` mounted in `routing.ts`). See
[DI.md](../../architecture/DI.md).

| Method   | Path                                      | Purpose                                                            |
| -------- | ----------------------------------------- | ------------------------------------------------------------------ |
| `POST`   | `/api/v1/chat/attachments/upload-session` | Mints direct-to-storage signed upload URL and token                |
| `POST`   | `/api/v1/chat/attachments/finalize`       | Strictly validates storage file and records database row in Prisma |
| `GET`    | `/api/v1/chat/attachments/:id`            | Mint signed preview and download URLs for active attachment        |
| `DELETE` | `/api/v1/chat/attachments/:id`            | Soft-delete attachment row (`status: 'archived'`) and removes file |
| `POST`   | `/api/v1/chat/attachments`                | Multipart fallback upload                                          |
| `GET`    | `/api/v1/chat`                            | Latest conversation history from Storage (or empty)                |
| `GET`    | `/api/v1/chat/:conversationId`            | Load one conversation’s history from Storage                       |
| `DELETE` | `/api/v1/chat/:conversationId`            | Delete conversation row (+ best-effort Storage remove)             |
| `POST`   | `/api/v1/chat`                            | Send messages; run agent loop; return assistant reply              |

Mounted in `apps/api/src/config/routing.ts` as `/api/chat` and `/api/v1/chat`.

### Key files

| Layer            | Path                                                                                              |
| ---------------- | ------------------------------------------------------------------------------------------------- |
| Page             | `apps/web/app/chat/page.tsx` (RSC bootstrap + Suspense)                                           |
| Client UI        | `apps/web/app/chat/_components/chat-client.tsx`                                                   |
| Attachment UI    | `apps/web/app/chat/_components/chat-attachment-tiles.tsx`                                         |
| Action Cards     | `apps/web/app/chat/_components/chat-executed-action-card.tsx`                                     |
| Client API       | `apps/web/app/chat/_services/chat-attachments.client.ts` (upload-session, finalize, mint, delete) |
| Client Mutation  | `apps/web/app/chat/_services/chat.mutations.client.ts`                                            |
| Server reads     | `apps/web/app/chat/_services/chat.reads.server.ts`                                                |
| Launcher         | `apps/web/app/chat/_components/chat-launcher.tsx`                                                 |
| Drawer           | `apps/web/app/chat/_components/floating-chat-widget.tsx`                                          |
| Routes           | `createChatRouter` in `chat.route.ts` (mounted as `chat.router`)                                  |
| Service          | `ChatService` in `chat.service.ts`                                                                |
| Chat Repo        | `ChatRepository` in `chat.repository.ts` (`db` injected)                                          |
| Attachment Repo  | `ChatAttachmentsRepository` in `chat-attachments.repository.ts` (Prisma + Storage)                |
| Attachment Parse | `fetchAndParseWorkItemAttachment` in `chat-attachment-parser.ts`                                  |
| Deduplication    | `WorkItemDeduplicationAgent` in `work-item-deduplication.agent.ts`                                |
| Prompt + tools   | `apps/api/src/routes/api/chat/chat.route.data.ts`                                                 |
| Schemas          | `apps/api/src/routes/api/chat/chat.schemas.ts` + `packages/types/src/api/v1/chat.ts`              |
| Shared types     | `packages/types/src/chat-attachments.ts`                                                          |
| Composition      | `apps/api/src/config/composition.ts` → `chat`                                                     |
| Supabase client  | `apps/api/src/lib/supabase.ts` (`supabase` + re-exported `createClient`)                          |

### Data access

Layering: **composition root → route factory → service → repository**.

- `config/composition.ts` builds `ChatRepository(supabase)` → `ChatService` →
  `createChatRouter({ chatService })` and injects `workItemService` /
  `sprintsService` for tool mutations.
- `chat.repository.ts` owns all Supabase table + Storage I/O for conversations
  and history files via the injected `SupabaseClient`.
- `ChatService` owns chat-provider calls (via strategies), markdown
  serialize/deserialize, and orchestration; it does not construct its own
  Supabase client.
- Pure markdown helpers remain module-level exports for unit tests.

There are **no** `CHAT_SUPABASE_*` env vars and no second `createClient` for
chat. Import `createClient` / `supabase` only from `lib/supabase.ts` when
needed elsewhere in the API.

---

## Tools (function calling)

Declared in `chat.route.data.ts` and executed server-side:

| Tool                         | Effect                                                                                 |
| ---------------------------- | -------------------------------------------------------------------------------------- |
| `list_projects`              | List projects (id, name, key)                                                          |
| `create_project`             | Create project via projects service                                                    |
| `list_sprints`               | List sprints for a `projectId`                                                         |
| `create_sprint`              | Create sprint via sprints service                                                      |
| `list_users`                 | List users (id, name, email) for assignee matching                                     |
| `create_work_item`           | Create single work item; maps chat types (bug → Issue, task → Task, story → Story)     |
| `parse_work_item_attachment` | Fetch and parse attached document (JSON, CSV, Text) into structured work item nodes    |
| `check_work_item_duplicates` | Compare parsed items against existing project items to identify new vs duplicate items |
| `batch_import_work_items`    | Bulk create validated work items in a project with parent-child hierarchy links        |

**Protocol (system prompt):** resolve project (list / optionally create) →
resolve sprint (optional) → resolve assignee → `create_work_item` or `parse_work_item_attachment` →
`check_work_item_duplicates` → `batch_import_work_items` → summarize.

Agent loop: up to **5** tool rounds per user message, then return text +
`actions` for the UI.

### Context injection & Document Context

Each `POST` builds a **workspace snapshot** into the system instruction:
projects, users, and active sprints. When the user attaches files, Alice injects the file metadata and signed URLs directly into the conversation prompt, guiding Gemini to call `parse_work_item_attachment` when processing documents.

---

## Storage

### Postgres — `chat_conversations`

| Column                      | Notes                              |
| --------------------------- | ---------------------------------- |
| `id`                        | UUID PK                            |
| `user_id`                   | FK → `users` (`ON DELETE CASCADE`) |
| `title`                     | Default `"New Chat"`               |
| `created_at` / `updated_at` | Timestamps                         |

Index on `user_id`. RLS policies exist for owner access; the API uses the
**service-role** client, so ownership checks stay in application code.

### Postgres — `chat_attachments`

| Column            | Type           | Notes                                           |
| ----------------- | -------------- | ----------------------------------------------- |
| `id`              | `uuid`         | Primary key (`gen_random_uuid()`)               |
| `user_id`         | `uuid`         | FK → `users` (`ON DELETE CASCADE`)              |
| `conversation_id` | `uuid?`        | FK → `chat_conversations` (`ON DELETE CASCADE`) |
| `file_name`       | `string`       | Original file name                              |
| `storage_path`    | `string`       | Path in Supabase Storage                        |
| `file_size`       | `int`          | File size in bytes                              |
| `mime_type`       | `string`       | File MIME type                                  |
| `status`          | `RecordStatus` | `'active'` or `'archived'` (soft-delete)        |
| `created_at`      | `timestamptz`  | Created timestamp                               |
| `updated_at`      | `timestamptz`  | Updated timestamp                               |

Indexes on `user_id` and `conversation_id`. Managed exclusively via Prisma (`await prisma.chat_attachments......`).

### Storage Buckets — Supabase Storage

- **Attachments Bucket**: `STORAGE_BUCKET_CHAT_ATTACHMENTS` (default `alice_storage_chat_attachments`).
  - Path format: `chat-attachments/{userId}/{timestamp}-{safeFileName}`
  - Upload mechanism: Browser uploads directly via signed upload URL (`uploadToSignedUrl`), avoiding Next.js/Express payload limits.
- **Message History Bucket**: `STORAGE_BUCKET_CHAT_HISTORY` (default `alice_storage_chat_history`).
  - Path format: `chat-history/{conversationId}.md`
  - Format: Readable Markdown plus embedded JSON round-trip data block.

---

## Auth and access

| Layer     | Behavior                                                                                           |
| --------- | -------------------------------------------------------------------------------------------------- |
| Web       | `/chat` is not a public path; normal session + allowlist apply                                     |
| API       | JWT via `requireApiAuth` only — **no** chat-specific role gate                                     |
| Nav       | Platform item; no `/chat` minimum role in route policy → any authenticated role                    |
| Mutations | Domain services still enforce their own rules (e.g. create project/sprint typically manager/admin) |

Confirm-before-create is **prompt-only**; the UI does not show a separate
approval step before tool mutations run.

---

## Configuration

### Chat models (Phase 1 — live)

Admins configure one or more **`integrations`** rows (category `ai_agent`, `config.kind = chat_model`) from **Settings → Integrations**. Alice Chat lists active rows via `GET /api/integrations/chat-models` and sends `integrationId` on `POST /api/chat`. Resolution order: explicit `integrationId` → workspace default row → **400** `"No chat model configured"`.

The header model control is a **provider → model** nested menu (`DropdownMenuSub`):
models are grouped by `ChatModelOption.provider` (Gemini, SpaceXAI, …); selection
remains the integration row UUID. Left of the title: always-visible **Add model**
(plus → Settings AI agents) and, for admins, a **Mark as default** star that hides
once the selected integration is already `is_default`.

See [SETTINGS_INTEGRATIONS.md](../integrations/SETTINGS_INTEGRATIONS.md).

Per-model API keys and optional `config.api_url` live in encrypted JSONB — not in app env vars.

| Variable                                     | Where                 | Purpose                                                                     |
| -------------------------------------------- | --------------------- | --------------------------------------------------------------------------- |
| `INTEGRATION_TOKEN_ENCRYPTION_KEY`           | `apps/api/.env`       | Encrypt/decrypt integration secrets (shared with GitHub/Jira tokens)        |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Zod `env.ts` + sample | Shared service-role client (`lib/supabase.ts`) used by `chat.repository.ts` |
| `STORAGE_BUCKET_CHAT_HISTORY`                | Zod `env.ts` + sample | Chat history bucket name (same pattern as attachments / profile pictures)   |

Do **not** introduce `CHAT_SUPABASE_URL` / `CHAT_SUPABASE_SERVICE_ROLE_KEY` —
chat must not maintain a second Supabase client or project. Prefer importing
`createClient` from `apps/api/src/lib/supabase` rather than
`@supabase/supabase-js` directly in API modules.

No active chat model rows → `POST /api/chat` returns **400** with a configuration message.

---

## Reliability

| Topic                   | Behavior                                                                                                                                                                                                                                      |
| ----------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming               | None — full JSON response; UI shows a “Thinking…” state                                                                                                                                                                                       |
| Chat provider 429 / 5xx | Up to 3 retries with exponential backoff; errors appended to `alice-chatbot-errors.log` (gitignored)                                                                                                                                          |
| HTTP timeouts           | Express socket inactivity **120s** (`server.setTimeout`); chat `apiFetch` **90s**. A 15s socket timeout was destroying the POST mid-Gemini; Next’s rewrite then returned a non-JSON 500 and the UI showed “Could not connect to the backend.” |
| Dropdown cache          | After `create_project` (and related tools), chat calls `revalidateAfterChatActions` so `/sprints` Create Sprint is not stuck on the 60s `dropdown-projects` cache. See [PERFORMANCE.md](../../guides/PERFORMANCE.md) §2.7.                    |
| Tool errors             | Returned as function-response `{ error }`; loop may continue                                                                                                                                                                                  |
| Rate limiting           | No app-level chat quota beyond Gemini retries                                                                                                                                                                                                 |
| Request validation      | Manual `messages` checks; no Zod body schema on the chat router yet                                                                                                                                                                           |

---

## Testing

### Automated Test Coverage

| Area                                   | Test File                                                   | Status  |
| -------------------------------------- | ----------------------------------------------------------- | ------- |
| Attachment repository & direct upload  | `apps/api/tests/chat/chat-attachments.repository.test.ts`   | Covered |
| Attachment file parsing (JSON/CSV)     | `apps/api/tests/chat/chat-attachment-parser.test.ts`        | Covered |
| Deduplication engine & recommendations | `apps/api/tests/chat/work-item-deduplication.agent.test.ts` | Covered |
| Chat service orchestration & tools     | `apps/api/tests/chat/chat.service.test.ts`                  | Covered |
| Chat API routes & auth                 | `apps/api/tests/chat/chat.route.test.ts`                    | Covered |
| Web client upload & mutations          | `apps/web/tests/chat/chat-attachments.client.test.ts`       | Covered |
| Web attachment tiles rendering         | `apps/web/tests/chat/chat-attachment-tiles.test.tsx`        | Covered |
| Web full chat client UI                | `apps/web/tests/chat/chat-client.test.tsx`                  | Covered |

Run tests via:

```powershell
pnpm --filter api test tests/chat/
pnpm --filter web test tests/chat/
```

### User End-to-End Testing

For full step-by-step instructions for testing from the browser UI (with sample JSON and CSV payloads), see:
👉 **[USER_TEST_GUIDE.md](./USER_TEST_GUIDE.md)**

---

## Known limitations

1. Drawer variant lacks the full-page conversation sidebar / New Chat controls.
2. `GET /api/chat/:conversationId` loads Storage by id — keep ownership checks
   aligned with the conversation row’s `user_id` when changing this path.
3. List tools and snapshot injection use broad workspace data (service-role /
   all-users style reads) — treat as a privacy boundary for shared tenants.
4. Work-item “key” in some tool results may be synthetic for display; prefer
   deep links from action cards.
5. Broader AI roadmap items (smart triage, NL search, Slack/Teams) are **Plan**
   only and are not provided by this chatbot.

---

## Phases (as built)

1. Conversations table + Storage history format
2. Gemini tools for list/create project, sprint, work item, users
3. Full-page `/chat` + navbar launcher drawer on dashboard shell
4. Action cards after successful mutations
5. Document attachment processing (upload-session, Supabase Storage direct upload, JSON/CSV parsing, deduplication engine, batch work item import, and strict project scope guardrails)
