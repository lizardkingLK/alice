# Alice agent personalization

Status: **Implemented** — follow-ups (Mongo, encrypted conversation records,
Shared tab) are **Planned**; see [Planned next](#planned-next).

Personalized **agents** (persona, encrypted instructions, skill/tool
enablement, autonomy) open from the chat header gallery panel. They are
distinct from Settings **AI models** (`IntegrationCategory.ai_agent` = LLM
providers).

Related:

- Feature index: [README.md](./README.md)
- Alice assistant (tools, API, storage): [AI_CHATBOT.md](./AI_CHATBOT.md)
- Model pool / Settings: [SETTINGS_INTEGRATIONS.md](../integrations/SETTINGS_INTEGRATIONS.md)
- Project access for tools: [UNIFIED_PROJECT_REGISTRY_AND_CHAT_VALIDATION.md](../projects/UNIFIED_PROJECT_REGISTRY_AND_CHAT_VALIDATION.md)
- User guide: [alice-agents.md](../../user-guide/chat/alice-agents.md)
- Views share pattern (reuse for agent shares): [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md)

---

## Goals

- Let **admins** customize the workspace **default Alice** agent (instructions,
  skill/tool toggles, persona) used across chat and specialized AI flows.
- Let **members** **fork** each admin original **at most once** and further
  customize that fork.
- Persist agents in Postgres (`chat_agents` + catalogs); keep member preferred
  default agent in a **browser cookie + localStorage** (SSR reads the cookie).
- Keep **/chat** conversation-first; Agents live in a **header gallery dialog**
  (fullscreenable), not a second page tab.
- Scope agent tool use to projects the actor can access
  (`project_members` / `listAccessibleProjectIds`).
- Keep the header **drawer** conversation-only (no Agents gallery).
- Encrypt all natural-language instruction fields **at rest** so DB consoles
  only see ciphertext.

## Non-goals (shipped slice)

- Monday-style Jobs / Channels / Activity run history
- Custom agent builder from blank (admin originals + fork only)
- Drawer Agents UI
- Replacing Settings model integrations with personas
- Deep-linking the Agents panel via query params
- `is_locked` / immutable templates (admins may edit originals)

Agent shares / Shared tab, MongoDB + worker migration, and encrypted
conversation records are **not** non-goals — they are queued under
[Planned next](#planned-next).

---

## Product model

| Layer            | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| **Model**        | Workspace LLM integration (Settings → AI models)                        |
| **Agent**        | Persona + encrypted instructions + skill/tool enablement + autonomy     |
| **Autonomy**     | `suggest` = propose in chat for confirm; `approve` = act after approval |
| **Conversation** | Thread; optionally bound to an `agentId` (URL and/or `agent_id` column) |

### Roles

| Actor      | Can                                                                                                                                                           |
| ---------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**  | Create/edit/archive/delete admin originals (`owner_id` null); toggle skills/tools; set exactly one global `is_default`; must keep ≥1 active agent             |
| **Member** | List admin originals + own forks; fork each original **once**; edit/archive/delete **own** forks only; set personal preferred default (cookie + localStorage) |

### Catalog kinds (this slice)

| Kind               | Who                          | Editable | Notes                                       |
| ------------------ | ---------------------------- | -------- | ------------------------------------------- |
| **Admin original** | `owner_id` null (seed/admin) | Admins   | Seeded **Alice** is the sole seed row       |
| **Personal fork**  | `owner_id` = forking user    | Owner    | At most one fork per `(owner, forked_from)` |

**Seed:** one default agent — **Alice** (`is_default = true`, all catalog tools
and skills enabled). No Project Manager / Alex seed.

**Defaults:**

- Workspace: exactly one active `is_default` agent (admins reassign).
- If only one active agent remains, all Alice chat / specialized AI areas use
  that agent.
- Member preferred default: cookie + localStorage agent id; `/chat` SSR seeds
  `initialAgentId` from the cookie when URL / conversation bind is absent.
  Client sends `agentId` when bound; API falls back to conversation `agent_id`,
  then global `is_default`, when omitted.

**Gallery tabs:** **Mine** | **Archived** today; **Shared** is Planned (tab
may stay empty until shares ship). Search beside the Agents heading.

### Fork = new version

- Fork from an admin original → new personal agent with `forked_from_id` +
  `version = parent.version + 1`, copied instructions and enablement rows.
- Reject a second fork of the same original by the same user.
- Portraits use [DiceBear](https://www.dicebear.com/) (`avatar_style` +
  `avatar_seed`).

### Project scope

- Tools and docs only use accessible projects (`listAccessibleProjectIds`).
- Optional focus project on an agent (if added later) must remain in that set.

---

## Data model

| Table                | Role                                                                                          |
| -------------------- | --------------------------------------------------------------------------------------------- |
| `chat_tools`         | Seeded tool catalog (`key` matches code registry `name`)                                      |
| `chat_skills`        | Seeded skill catalog (admin-toggleable labels)                                                |
| `chat_agents`        | Agent row (`key` for seed originals; persona + **encrypted** `instructions`, `is_default`, …) |
| `chat_agent_tools`   | Per-agent tool enablement (`enabled`)                                                         |
| `chat_agent_skills`  | Per-agent skill enablement (`enabled`)                                                        |
| `chat_conversations` | Optional nullable `agent_id` FK (bind persistence)                                            |

Tool **handlers and JSON schemas** stay in code
(`apps/api/src/routes/api/chat/chat.route.data.ts`). The DB drives enablement
and optional per-tool `instruction` text (e.g. dynamic fields, chart
description).

### Instruction encryption (at rest)

| Field                         | At rest                                  |
| ----------------------------- | ---------------------------------------- |
| `chat_agents.instructions`    | AES-256-GCM via `encryptSecret` (`v1:…`) |
| `chat_tools.instruction`      | Same (all rows, including seed)          |
| Persona / skill labels / keys | Plaintext                                |

- Helpers: `@repo/db` `secret-crypto` / `seed-crypto` (`encryptSecret`)
- Key: existing `INTEGRATION_TOKEN_ENCRYPTION_KEY` (shared with integrations /
  GitHub / Jira) — no new env var in this slice.
- Service layer encrypts on write and decrypts on authorized read / chat
  runtime. Postgres operators see ciphertext only.
- Seeded Alice prompts are public in git historically, but seed still stores
  ciphertext so there is one code path. Custom / forked instructions are the
  privacy-sensitive case.
- Losing the encryption key makes stored instructions unrecoverable.

---

## API

Mounted at `/api/chat-agents` and `/api/v1/chat-agents`
(`apps/api/src/routes/api/chat-agents/`).

| Method   | Path               | Behavior                                                            |
| -------- | ------------------ | ------------------------------------------------------------------- |
| `GET`    | `/`                | Admin originals + caller’s forks; enabled keys (no instructions)    |
| `GET`    | `/tools`           | Active tool catalog (no instruction plaintext)                      |
| `GET`    | `/skills`          | Active skill catalog                                                |
| `GET`    | `/:id`             | Detail with **decrypted** instructions when visible                 |
| `POST`   | `/:id/fork`        | Fork-once from workspace original; copy enablement                  |
| `PATCH`  | `/:id`             | Admin on originals / owner on forks; persona, instructions, toggles |
| `DELETE` | `/:id`             | Reject if last active; promote oldest active when deleting default  |
| `POST`   | `/:id/set-default` | Admin only; workspace originals only                                |

Chat runtime resolves `agentId` when provided and visible; else the
conversation’s stored `agent_id`; else the active `is_default` agent.
Provider tools are filtered to enabled keys that exist in the code registry.
Specialized flows load + decrypt the matching tool `instruction`.

---

## Routing & UX

| Surface      | URL                                             | Behavior                                                   |
| ------------ | ----------------------------------------------- | ---------------------------------------------------------- |
| Conversation | `/chat` + optional `conversationId` / `agentId` | Thread + composer; Agents via header **LayoutGrid** dialog |
| Agents panel | Client-only dialog on `/chat`                   | Gallery ↔ detail (back chevron); optional fullscreen       |
| Drawer       | Header launcher                                 | Conversation only — no Agents panel                        |

Legacy `/chat/agents` and `/chat/agents/:id` **redirect** to `/chat`.

### Navigation flows

```text
Header Agents icon  →  gallery dialog
Card click          →  detail view in same dialog
Chat CTA            →  close dialog → /chat?agentId=<id>
Bound header identity →  reopen dialog on that agent’s detail
```

### Bound chat identity

- When `agentId` is set on `/chat`, the conversation header and assistant
  message rows show that agent’s **name**, **title**, and DiceBear avatar.
- Header identity opens the Agents panel on that agent (not a separate route).
- Unbound chats use the preferred cookie / localStorage id when set; otherwise
  the API global default (Alice brand until a fork is bound). Selecting a
  conversation restores its stored `agent_id` into the URL and header identity.
- Bound identity loads via `GET /chat-agents/:id` (not a full catalog list).

---

## Naming clarity

| Product label              | Meaning                                          |
| -------------------------- | ------------------------------------------------ |
| **Agents** (gallery panel) | Role personalization                             |
| **AI models** / Settings   | LLM providers (`ai_agent` category historically) |

---

## UI map

```text
/chat
┌────────────┬──────────────────────────────────────────┐
│ History    │ Header: identity · Agents · model · new  │
│            │ Thread + composer                        │
└────────────┴──────────────────────────────────────────┘
                      │
                      ▼ Agents dialog
┌─────────────────────────────────────────────────────┐
│ Gallery: Mine | Archived  (or detail form)          │
└─────────────────────────────────────────────────────┘
```

### Code anchors

**Web (API-backed catalog; preferred cookie SSR + conversation `agent_id`):**

- Panel: `apps/web/app/chat/_components/chat-agents-panel-dialog.tsx`
- Gallery: `apps/web/app/chat/_components/chat-agents-gallery.tsx`
- Customize: `apps/web/app/chat/_components/chat-agent-customize-page.tsx`
- Instructions TipTap: `apps/web/app/chat/_components/chat-agent-instructions-editor.tsx`
  (same full editor chrome as work-item description; stores markdown string;
  encrypted at rest like before)
- Catalog helpers: `apps/web/app/chat/_helpers/chat-agents-catalog.ts`
- Preferred storage: `apps/web/app/chat/_helpers/preferred-chat-agent-storage.ts`
- Bound identity: `apps/web/app/chat/_helpers/use-bound-chat-agent.ts`
- Client API: `apps/web/app/chat/_services/chat-agents-*.ts`
- URL helpers: `apps/web/app/chat/_helpers/chat-url.ts`
- Page SSR: `apps/web/app/chat/page.tsx`

**API / DB (this slice):**

- Schema: `packages/db/prisma/schema.prisma` (`chat_tools`, `chat_skills`,
  `chat_agents`, joins; `chat_conversations.agent_id`)
- Seed: `packages/db/src/seed.ts`
- Routes: `apps/api/src/routes/api/chat-agents/`
- Runtime: `apps/api/src/routes/api/chat/chat-agent-runtime.ts`,
  `chat.service.ts`

---

## Planned next

Accepted follow-ups — not deferred. Keep encrypt helpers and the agent shape
portable so these can land without a rewrite. Implementation timing is TBD.

| #   | Workstream                         | Intent                                                                                                                                                   | Ready to start?                                                                                                                                      |
| --- | ---------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **MongoDB + worker**               | Move agentic / instructions data to MongoDB reached from a worker app                                                                                    | Spec only — `apps/worker` is still [Plan](../../architecture/WORKER_AND_STREAMER.md); no Mongo package yet                                           |
| 2   | **Encrypted conversation records** | Move `alice_storage_chat_history` markdown (`chat-history/{id}.md`) out of Supabase Storage into encrypted conversation records (same Mongo store as #1) | Spec only — same dependency on worker + Mongo; current Storage path documented in [AI_CHATBOT.md](./AI_CHATBOT.md#storage-buckets--supabase-storage) |
| 3   | **Agent shares + Shared tab**      | Views-style agent shares and a populated Shared gallery tab                                                                                              | Spec only — reuse [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md) share pattern; UI tab can stay empty until shares ship                   |

**Not available yet as runnable infra** — these are accepted product follow-ups you can schedule later. Do not expect an existing Mongo collection or worker job for chat history today.

Until then: instructions stay encrypted in Postgres; conversation history stays
in the chat-history Storage bucket; gallery Shared remains empty / unavailable in the UI.
