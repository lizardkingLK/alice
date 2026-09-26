# Alice agent personalization

Status: **In progress** (UI-first)

Personalized **agents** (roles with instructions, scope, and autonomy) open
from the chat header gallery panel. They are distinct from Settings **AI
models** (`IntegrationCategory.ai_agent` = LLM providers).

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
- Keep **/chat** conversation-first; Agents live in a **header gallery dialog**
  (fullscreenable), not a second page tab.
- Share agents with Views-style recipient ACL; **fork** creates a **new
  version** owned by the forking user.
- Scope agent context to projects the actor can access (`project_members` /
  `listAccessibleProjectIds`).
- Keep the header **drawer** conversation-only (no Agents gallery).

## Non-goals (v1)

- Monday-style Jobs / Channels / Activity run history
- Custom agent builder from blank (system templates + fork only)
- Drawer Agents UI
- Replacing Settings model integrations with personas
- Deep-linking the Agents panel via query params

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
Only system agents can be forked; personal agents use Save. Personal agents
can be **archived** (readonly + Archived tab), **restored**, or **deleted**
(localStorage). Chat / Save / lifecycle actions use confirmation dialogs.
Toasts use title + description (Sonner).

### Fork = new version

- Fork from system or shared → new personal agent with `forkedFrom` +
  incremented `version`.
- System template stays immutable.
- Gallery tabs: **Mine** | **Shared** | **Archived** (Views parity), with
  search beside the Agents heading.

### Project Manager scope

- Tools and docs only use accessible projects (`listAccessibleProjectIds`).
- Optional focus project on the agent must remain in that set.
- Documentation must state membership isolation.

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
- Unbound chats keep the Alice brand.

---

## Naming clarity

| Product label              | Meaning                                          |
| -------------------------- | ------------------------------------------------ |
| **Agents** (gallery panel) | Role personalization                             |
| **AI models** / Settings   | LLM providers (`ai_agent` category historically) |

---

## UI map (Slice 1)

```text
/chat
┌────────────┬──────────────────────────────────────────┐
│ History    │ Header: identity · Agents · model · new  │
│            │ Thread + composer                        │
└────────────┴──────────────────────────────────────────┘
                      │
                      ▼ Agents dialog
┌─────────────────────────────────────────────────────┐
│ Gallery: Mine | Shared | Archived  (or detail form) │
└─────────────────────────────────────────────────────┘
```

### Code anchors (web)

- Panel: `apps/web/app/chat/_components/chat-agents-panel-dialog.tsx`
- Gallery: `apps/web/app/chat/_components/chat-agents-gallery.tsx`
- Customize: `apps/web/app/chat/_components/chat-agent-customize-page.tsx`
- Catalog: `apps/web/app/chat/_helpers/chat-agents-catalog.ts`
- URL helpers: `apps/web/app/chat/_helpers/chat-url.ts`
