# Alice Assistant

Status: **Implemented**

Conversational assistant for creating and inspecting projects, sprints, and
work items. UI labels: **Alice** / sidebar **Alice**. System prompt
name: **Alice Assistant**. Alice supports configured Google Gemini, xAI,
OpenAI, and Anthropic models through a shared provider interface with tool
calling.

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
- Attach and process documents (**JSON**, **CSV**, **TSV**, **Markdown tables**, **Indented text outlines**, **YAML**, and **Images**) directly in the chat composer.
- Use a **direct-to-storage upload session** flow to avoid Vercel/serverless request payload size limits.
- Automatically refresh signed URLs on expiration across both backend hydration and frontend interactive links (`chat-attachment-link.tsx`).
- Automatically parse attached documents into hierarchical and flat work item trees with custom dynamic fields (`parse_work_item_attachment`).
- Run **duplicate checking and similarity analysis** against existing project items (`check_work_item_duplicates`).
- Execute **atomic batch work item imports** with pre-validation, automatic DB rollback on failure, and interactive user choice protocol (`batch_import_work_items`).
- Support **incremental backlog synchronization** on file re-upload: update existing items and parent links in place without creating duplicates (`updateExisting`). Detect and explicitly report hierarchy changes in chat responses across all formats (JSON, CSV, TSV, Markdown, outlines, YAML). Enforce strict **no-deletion policy via chat**: omitted items are preserved in the project backlog with an informative user notice.
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

| Surface         | Location                                  | Behavior                                                                                                                                                                           |
| --------------- | ----------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Full page       | `/chat`                                   | Edge-to-edge in the dashboard shell; history sidebar; Agents gallery via header icon dialog; New Chat / model icons; breadcrumb shows active chat title; suggestions, action cards |
| Agents          | Header **Agents** dialog on `/chat`       | Gallery (Mine / Shared / Archived) and customize detail in-panel — see [AGENT_PERSONALIZATION.md](./AGENT_PERSONALIZATION.md)                                                      |
| Navbar launcher | All `DashboardShell` pages except `/chat` | Header control between notifications and profile → right drawer; same `ChatClient` (`variant="drawer"`); conversation-only (no Agents panel)                                       |
| Nav             | Platform → **Alice** (`Sparkles` icon)    | Links to `/chat`                                                                                                                                                                   |

Empty-state suggestions cover common flows (e.g. create a bug, list projects).
Successful mutations can render **executed action** cards with deep links to
the created entity. The header model menu groups active configured models by
provider.

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

| Surface        | Initial conversations                          | Initial message history                        | Interactions after mount                      |
| -------------- | ---------------------------------------------- | ---------------------------------------------- | --------------------------------------------- |
| `/chat` page   | RSC direct Supabase (`chat.service.server.ts`) | RSC `apiFetch` → API (Storage is service-role) | Client `apiFetch` for send / switch / delete  |
| App-shell dock | None (opens instantly; empty session)          | None on open                                   | Client `apiFetch` on send; models on dropdown |

`/chat` uses `Suspense` + `safeServerFetch(getChatPageBootstrap())` so the
shell streams first; the client receives bootstrap props and **does not**
`useEffect`-fetch the same data again. The page keys `ChatClient` by
`conversationId` so Favorites / query changes remount the correct thread. When
`?conversationId=` is set but the conversation is missing (deleted or not
owned), bootstrap returns `not_found` and the route calls `notFound()`. After a
new chat is created, the conversation list cache can lag; bootstrap then tries
a live list and an owned **by-id** lookup before 404ing so the new thread stays
reachable. The header favorite star stays disabled until the URL
`conversationId` matches the active thread (avoids starring the wrong chat
while create/select is still hydrating).

### Dock vs `/chat` conversation kinds

`chat_conversations.kind` (`ChatConversationKinds` in `@repo/types`):

| Kind        | Created from                     | Listed on `/chat` history | Persistence                                   |
| ----------- | -------------------------------- | ------------------------- | --------------------------------------------- |
| `general`   | Full `/chat` page                | Yes                       | Normal history + Storage markdown             |
| `temporary` | App-shell dock / Overview widget | No                        | Saved for multi-turn within the shell session |

Apply migration `add_chat_conversation_kind` before deploying API/web that
filter on `kind`.

