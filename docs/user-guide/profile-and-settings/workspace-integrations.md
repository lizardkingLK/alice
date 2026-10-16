# Workspace integrations

Configure workspace-wide AI models and tools.

**Audience:** Managers and admins

---

## Open integrations

1. Sign in as a **manager** or **admin**.
2. Open **Settings** in the sidebar.
3. Select the **Integrations** tab (`/settings?tab=integrations`).

Members are redirected to **General** if they open this tab directly.

---

## What you configure

The integrations catalog includes workspace-level tools, notably:

| Category          | Examples                                                     |
| ----------------- | ------------------------------------------------------------ |
| **AI & chat**     | Gemini, SpaceXAI, OpenAI, and Anthropic models for **Alice** |
| **Collaboration** | Slack and other connectors (as enabled in your deployment)   |

The AI cards currently have a **Preview** catalog label. This means the
integration is available to configure through the preview catalog; it does not
mean the provider has been tested with your credentials. A configuration
dialog shows **Connected** when the workspace has an active model with a
stored API key. **Connected** does not guarantee that a live provider request
will succeed.

## Connect an AI model

1. Find **Google Gemini**, **SpaceXAI**, **OpenAI**, or **Anthropic**. Use the
   **AI agents** filter if helpful.
2. Select **View integration**. Turning on the card switch also opens the same
   configuration dialog.
3. Choose one of the **Suggested models**, or enter the provider's exact
   **Model id**.
4. Enter a clear **Display label** for the chat model menu.
5. Paste the provider **API key**.
6. Optionally select **Use as workspace default in chat**.
7. Select **Connect model**.

The workspace default is the initial choice for new chat sessions. Only one
active AI model is the workspace default at a time.

### Add or edit another model

Open the provider's dialog again. Existing rows appear under **Configured
models**.

- Select **Add model** to configure another model for the same provider.
- Select an existing configured model to edit its label, model ID, API key, or
  default setting, then select **Save changes**.
- API keys are never displayed after save. **Leave the API key blank while
  editing to keep the existing stored key.** Enter a value only when you need
  to replace it.

Each configured model has a separate integration identity and stored key. API
keys are encrypted by the Alice API before storage and are not returned in
Settings responses.

## Disconnect a provider

Turn the provider card switch off and review the confirmation dialog. Confirming
disables every active model row for that provider and removes those models from
the active Alice model menu. It does not permanently delete the database rows.
Cancel leaves the integration connected.

---

## Alice chat model pool

When you activate one or more **chat model** integrations:

- Users see them in the model dropdown on `/chat` and in the header drawer
- Alice routes requests to the selected provider
- Add multiple rows under one provider or across providers to offer a model pool

Disabled or otherwise inactive integrations are not available for selection.
If no model is configured, contact a manager or admin.

If Alice chat reports that the **API key was rejected** (invalid or expired),
open the matching card here, paste a current key from the provider, and save.
Users cannot fix this themselves — only admins manage workspace integrations.

If Alice chat reports that the **API key was rejected** (invalid or expired),
open the matching card here, paste a current key from the provider, and save.
Users cannot fix this themselves — only admins manage workspace integrations.

If Alice chat reports that the **API key was rejected** (invalid or expired),
open the matching card here, paste a current key from the provider, and save.
Users cannot fix this themselves — only admins manage workspace integrations.

---

## vs project integrations

| Scope         | Where                          | Examples                 |
| ------------- | ------------------------------ | ------------------------ |
| **Workspace** | Settings → **Integrations**    | Chat models, Slack       |
| **Project**   | Project → **Integrations** tab | GitHub OAuth, Jira OAuth |

Do not confuse workspace AI settings with per-project GitHub/Jira — see
[Project integrations](../projects/project-integrations.md).

---

## Related

- [Use the AI assistant](../chat/use-ai-assistant.md)
- [Project integrations](../projects/project-integrations.md)
