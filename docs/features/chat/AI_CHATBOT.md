# AI Chatbot (Jira Teams Assistant)

Status: **Implemented**

Conversational assistant for creating and inspecting projects, sprints, and
work items. UI labels: **AI Assistant** / sidebar **Chatbot**. System prompt
name: **Jira Teams Assistant**. Provider: **Google Gemini** (REST
`generateContent` + function calling).

Related:

- Feature index: [README.md](./README.md)
- Auth: [AUTHENTICATION.md](../../auth/AUTHENTICATION.md),
  [RBAC](../../auth/RBAC_AUTHORIZATION_SKELETON.md)
- Domain APIs: `apps/api/src/routes/api/{projects,sprints,workItems}/`
- Product roadmap (broader AI ideas): [ROADMAP.md](../../product/ROADMAP.md)

---

## Goals

- Let signed-in users ask in natural language to list/create **projects**,
  **sprints**, and **work items**.
- Persist multi-turn conversations per user (sidebar history on `/chat`).
- Surface a floating assistant on dashboard pages without leaving the current
  route.
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

| Surface | Location | Behavior |
| ------- | -------- | -------- |
| Full page | `/chat` | Conversation list, New Chat, delete, suggestions, action cards |
| Floating widget | All `DashboardShell` pages except `/chat` | FAB → right drawer; same `ChatClient` (`variant="drawer"`) — no conversation sidebar |
| Nav | Platform → **Chatbot** | Links to `/chat` |

Empty-state suggestions cover common flows (e.g. create a bug, list projects).
Successful mutations can render **executed action** cards with deep links to
the created entity. Footer copy: “Powered by Google Gemini”.

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

| Method | Path | Purpose |
| ------ | ---- | ------- |
| `GET` | `/api/chat` | Latest conversation history (or empty) |
| `GET` | `/api/chat/conversations` | List conversations for the current user |
| `GET` | `/api/chat/:conversationId` | Load one conversation’s history from Storage |
| `DELETE` | `/api/chat/:conversationId` | Delete conversation row (+ best-effort Storage remove) |
| `POST` | `/api/chat` | Send messages; run agent loop; return assistant reply |

Mounted in `apps/api/src/config/routing.ts` as `/api/chat`.

### Key files

| Layer | Path |
| ----- | ---- |
| Page | `apps/web/app/chat/page.tsx` |
| Client UI | `apps/web/app/chat/_components/chat-client.tsx` |
| Client API | `apps/web/app/chat/_components/chat-client.service.ts` |
| Widget | `apps/web/app/chat/_components/floating-chat-widget.tsx` |
| Routes | `createChatRouter` in `chat.route.ts` (mounted as `chat.router`) |
| Service | `ChatService` in `chat.service.ts` |
| Repository | `ChatRepository` in `chat.repository.ts` (`db` injected) |
| Prompt + tools | `apps/api/src/routes/api/chat/chat.route.data.ts` |
| Types (API) | `apps/api/src/routes/api/chat/chat.route.types.ts` |
| Shared roles | `packages/types/src/chat.ts` (`ChatRoles`, `GeminiRoles`, `getRoleName`) |
| Composition | `apps/api/src/config/composition.ts` → `chat` |
| Supabase client | `apps/api/src/lib/supabase.ts` (`supabase` + re-exported `createClient`) |

### Data access

Layering: **composition root → route factory → service → repository**.

- `config/composition.ts` builds `ChatRepository(supabase)` → `ChatService` →
  `createChatRouter({ chatService })` and injects `workItemService` /
  `sprintsService` for tool mutations.
- `chat.repository.ts` owns all Supabase table + Storage I/O for conversations
  and history files via the injected `SupabaseClient`.
- `ChatService` owns Gemini calls, markdown serialize/deserialize, and
  orchestration; it does not construct its own Supabase client.
- Pure markdown helpers remain module-level exports for unit tests.

There are **no** `CHAT_SUPABASE_*` env vars and no second `createClient` for
chat. Import `createClient` / `supabase` only from `lib/supabase.ts` when
needed elsewhere in the API.

---

## Tools (function calling)

Declared in `chat.route.data.ts` and executed server-side:

| Tool | Effect |
| ---- | ------ |
| `list_projects` | List projects (id, name, key) |
| `create_project` | Create project via projects service |
| `list_sprints` | List sprints for a `projectId` |
| `create_sprint` | Create sprint via sprints service |
| `list_users` | List users (id, name, email) for assignee matching |
| `create_work_item` | Create work item; maps chat types (bug → Issue, task → Task, story → Story) |