The dock opens with **no** conversation list, latest-thread hydrate, or model
preload. Sends omit `integrationId` until the model menu is opened (API uses the
workspace default). Closing the dock keeps the panel mounted (hidden) so the
temporary thread continues for the page session. A **Context** bar sits above
the composer (Jira Rovo-style): page Alice was opened on (nav icon + label),
plus workflow designer via the existing `viewContext` bridge when registered.

---

## Architecture

```text
ChatClient / FloatingChatWidget
  → apiFetch (Bearer JWT) → Express /api/v1/chat
    → requireApiAuth
    → resolve selected integration row (or workspace default)
    → load/create chat_conversations row
    → inject workspace snapshot into system instruction
    → resolve provider strategy
    → provider API (+ tools), up to 5 provider/tool rounds
    → domain services (projects / sprints / work items / users)
    → upsert history markdown in Supabase Storage
    → JSON { reply, history, actions, conversationId, title }
```

Provider strategies use direct `fetch` calls; Alice does not depend on a
vendor SDK. `ChatService` keeps the provider-neutral conversation and tool
shapes, while each strategy converts them to and from the vendor wire format.

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
| `PATCH`  | `/api/v1/chat/:conversationId`            | Rename conversation (`{ title }`)                                  |
| `DELETE` | `/api/v1/chat/:conversationId`            | Delete conversation row (+ best-effort Storage remove)             |
| `POST`   | `/api/v1/chat`                            | Send messages; run agent loop; return assistant reply              |

Mounted in `apps/api/src/config/routing.ts` as `/api/chat` and `/api/v1/chat`.

### Key files

| Layer             | Path                                                                                              |
| ----------------- | ------------------------------------------------------------------------------------------------- |
| Page              | `apps/web/app/chat/page.tsx` (RSC bootstrap + Suspense)                                           |
| Client UI         | `apps/web/app/chat/_components/chat-client.tsx`                                                   |
| Attachment UI     | `apps/web/app/chat/_components/chat-attachment-tiles.tsx`                                         |
| Attachment Link   | `apps/web/app/chat/_components/chat-attachment-link.tsx` (auto-refreshing signed URL link)        |
| Action Cards      | `apps/web/app/chat/_components/chat-executed-action-card.tsx` (create, update, delete item cards) |
| Cache Revalidate  | `apps/web/lib/cache/revalidate-after-chat.ts` (instant cache eviction on mutations)               |
| Client API        | `apps/web/app/chat/_services/chat-attachments.client.ts` (upload-session, finalize, mint, delete) |
| Client Mutation   | `apps/web/app/chat/_services/chat.mutations.client.ts`                                            |
| Server reads      | `apps/web/app/chat/_services/chat.reads.server.ts`                                                |
| Launcher          | `apps/web/app/chat/_components/chat-launcher.tsx`                                                 |
| App-shell dock    | `apps/web/app/chat/_components/docked-chat-panel.tsx` (via `chat-launcher.tsx`)                   |
| Routes            | `createChatRouter` in `chat.route.ts` (mounted as `chat.router`)                                  |
| Service           | `ChatService` in `chat.service.ts`                                                                |
| Chat Repo         | `ChatRepository` in `chat.repository.ts` (`db` injected)                                          |
| Attachment Repo   | `ChatAttachmentsRepository` in `chat-attachments.repository.ts` (Prisma + Storage)                |
| Attachment Parse  | `fetchAndParseWorkItemAttachment` in `chat-attachment-parser.ts`                                  |
| Deduplication     | `WorkItemDeduplicationAgent` in `work-item-deduplication.agent.ts`                                |
| Prompt + tools    | `apps/api/src/routes/api/chat/chat.route.data.ts`                                                 |
| Provider registry | `apps/api/src/routes/api/integrations/chat-providers/resolve-chat-provider.ts`                    |
| Provider adapters | `apps/api/src/routes/api/integrations/chat-providers/`                                            |
| Schemas           | `apps/api/src/routes/api/chat/chat.schemas.ts` + `packages/types/src/api/v1/chat.ts`              |
| Shared types      | `packages/types/src/chat-attachments.ts`                                                          |
| Composition       | `apps/api/src/config/composition.ts` → `chat`                                                     |
| Supabase client   | `apps/api/src/lib/supabase.ts` (`supabase` + re-exported `createClient`)                          |

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

### Provider resolution and conversation flow

1. An authenticated user selects an active configured model in Alice Chat.
2. The frontend sends that integration row's UUID as `integrationId`.
3. The backend loads the active integration, validates its provider identity
   and endpoint, and decrypts its API key in-process.
