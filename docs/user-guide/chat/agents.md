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

| Surface             | How                                            |
| ------------------- | ---------------------------------------------- |
| **Agents gallery**  | Open **Alice** (`/chat`) → **Agents** tab      |
| **Customize**       | Click a gallery card → full customization page |
| **Chat with agent** | On the customize page, choose **Chat**         |

The header Alice **drawer** stays conversation-only. Use the full **Alice** page
to manage agents.

---

## Gallery tabs

| Tab                | Contents                                                             |
| ------------------ | -------------------------------------------------------------------- |
| **Mine**           | System templates you can open, plus agents you own (including forks) |
| **Shared with me** | Agents others shared with you (Views-style sharing)                  |
| **Archived**       | Agents you archived                                                  |

---

## Customize page

On `/chat/agents/…` you can:

- Set a **Name** (persona, e.g. Alex) and a **Title** (role, e.g. Project
  Manager). The title appears under the name on the customize page, gallery,
  and in chat.
- View system templates as read-only text (non-admins). Admins can edit system
  templates, including the portrait.
- See the author byline as **by {name}** (no email). System templates show
  Alice Admin; after you fork, the byline shows you.
- Admins can **Mark as system** on a personal agent so others can fork it.
- **Fork** only from system templates (footer actions). Personal agents use
  **Save** instead — forks cannot be forked again.
- **Chat** (header icon) opens a conversation. If you have unsaved edits, you
  are asked to save first; confirming saves then opens chat. **Save** also asks
  for confirmation.
- Customize the DiceBear portrait from the camera icon when editing is allowed

In an open chat bound to an agent, the header and message labels use that
agent’s name, title, and portrait (click the header to return to customize).
Without a bound agent, the chat still shows Alice.

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
