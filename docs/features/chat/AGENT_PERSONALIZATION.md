# Alice agent personalization

Status: **In progress** (web catalog on API; preferred default in localStorage)

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
- Views share pattern (deferred for agents): [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md)

---

## Goals

- Let **admins** customize the workspace **default Alice** agent (instructions,
  skill/tool toggles, persona) used across chat and specialized AI flows.
- Let **members** **fork** each admin original **at most once** and further
  customize that fork.
- Persist agents in Postgres (`chat_agents` + catalogs); keep member “preferred
  default agent” in **localStorage** only.
- Keep **/chat** conversation-first; Agents live in a **header gallery dialog**
  (fullscreenable), not a second page tab.
- Scope agent tool use to projects the actor can access
  (`project_members` / `listAccessibleProjectIds`).
- Keep the header **drawer** conversation-only (no Agents gallery).
- Encrypt all natural-language instruction fields **at rest** so DB consoles
  only see ciphertext.

## Non-goals (this slice)

- Monday-style Jobs / Channels / Activity run history
- Custom agent builder from blank (admin originals + fork only)
- Drawer Agents UI
- Replacing Settings model integrations with personas
- Deep-linking the Agents panel via query params
- Views-style **agent shares** (Shared tab deferred)
- `is_locked` / immutable templates (admins may edit originals)
- MongoDB / worker migration for agents or encrypted conversation records
  (see [Future](#future))

---

## Product model

| Layer            | Meaning                                                                 |
| ---------------- | ----------------------------------------------------------------------- |
| **Model**        | Workspace LLM integration (Settings → AI models)                        |
| **Agent**        | Persona + encrypted instructions + skill/tool enablement + autonomy     |
| **Conversation** | Thread; optionally bound to an `agentId` (URL and/or `agent_id` column) |

### Roles

| Actor      | Can                                                                                                                                                   |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Admin**  | Create/edit/archive/delete admin originals (`owner_id` null); toggle skills/tools; set exactly one global `is_default`; must keep ≥1 active agent     |
| **Member** | List admin originals + own forks; fork each original **once**; edit/archive/delete **own** forks only; set personal preferred default in localStorage |

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
- Member preferred default: **localStorage** agent id; client sends `agentId`
  when bound; API falls back to global `is_default` when omitted.

**Gallery tabs:** **Mine** | **Archived** (Shared deferred / empty). Search
beside the Agents heading.

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

- Helper: `apps/api/src/lib/secrets/token-crypto.ts`
- Key: existing `INTEGRATION_TOKEN_ENCRYPTION_KEY` (shared with integrations /
  GitHub / Jira) — no new env var in this slice.
- Service layer encrypts on write and decrypts on authorized read / chat
  runtime. Postgres operators see ciphertext only.
- Seeded Alice prompts are public in git historically, but seed still stores
  ciphertext so there is one code path. Custom / forked instructions are the
  privacy-sensitive case.
- Losing the encryption key makes stored instructions unrecoverable.

---

## API (planned)

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

Chat runtime resolves `agentId` when provided and visible; otherwise the
active `is_default` agent. Provider tools are filtered to enabled keys that
exist in the code registry. Specialized flows load + decrypt the matching
tool `instruction`.

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
- Unbound chats use localStorage preferred id when still visible; otherwise
  the API global default (Alice brand until a fork is bound).

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

**Web (API-backed catalog; preferred default in localStorage only):**

- Panel: `apps/web/app/chat/_components/chat-agents-panel-dialog.tsx`
- Gallery: `apps/web/app/chat/_components/chat-agents-gallery.tsx`
- Customize: `apps/web/app/chat/_components/chat-agent-customize-page.tsx`
- Catalog helpers / preferred id:
  `apps/web/app/chat/_helpers/chat-agents-catalog.ts`
- Client API: `apps/web/app/chat/_services/chat-agents-*.ts`
- URL helpers: `apps/web/app/chat/_helpers/chat-url.ts`

**API / DB (this slice):**

- Schema: `packages/db/prisma/schema.prisma` (`chat_tools`, `chat_skills`,
  `chat_agents`, joins)
- Seed: `packages/db/src/seed.ts`
- Routes: `apps/api/src/routes/api/chat-agents/`
- Runtime: `apps/api/src/routes/api/chat/chat.service.ts`

---

## Future

Out of scope for this slice; keep the current encrypt helpers and agent shape
portable:

1. Move agentic / instructions data to **MongoDB** reached from a **worker**
   app.
2. Move chat conversation history **out of Supabase Storage** into encrypted
   conversation records in that store.
3. Views-style **agent shares** and a populated Shared gallery tab.
