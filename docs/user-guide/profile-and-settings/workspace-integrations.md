# Workspace integrations

Configure workspace-wide AI models and tools (admins).

**Audience:** Admin

---

## Open integrations

1. Sign in as an **admin**.
2. Open **Settings** in the sidebar.
3. Select the **Integrations** tab (`/settings?tab=integrations`).

Non-admins are redirected to **General** if they open this tab directly.

---

## What you configure

The integrations catalog includes workspace-level tools, notably:

| Category          | Examples                                                   |
| ----------------- | ---------------------------------------------------------- |
| **AI & chat**     | Gemini, OpenAI, Anthropic chat models for **Alice**        |
| **Collaboration** | Slack and other connectors (as enabled in your deployment) |

Each card lets admins save API keys and model settings. Secrets are stored
encrypted — they are not shown again in plain text after save.

---

## Alice chat model pool

When you activate one or more **chat model** integrations:

- Users see them in the model dropdown on `/chat` and in the header drawer
- Alice routes requests to the selected provider
- Add multiple rows (e.g. Gemini + GPT) to offer a pool

If no model is configured, chat may show an error until an admin adds one here.

---

## vs project integrations

| Scope         | Where                          | Examples               |
| ------------- | ------------------------------ | ---------------------- |
| **Workspace** | Settings → **Integrations**    | Chat models, Slack     |
| **Project**   | Project → **Integrations** tab | GitHub PAT, Jira OAuth |

Do not confuse workspace AI settings with per-project GitHub/Jira — see
[Project integrations](../projects/project-integrations.md).

---

## Related

- [Use the AI assistant](../chat/use-ai-assistant.md)
- [Project integrations](../projects/project-integrations.md)