4. `ChatService` resolves the provider strategy and sends the system
   instruction, conversation history, and Alice tool declarations.
5. The provider returns text, tool requests, or both.
6. Alice validates provider tool-call structures and executes only known
   server-side tools with the authenticated user's identity.
7. Tool results are matched to their original call IDs and returned to the
   provider for the next round.
8. Alice returns the final assistant text and any executed action cards.

| Provider       | API format                                                  | Authentication        |
| -------------- | ----------------------------------------------------------- | --------------------- |
| Google Gemini  | Native `generateContent`                                    | `key` query parameter |
| xAI / SpaceXAI | OpenAI-compatible `/v1/chat/completions`                    | Bearer token          |
| OpenAI         | Chat Completions `/v1/chat/completions`                     | Bearer token          |
| Anthropic      | Messages `/v1/messages`, including `tool_use`/`tool_result` | `x-api-key` header    |

Conversation history stays in Alice's `ChatContentTurn` shape inside
`ChatService`. OpenAI and xAI convert it to system/user/assistant/tool
messages. Anthropic keeps the system instruction separate and converts
conversation turns to alternating user/assistant content blocks. Gemini uses
Alice's structurally compatible contents directly.

OpenAI/xAI and Anthropic validate returned tool names, IDs, duplicate IDs,
JSON argument shapes, and declared parameter types before execution. Gemini
tool arguments are checked by the individual handlers and domain services.
Provider tool requests never receive direct database access or database
credentials.

---

## Tools (function calling)

The 13 tools are declared in `chat.route.data.ts` and executed server-side:

| Tool                             | Effect                                                                                                      |
| -------------------------------- | ----------------------------------------------------------------------------------------------------------- |
| `list_projects`                  | List projects (id, name, key)                                                                               |
| `create_project`                 | Create project via projects service                                                                         |
| `list_sprints`                   | List sprints for a `projectId`                                                                              |
| `create_sprint`                  | Create sprint via sprints service                                                                           |
| `list_users`                     | List users (id, name, email) for assignee matching                                                          |
| `get_workflow_config`            | Read the current workflow envelope, preferring a live designer draft when available                         |
| `propose_workflow_patch`         | Create a reviewable workflow proposal; does not save until the user applies it                              |
| `dismiss_workflow_proposal`      | Dismiss an unapplied workflow proposal without changing the canvas                                          |
| `create_work_item`               | Create single work item; maps chat types (bug → Issue, task → Task, story → Story)                          |
| `parse_work_item_attachment`     | Fetch and parse attached document (JSON, CSV, TSV, Markdown, Outline, YAML) into structured work item trees |
| `check_work_item_duplicates`     | Compare parsed items against existing project items to identify new vs duplicate items                      |
| `batch_import_work_items`        | Bulk create or synchronize work items with hierarchy links, atomic rollback, and update/deletion controls   |
| `generate_project_fields_schema` | Generate a validated project dynamic-fields JSON schema                                                     |

A provider may request multiple tools in one response. `ChatService` executes
those calls concurrently, preserves each call ID, and returns each result with
the correct tool name and ID. The updated history is sent back to the provider
for another round. The loop allows at most five provider/tool rounds.

### Tool Arguments & Options for `batch_import_work_items`

| Argument               | Type      | Default | Purpose                                                                                                  |
| ---------------------- | --------- | ------- | -------------------------------------------------------------------------------------------------------- |
| `projectId`            | `string`  | Req.    | ID of the project into which items are imported/synced.                                                  |
| `items`                | `array`   | Req.    | List of parsed work item nodes (supports flat lists with `parentReference` or nested `children` trees).  |
| `sprintId`             | `string`  | `null`  | Optional sprint to assign the imported work items to.                                                    |
| `skipInvalidHierarchy` | `boolean` | `false` | When `true`, prunes items with invalid parent-child hierarchy; when `false`, halts import with 0 writes. |
| `updateExisting`       | `boolean` | `false` | When `true`, updates matching existing work items (hierarchy and fields) in-place without duplicating.   |
| `removeDeleted`        | `boolean` | `false` | When `true`, soft-deletes/archives items present in the project that were omitted from the update file.  |

---

### Universal Multi-Format Attachment Parser

The parser (`chat-attachment-parser.ts`) supports heterogeneous document formats, converting all structures into a uniform `ParsedWorkItemNode[]` tree:

1. **JSON (`.json`)**:
   - Supports wrapped `{ items: [...] }` or raw root arrays `[...]`.
   - Supports nested hierarchical trees (`children` or `subtasks`) or flat lists with `parentReference` / `parent`.
   - Extracts custom dynamic fields into `dynamicFields`.
2. **CSV & TSV (`.csv`, `.tsv`)**:
   - Delimited text parser handling commas or tabs with robust quoted string support.
   - Header aliases: matches variations such as `Issue key` / `Key` / `ID`, `Parent` / `Parent Key`, `Type` / `Issue Type`, `Story Points` / `Points` / `Estimate`, `Title` / `Summary` / `Name`.
   - Dynamic columns automatically captured as key-value pairs in `dynamicFields`.
3. **Markdown Tables (`.md`)**:
   - Pipe-delimited GitHub-flavored markdown tables (`| Key | Title | Type | Parent | ... |`).
   - Parses header row, delimiter divider line, and body rows.
4. **Indented Text Outlines (`.txt`, `.md`)**:
   - Hierarchical bulleted (`-`, `*`, `+`) or numbered lists.
   - Derives parent-child hierarchy automatically from indentation depth (spaces or tabs).
   - Extracts inline explicit types (e.g. `[Epic]`, `[Feature]`, `[Story]`) and inline metadata annotations (e.g. `(Key: PROJ-12, Priority: High, Points: 5)`).
   - Formats `Title: Description` automatically when colons are present.
5. **YAML (`.yaml`, `.yml`)**:
   - Supports YAML lists and objects mapping directly into work item nodes.

---

### Hierarchy Validation Engine & Guardrails

The hierarchy validator (`filterAndValidateWorkItemHierarchy` in `chat.service.ts`) enforces strict structural integrity:

- **Hierarchy Levels**: `Epic` &rarr; `Feature` &rarr; `Story` &rarr; `Task` &rarr; `Issue`.
- **Leaf Constraints**: An `Issue` (or `Bug`) is strictly a **leaf item** and **cannot** have children or subtasks.
- **Parent-Child Ordering**: Parents must be higher in the hierarchy than their child items.
- **Circular Reference Prevention**: Detects self-referential or circular parent chains (`detectCircularReference`) and rejects the hierarchy.

---

### Atomic Import Guarantee & Rollback Protocol

To prevent corrupted partial database states:

1. **Pre-Validation First**: Before running any database inserts, `filterAndValidateWorkItemHierarchy` inspects the entire batch. If any item has an invalid hierarchy and `skipInvalidHierarchy` is `false`, an exception is thrown immediately:
   - **Zero work items** are inserted into the database.
   - **Zero executed action cards** are emitted to the UI.
2. **Transactional Compensation & Rollback**: If an unhandled database error occurs during batch creation:
   - All newly created items in that batch are deleted (`prisma.work_items.deleteMany`).
   - Any modified items have their original database states restored.
   - `toolActionsPerformed` is reset to its initial state.

---

### Interactive User Choice Protocol

When an attached file contains hierarchy errors:

1. Alice explains the specific error (e.g. _"Issue 'Login Bug' cannot have children because Issue/Bug is a leaf item"_).
2. Alice explicitly confirms that **zero work items were created**.
3. Alice presents two clear choices:
   - **Option 1**: Re-parse the file after the user corrects and re-uploads it.
   - **Option 2**: Proceed with importing only the valid items (skipping the invalid hierarchy).
4. Alice **strictly pauses and waits** for the user's reply before executing any action.

---

### Incremental Backlog Synchronization Protocol

When a user re-uploads an updated document (JSON, CSV, TSV, Markdown, or Outline) to modify work items:

1. **Identity Resolution**: Alice matches each file item against existing project items by `jira_issue_key`, database `id`, or normalized `title`.
2. **In-Place Field Updates**: For existing matches, Alice updates fields (`title`, `description`, `priority`, `story_points`, `type`, etc.) and sets the new `parent_id` (applying hierarchy reorganizations) via `prisma.work_items.update`.
3. **New Item Additions**: Items not present in the project are created and linked to their resolved parents.
4. **Omission Handling (`removeDeleted`)**: If requested by the user, items omitted from the file can be archived/deleted.
5. **Interactive UI Feedback**: Each modified item generates an `update_work_item` executed action card with a clickable direct link, and each removed item generates a `delete_work_item` action card.
6. **Instant Cache Eviction**: `revalidateAfterChatActions` evicts client and server cache tags for work items, sprint boards, and project registries.

---

