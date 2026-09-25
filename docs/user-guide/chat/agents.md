# Alice agents

Personalize role agents (starting with **Project Manager**) and use them in
Alice chat.

**Audience:** All users

---

## What agents are

An **agent** is a role with its own instructions, tone, and project scope. It is
not the same as an **AI model** (Gemini, OpenAI, etc.) — admins still connect
models under **Settings → Integrations**.

Alice ships one system template for now: **Project Manager**, with a DiceBear
character portrait on the gallery card. You can open it, customize a forked
copy (including portrait style and seed), and chat with that agent bound to a
conversation.

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

| Tab                | Contents                                                             |
| ------------------ | -------------------------------------------------------------------- |
| **Mine**           | System templates you can open, plus agents you own (including forks) |
| **Shared with me** | Agents others shared with you (Views-style sharing)                  |
| **Archived**       | Personal agents you archived                                         |

Use **Search agents…** (to the right of the Agents heading) to filter the
active tab by name, title, persona, description, or author.

---

## Customize agent

In the Agents dialog detail view you can:

- Set a **Name** (persona, e.g. Alex) and a **Title** (role, e.g. Project
  Manager). The title appears under the name in the gallery, detail view, and
  in chat.
- View system templates as read-only text (non-admins). Admins can edit system
  templates, including the portrait.
- See the author byline as **by {name}** (no email). System templates show
  Alice Admin; after you fork, the byline shows you.
- Admins can **Mark as system** on a personal agent so others can fork it.
- **Fork** only from system templates. Personal agents use **Save** instead.
- **Archive** a personal agent (confirmation). It becomes read-only and moves
  to **Archived**. Use **Restore** to edit again, or **Delete** to remove it
  from this browser.
- **Chat** opens a conversation with that agent (closes the dialog). Unsaved
  edits ask you to save first.

In an open chat bound to an agent, the header and message labels use that
agent’s name, title, and portrait (click the header identity to reopen the
Agents dialog on that agent). Without a bound agent, the chat still shows
Alice.

Project Manager only uses **projects you are a member of**.

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
