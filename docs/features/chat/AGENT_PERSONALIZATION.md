# Alice agent personalization

Status: **In progress** (UI-first)

Personalized **agents** (roles with instructions, scope, and autonomy) sit
alongside the existing **conversation** workspace. They are distinct from
Settings **AI models** (`IntegrationCategory.ai_agent` = LLM providers).

Related:

- Feature index: [README.md](./README.md)
- Alice assistant (tools, API, storage): [AI_CHATBOT.md](./AI_CHATBOT.md)
- Model pool / Settings: [SETTINGS_INTEGRATIONS.md](../integrations/SETTINGS_INTEGRATIONS.md)
- Views share pattern (reuse for agents): [FAVORITES_AND_VIEWS.md](../views/FAVORITES_AND_VIEWS.md)
- Project access for tools: [UNIFIED_PROJECT_REGISTRY_AND_CHAT_VALIDATION.md](../projects/UNIFIED_PROJECT_REGISTRY_AND_CHAT_VALIDATION.md)
- User guide: [agents.md](../../user-guide/chat/agents.md)

---

## Goals

- Let users pick and personalize **role agents** (starting with **Project
  Manager**) that bind into Alice chat.
- Separate **Conversation** (threads) from **Agents** (gallery + customization).
- Share agents with Views-style recipient ACL; **fork** creates a **new
  version** owned by the forking user.
- Scope agent context to projects the actor can access (`project_members` /
  `listAccessibleProjectIds`).
- Keep the header **drawer** conversation-only (no Agents gallery / tabs).

## Non-goals (v1)

- Monday-style Jobs / Channels / Activity run history
- Custom agent builder from blank (system templates + fork only)
- Drawer Agents UI
- Replacing Settings model integrations with personas

---

## Product model

| Layer            | Meaning                                                         |
| ---------------- | --------------------------------------------------------------- |
| **Model**        | Workspace LLM integration (Settings → AI models)                |
| **Agent**        | Persona: instructions, autonomy, project scope, version lineage |
| **Conversation** | Thread; optionally bound to an `agentId`                        |

### Catalog kinds

| Kind                | Who                          | Editable                    | Share               |
| ------------------- | ---------------------------- | --------------------------- | ------------------- |
| **System template** | Seed / admin-marked          | No — fork to edit           | Visible as template |
| **Personal**        | Owner (fork or later create) | Owner                       | Views-style Share   |
| **Shared**          | Recipient via ACL            | Owner only; recipient forks | —                   |