### Attachment Signed URL Auto-Refresh Lifecycle

Supabase Storage signed URLs expire after 1 hour (3600 seconds). The chat system guarantees uninterrupted access:

- **Database Timestamp**: `chat_attachments` records `expires_at` (a `timestamptz` column).
- **Backend Hydration Auto-Refresh**: When loading a conversation's history (`loadChatHistory` in `chat.service.ts`), attachments whose `expiresAt` is within 60 seconds of expiration (or already expired) have their signed URLs automatically regenerated via `chatAttachmentsRepository.getAttachmentById(att.id)`. The updated URLs and expiration timestamps are persisted in both the database and the stored markdown history.
- **Frontend On-Demand Auto-Refresh**: The `ChatAttachmentLink` component (`chat-attachment-link.tsx`) tracks URL expiration in the browser. If an attachment is expired, or if clicking the link returns a 403/400 response from storage, it calls `GET /api/v1/chat/attachments/:id` to obtain fresh signed preview and download URLs on the fly before navigating.

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
| `expires_at`      | `timestamptz?` | Signed URL expiration timestamp                 |

Indexes on `user_id` and `conversation_id`. Managed exclusively via Prisma (`await prisma.chat_attachments......`). Auto-refreshes signed URLs when expired.

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

`ChatService` passes the authenticated user ID into every tool execution.
Project-sensitive reads check the user's accessible project IDs, mutation
tools call the existing authorization-aware domain services, and workflow
changes retain their manager/admin gates. Attachment tools resolve only active
attachments owned by the current user. An AI provider can request a declared
tool, but it cannot bypass these server-side checks or query the database
directly.

Confirm-before-create is **prompt-only**; the UI does not show a separate
approval step before tool mutations run.

---

## Configuration

### Chat models (Phase 1 — live)

Managers and admins configure one or more **`integrations`** rows (category
`ai_agent`, `config.kind = chat_model`) from **Settings → Integrations**. Alice
Chat lists active rows via `GET /api/v1/integrations/chat-models` and sends
`integrationId` on `POST /api/v1/chat`. When `integrationId` is omitted, the
backend uses the active workspace default. An explicitly selected missing or
inactive integration returns **400** and is not replaced by the default. If no
active default exists, the backend returns **400** `"No chat model configured"`.

The header uses compact **icon buttons**: a **Cpu** control opens the
**provider → model** nested menu (`DropdownMenuSub`); selection remains the
integration row UUID. A **Plus** control starts a new chat for members and
managers; for **admins** it opens a menu with **New chat** and **Configure AI
models** (Settings). Admins can also **Mark as workspace default** from the
model menu when the selected integration is not already `is_default`.
Managers can perform the same model configuration and default selection from
Settings, but the current Chat-header management shortcuts are admin-only.

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

## Reliability

| Topic                     | Behavior                                                                                                                                                                                                                                      |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Streaming                 | None — full JSON response; UI shows a "Thinking..." state                                                                                                                                                                                     |
| Transient provider errors | At most 3 attempts with exponential backoff for network failures, `429`, `529`, `503`, and `500`–`504`; safe metadata is appended to `alice-chatbot-errors.log` (gitignored)                                                                  |
| Invalid / expired API key | Provider returns a **400** `ChatProviderError` with Settings → Integrations guidance for recognized credential failures, avoiding the generic "Could not connect to the backend" path when JSON error mapping succeeds.                       |
| HTTP timeouts             | Express socket inactivity **120s** (`server.setTimeout`); chat `apiFetch` **90s**. A 15s socket timeout was destroying the POST mid-Gemini; Next's rewrite then returned a non-JSON 500 and the UI showed "Could not connect to the backend." |
| Dropdown cache            | After `create_project` (and related tools), chat calls `revalidateAfterChatActions` so `/sprints` Create Sprint is not stuck on the 60s `dropdown-projects` cache. See [PERFORMANCE.md](../../guides/PERFORMANCE.md) §2.7.                    |
| Tool errors               | Returned as function-response `{ error }`; loop may continue                                                                                                                                                                                  |
| Provider errors           | Known credential/model/request failures use provider-specific safe messages; provider response bodies are omitted from logs                                                                                                                   |
| Rate limiting             | No app-level chat quota beyond the shared provider retry behavior                                                                                                                                                                             |
| Request validation        | `POST /api/v1/chat` uses the shared Zod request schema before model resolution or chat processing                                                                                                                                             |

---

## Testing

### Automated Test Coverage

