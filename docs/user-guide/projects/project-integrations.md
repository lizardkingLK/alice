# Project integrations

Connect GitHub and Jira, and bind organization AI chat models to a project.

**Audience:** Managers and admins

---

## Open integrations

1. Go to **Projects** and open a project you can access.
2. Select the **Integrations** tab.

The **Integrations** tab is available to **managers and admins**. Connecting
credentials and saving AI binds require those roles.

---

## GitHub

Use the **GitHub** card to authorize your GitHub account with OAuth and bind one
repository (`owner/repo`) to the project. Alice uses that link for pull
requests, commits, and branch activity on work items.

### Connect or update

1. Select **Modify GitHub Settings** (or **Connect GitHub** if nothing is linked
   yet).
2. If status shows **Not connected**, select **Connect GitHub**. A popup opens
   for GitHub consent — allow popups for Alice if the browser blocks it.
3. After you approve access, the popup returns via
   `/integrations/github/done`. Close it when prompted; the project page
   refreshes the connection automatically.
4. Pick a repository from the list (or paste a
   `https://github.com/owner/repo` URL).
5. Select **Save GitHub Configuration**.

You can **Switch Account** to reconnect with a different GitHub user, or
**Disconnect** to revoke the OAuth connection. Only the person who authorized
GitHub (or an admin who owns an admin-established connection) can disconnect
it.

Tokens stay on the server and are never shown in the UI. You do **not** paste a
personal access token for the OAuth path. Projects that still have a legacy PAT
are labeled as such until you reconnect with OAuth.

Without a connected account, Alice can only work with **public** repositories.

---

## Jira Cloud

Use the **Jira** card to:

1. **Connect** with Atlassian OAuth (3LO) as a manager.
2. Link a Jira site and **project key** to this Alice project.
3. **Preview** and **import** issues when ready.

After OAuth, return via `/integrations/jira/done` if redirected by Atlassian.

If another manager already connected a Jira site, you can use that **shared**
connection to link and sync. Only the person who authorized Atlassian can
**Disconnect** the OAuth connection.

---

## AI agents

Use the **AI agents** card to bind organization chat models (from
**Settings → Integrations**) to this project for Alice Chat.

1. Optionally **Import from project** — pick another project you belong to that
   already has AI binds, then **Import binds** (copies org model references
   only; API keys are never copied).
2. Enable one or more models with the checkboxes.
3. Star one enabled model as the **project default**.
4. Select **Save AI models**.

Empty selection clears the project pool — chat falls through to organization
defaults. New API keys are still created only in
[Workspace integrations](../profile-and-settings/workspace-integrations.md)
(bind-by-reference; keys are not copied onto the project).

---

## Organization vs project

| Level            | Where                                           | Examples                                 |
| ---------------- | ----------------------------------------------- | ---------------------------------------- |
| **Project**      | Project → **Integrations** tab                  | GitHub repo, Jira import, AI model binds |
| **Organization** | **Settings** → **Integrations** (manager/admin) | AI providers (vault), Slack (planned)    |

Organization providers are **bound**, not copied into project scope. See
[INTEGRATION_SCOPES.md](../../features/integrations/INTEGRATION_SCOPES.md).

---

## Related

- [Create a project](./create-project.md)
- [Workspace integrations](../profile-and-settings/workspace-integrations.md)