**v1 predefined system agent:** Project Manager only (display name **Alex**,
title **Project Manager**). Portraits use
[DiceBear](https://www.dicebear.com/) (`avatarStyle` + `avatarSeed`). Personal
forks persist in **localStorage** until the DB slice ships.

**System vs personal UX:** Non-admins see system templates as read-only text
(no portrait editor). Admins can edit system templates and **Mark as system**
on personal agents. The Customize header byline shows `by {authorName}`
(no email): system templates use Alice Admin; forks use the signed-in user.
Only system agents can be forked; personal agents use Save. Chat / Save use
confirmation dialogs when dirty. Toasts use title + description (Sonner,
styled like [shadcn Toast](https://ui.shadcn.com/docs/components/base/toast)).

### Fork = new version

- Fork from system or shared → new personal agent with `forkedFrom` +
  incremented `version`.
- System template stays immutable.
- Gallery tabs: **Mine** | **Shared** | **Archived** (Views parity).

### Project Manager scope

- Tools and docs only use accessible projects (`listAccessibleProjectIds`).
- Optional focus project on the agent must remain in that set.
- Documentation must state membership isolation.

---

## Routing & UX

| Surface         | URL                                                       | Behavior                                                                            |
| --------------- | --------------------------------------------------------- | ----------------------------------------------------------------------------------- |
| Conversation    | `/chat` or `/chat?tab=conversation&conversationId=<uuid>` | Thread + composer; optional `&agentId=<uuid>` when bound                            |
| Agents gallery  | `/chat?tab=agents`                                        | Mine / Shared / Archived cards                                                      |
| Agent customize | `/chat/agents/[agentId]`                                  | Full-page editor (rename, save, fork, instructions, autonomy, scope) + **Chat** CTA |
| Drawer          | Header launcher                                           | Conversation only — no tab shell                                                    |

**Defaults:** bare `/chat` → conversation tab; bootstrap latest thread or empty
states. Prefer query key `conversationId` (not bare `id`) for clarity and
backward compatibility with today’s `?conversationId=`.

### Navigation flows

```text
Gallery card  →  /chat/agents/[agentId]  (customize page)
Chat CTA      →  /chat?tab=conversation&agentId=<id>[&conversationId=…]
```

Gallery does **not** jump straight into a thread.

### Conversation empty / gate states (priority)

1. **No AI models** → “Add an AI model first” (existing Settings deep link). No
   create-conversation CTA.
2. **Models ok, zero conversations** → charts-style centered CTA: **Create
   conversation**.
3. Otherwise → normal thread / hero.

### Bound chat identity

- When `agentId` is set on `/chat`, the conversation header and assistant
  message rows show that agent’s **name**, **title** (under the name), and
  DiceBear avatar (not the generic Alice Sparkles mark).
- Header identity links to `/chat/agents/[agentId]` (customize). There is **no**
  right-hand agent sidebar.
- Unbound chats (drawer / no `agentId`) keep the Alice brand.

---

## Naming clarity

| Product label                         | Meaning                                          |
| ------------------------------------- | ------------------------------------------------ |
| **Agents** (chat tab / gallery)       | Role personalization                             |
| **AI models** / Settings integrations | LLM providers (`ai_agent` category historically) |

Avoid calling both “AI agents” in user-facing copy.

---

## Implementation slices

| Slice | Scope                                                                                                   | Status                     |
| ----- | ------------------------------------------------------------------------------------------------------- | -------------------------- |
| **1** | Plan doc; `/chat` tab shell; gallery; customize page stub; empty states; Chat CTA; mock Project Manager | Done (UI; session catalog) |
| **2** | Persist agents / shares / versions (DB + API); Views-style Share dialog                                 | Planned                    |
| **3** | Bind `agentId` on conversations; prompt + tool assembly; project_member enforcement                     | Planned                    |
| **4** | Compact chat agent strip wired to live records                                                          | Planned                    |
| **5** | Jobs / activity / mentions (Monday-like)                                                                | Later                      |

---

## UI map (Slice 1)

```text
/chat?tab=conversation
┌────────────┬──────────────────────┬─────────────────┐
│ History    │ Thread + composer    │ Agent strip     │
│            │ Empty: model / create│ (when agentId)  │
└────────────┴──────────────────────┴─────────────────┘

/chat?tab=agents
┌─────────────────────────────────────────────────────┐
│ Gallery: Mine | Shared | Archived                   │
│ Card → /chat/agents/[agentId]                       │
└─────────────────────────────────────────────────────┘

/chat/agents/[agentId]
┌─────────────────────────────────────────────────────┐
│ Customize form · Fork (new version) · Save · Chat   │
└─────────────────────────────────────────────────────┘
```

### Code anchors (web)

- Shell: `apps/web/app/chat/_components/chat-workspace.tsx`
- Gallery: `apps/web/app/chat/_components/chat-agents-gallery.tsx`
- Customize: `apps/web/app/chat/agents/[agentId]/`
- URL helpers: `apps/web/app/chat/_helpers/chat-url.ts`
- Tab parse: `parseChatPageTab` in `apps/web/lib/search-params.ts`
- Catalog seed: `apps/web/app/chat/_helpers/chat-agents-catalog.ts`

---

## Open follow-ups (post–Slice 1)

- Promote gallery sub-tab to `agentsTab` query when shareable links matter.
- Session overrides in the chat strip vs always open full editor.
- Admin UI to mark additional system templates.