| Area                                   | Test File                                                                                       | Status                   |
| -------------------------------------- | ----------------------------------------------------------------------------------------------- | ------------------------ |
| Attachment repository & direct upload  | `apps/api/tests/chat/chat-attachments.repository.test.ts`                                       | Covered                  |
| Attachment file parsing (JSON/CSV)     | `apps/api/tests/chat/chat-attachment-parser.test.ts`                                            | Covered                  |
| Deduplication engine & recommendations | `apps/api/tests/chat/work-item-deduplication.agent.test.ts`                                     | Covered                  |
| Chat service orchestration & tools     | `apps/api/tests/chat/chat.service.test.ts`                                                      | Covered                  |
| Chat API routes & auth                 | `apps/api/tests/chat/chat.route.test.ts`                                                        | Covered                  |
| Provider registry and approved URLs    | `apps/api/tests/integrations/resolve-chat-provider.test.ts`, `chat-provider-endpoints.test.ts`  | Covered                  |
| OpenAI provider and wire conversion    | `apps/api/tests/integrations/openai-chat.provider.test.ts`, `spacexai-openai-adapter.test.ts`   | Covered with mocked HTTP |
| Anthropic provider and wire conversion | `apps/api/tests/integrations/anthropic-chat.provider.test.ts`, `anthropic-chat-adapter.test.ts` | Covered with mocked HTTP |
| Gemini and xAI provider regressions    | `apps/api/tests/integrations/gemini-chat.provider.test.ts`, `spacexai-chat.provider.test.ts`    | Covered with mocked HTTP |
| Integration model resolution/security  | `apps/api/tests/integrations/integrations.service.test.ts`, `integrations.route.test.ts`        | Covered                  |
| Web client upload & mutations          | `apps/web/tests/chat/chat-attachments.client.test.ts`                                           | Covered                  |
| Web attachment tiles rendering         | `apps/web/tests/chat/chat-attachment-tiles.test.tsx`                                            | Covered                  |
| Web attachment link auto-refresh       | `apps/web/tests/chat/chat-attachment-link.test.tsx`                                             | Covered                  |
| Web full chat client UI                | `apps/web/tests/chat/chat-client.test.tsx`                                                      | Covered                  |

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

1. OpenAI uses Chat Completions, not the Responses API.
2. Anthropic uses the Messages API with a fixed `max_tokens` value of `4096`;
   extended thinking is not configured.
3. Streaming is not supported. Provider responses are returned as complete
   JSON payloads.
4. The provider/tool loop is limited to five rounds. Reaching the limit
   currently returns an empty assistant response.
5. OpenAI and Anthropic have mocked automated coverage, but successful live
   provider operation has not been confirmed.
6. Model suggestions are static; Alice does not discover models from provider
   APIs or validate credentials when a model is saved.
7. Custom LLM proxies and Azure OpenAI endpoints are not supported; provider
   calls are restricted to approved official hosts and paths.
8. Drawer variant lacks the full-page conversation sidebar / New Chat controls.
9. `GET /api/chat/:conversationId` loads Storage by id — keep ownership checks
   aligned with the conversation row’s `user_id` when changing this path.
10. List tools and snapshot injection use broad workspace data (service-role /
    all-users style reads) — treat as a privacy boundary for shared tenants.
11. Work-item “key” in some tool results may be synthetic for display; prefer
    deep links from action cards.
12. Broader AI roadmap items (smart triage, NL search, Slack/Teams) are **Plan**
    only and are not provided by this chatbot.

---

## Phases (as built)

1. Conversations table + Storage history format
2. Provider tool calling for projects, sprints, work items, users, workflows,
   attachments, imports, and project field schemas
3. Full-page `/chat` + navbar launcher drawer on dashboard shell
4. Action cards after successful mutations
5. Document attachment processing (upload-session, Supabase Storage direct upload, JSON/CSV parsing, deduplication engine, batch work item import, and strict project scope guardrails)
6. Universal multi-format parser (TSV, Markdown tables, Indented text outlines, YAML), signed URL auto-refresh & expiration handling, atomic hierarchy pre-validation & user choice protocol, incremental backlog synchronization (`updateExisting`), and action card expansion (`update_work_item`).
7. Comprehensive hierarchy & field change detection across all attachment formats with mandatory conversational reporting, strict work-item deletion disallowance via chat (omitted items retained in backlog with user notice), and resilient chat provider network error handling with retry and exponential backoff.