**Protocol (system prompt):** resolve project (list / optionally create) →
resolve sprint (optional) → resolve assignee → `create_work_item` → summarize.

Agent loop: up to **5** tool rounds per user message, then return text +
`actions` for the UI.

### Context injection (not RAG)

Each `POST` builds a **workspace snapshot** into the system instruction:
projects, users, and active sprints. There is no embedding index or retrieval
pipeline.

---

## Storage

### Postgres — `chat_conversations`

| Column | Notes |
| ------ | ----- |
| `id` | UUID PK |
| `user_id` | FK → `users` (`ON DELETE CASCADE`) |
| `title` | Default `"New Chat"` |
| `created_at` / `updated_at` | Timestamps |

Index on `user_id`. RLS policies exist for owner access; the API uses the
**service-role** client, so ownership checks must stay in application code.

Migrations: `add_chat_conversations`, `add_chat_conversations_rls`,
`add_chat_conversations_updated_at_default`.

### Message history — Supabase Storage

- Bucket: `STORAGE_BUCKET_CHAT_HISTORY` (default `alice_storage_chat_history`)
- Object path: `chat-history/{conversationId}.md`
- Format: readable Markdown plus an embedded JSON block between
  `JSON_HISTORY_DATA_START` / `JSON_HISTORY_DATA_END` markers for round-trip
  load

History Storage and `chat_conversations` table access both go through
`chat.repository.ts`, which uses the shared API service-role client in
`apps/api/src/lib/supabase.ts` (same helper other repositories use:
`SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`). There is **no** separate chat
Supabase project or `CHAT_SUPABASE_*` credentials.

There is **no** `chat_messages` table — threads are DB rows; turns are Storage
files.

---

## Auth and access

| Layer | Behavior |
| ----- | -------- |
| Web | `/chat` is not a public path; normal session + allowlist apply |
| API | JWT via `requireApiAuth` only — **no** chat-specific role gate |
| Nav | Platform item; no `/chat` minimum role in route policy → any authenticated role |
| Mutations | Domain services still enforce their own rules (e.g. create project/sprint typically manager/admin) |

Confirm-before-create is **prompt-only**; the UI does not show a separate
approval step before tool mutations run.

---

## Configuration

| Variable | Where | Purpose |
| -------- | ----- | ------- |
| `GEMINI_API_KEY` | `apps/api/.env` (see `sample.env`) | Required for chat |
| `GEMINI_API_URL` | Optional override | Default points at Gemini `generateContent` for the configured model id |
| `SUPABASE_URL` / `SUPABASE_SERVICE_ROLE_KEY` | Zod `env.ts` + sample | Shared service-role client (`lib/supabase.ts`) used by `chat.repository.ts` |
| `STORAGE_BUCKET_CHAT_HISTORY` | Zod `env.ts` + sample | Chat history bucket name (same pattern as attachments / profile pictures) |

`GEMINI_*` are runtime `process.env` reads (also listed in root `turbo.json`
`globalEnv`); they are not part of the Zod `env.ts` schema today.

Do **not** introduce `CHAT_SUPABASE_URL` / `CHAT_SUPABASE_SERVICE_ROLE_KEY` —
chat must not maintain a second Supabase client or project. Prefer importing
`createClient` from `apps/api/src/lib/supabase` rather than
`@supabase/supabase-js` directly in API modules.

Missing `GEMINI_API_KEY` → `POST /api/chat` returns **400** with a config
message.

---

## Reliability

| Topic | Behavior |
| ----- | -------- |
| Streaming | None — full JSON response; UI shows a “Thinking…” state |
| Gemini 429 / 5xx | Up to 3 retries with exponential backoff; errors appended to `gemini-errors.log` (gitignored) |
| Tool errors | Returned as function-response `{ error }`; loop may continue |
| Rate limiting | No app-level chat quota beyond Gemini retries |
| Request validation | Manual `messages` checks; no Zod body schema on the chat router yet |

---

## Testing

| Area | Status |
| ---- | ------ |
| Markdown history serialize/deserialize | `apps/api/tests/chat/chat.service.test.ts` |
| Route / tools / Gemini mocks | Not covered |
| Web `ChatClient` / widget | Not covered |
| Cypress E2E | Not covered |

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
3. Full-page `/chat` + floating drawer on dashboard shell
4. Action cards after successful mutations
