# Alice agents

Personalize the workspace **Alice** agent (or your own fork) and use it in
chat.

**Audience:** All users

---

## What agents are

An **agent** is a role with its own instructions, tone, skills, and tools. It
is not the same as an **AI model** (Gemini, OpenAI, etc.) — admins still
connect models under **Settings → Integrations**.

Alice ships one workspace default agent: **Alice**. Admins can customize that
agent for everyone. You can **fork** it once into a personal copy, customize
that copy, and optionally prefer it as **your** default in this browser.

Portraits use DiceBear (style + seed) on gallery cards and in bound chats.

---

## Where to find them

| Surface             | How                                                              |
| ------------------- | ---------------------------------------------------------------- |
| **Agents gallery**  | On `/chat`, select the **Agents** (grid) icon in the chat header |
| **Customize**       | Open a gallery card inside the Agents dialog                     |
| **Chat with agent** | On the agent detail view, choose the **Chat** icon               |

The header Alice **drawer** stays conversation-only. Use the full **Alice** page
to manage agents.

---

## Gallery tabs

| Tab          | Contents                                                           |
| ------------ | ------------------------------------------------------------------ |
| **Mine**     | Workspace (admin) agents you can open or fork, plus agents you own |
| **Archived** | Personal agents you archived                                       |

**Shared with me** is not available yet.

Use **Search agents…** (to the right of the Agents heading) to filter the
active tab by name, title, persona, description, or author.

---

## Defaults

| Kind                       | Who sets it                  | Effect                                                                  |
| -------------------------- | ---------------------------- | ----------------------------------------------------------------------- |
| **Workspace default**      | Admins                       | Used when chat does not specify an agent (and for specialized AI areas) |
| **Your preferred default** | You, in this browser (local) | Bound chats / composer prefer that agent when you choose it             |

If only one agent remains in the workspace, Alice uses that agent everywhere.

Admins cannot remove the last remaining agent.

---

## Customize agent

In the Agents dialog detail view you can:

- Set a **Name** and **Title**. The title appears under the name in the
  gallery, detail view, and in chat.
- Edit **instructions** (admins on workspace agents; you on your forks).
- Toggle **skills** and **tools** (admins on workspace agents; you on your
  forks). Tool handlers are still enforced on the server — disabled tools are
  not offered to the model.
- Adjust the DiceBear portrait (style and seed) when editing is allowed.
- See the author byline as **by {name}** (no email).
- **Fork** once from each workspace (admin) agent. Personal agents use
  **Save** instead of fork.
- **Archive** a personal agent (confirmation). It becomes read-only and moves
  to **Archived**. Use **Restore** to edit again, or **Delete** to remove it.
- **Chat** opens a conversation with that agent (closes the dialog). Unsaved
  edits ask you to save first.

In an open chat bound to an agent, the header and message labels use that
agent’s name, title, and portrait (click the header identity to reopen the
Agents dialog on that agent). Without a bound agent, chat uses the workspace
default (Alice branding unless another agent is the sole remaining default).

Tools only use **projects you are a member of**.

---

## Conversation empty states

| Situation                              | What you see                                            |
| -------------------------------------- | ------------------------------------------------------- |
| No AI models in the workspace          | Add an AI model first (admins: Settings → Integrations) |
| Models connected, no conversations yet | **Create conversation**                                 |

---

## Related

- [Use the AI assistant](./use-ai-assistant.md)
- [Workspace integrations](../profile-and-settings/workspace-integrations.md) (chat models)
