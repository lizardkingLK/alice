# Project integrations

Connect GitHub and Jira, and bind organization AI chat models to a project.

**Audience:** Managers and admins

---

## Open integrations

1. Go to **Projects** and open a project you can access.
2. Select the **Integrations** tab.

The tab opens with a short **summary** of source control, project management,
and AI agent binds, then a Settings-style marketplace: search, category tabs,
and grouped providers.

**Source control** and **project management** are single-select (**None** or one
provider). **AI agents** allow multiple organization model binds. Other catalog
groups show as **Coming soon**.

The **Integrations** tab is available to **managers and admins**. Connecting
credentials and saving AI binds require those roles.

---

## GitHub

On **Source control**, choose **GitHub** (or **None**). Use the **GitHub** card
to authorize your GitHub account with OAuth and bind one repository
(`owner/repo`) to the project. Alice uses that link for pull requests, commits,
and branch activity on work items. After a link is saved, clear it with
**Disconnect** on the card before **None** stays available.

**Today:** connect with GitHub OAuth and link PRs to work items (often manually).
**Planned:** install an Alice GitHub App, sync PRs/commits/branches automatically,
and (later) run in-app workflows that can call agent tools such as Cursor — see
the engineering plan in
[GITHUB_INTEGRATION.md](../../features/projects/GITHUB_INTEGRATION.md#phased-delivery-planned).
Those App install steps are **not** available in the product UI yet.

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

On **Project management**, choose **Jira** (or **None**). Use the **Jira** card
to:

1. **Connect** with Atlassian OAuth (3LO) as a manager.
2. Link a Jira site and **project key** to this Alice project.
3. **Preview** and **import** issues when ready.

After OAuth, return via `/integrations/jira/done` if redirected by Atlassian.

If another manager already connected a Jira site, you can use that **shared**
connection to link and sync. Only the person who authorized Atlassian can
**Disconnect** the OAuth connection.

---

## AI agents

Use the **AI agents** card to enable organization chat models and mint
**project-only** models for Alice Chat.

Models are grouped by provider (for example Anthropic, Gemini). Expand a group
to see rows with **Enable**, label, model id, **Scope**, **Owner**, project
**Default**, and actions. Use **Scope** and **Owner** filters to reduce
clutter.

1. **Organization** rows — enable or disable for this project. Credentials stay
   read-only here; edit keys in
   [Workspace integrations](../profile-and-settings/workspace-integrations.md).
2. **Project** rows — mint with **+** on a provider group, or edit an existing
   project model. Each mint stores its own API key for this project only
   (not shareable to other projects). Optionally **Mark as project default**
   when connecting.
3. Star one enabled model as the **project default**.
4. Select **Save AI models**.

Empty selection clears the project pool — chat falls through to organization
defaults.

---

## Organization vs project

| Level            | Where                                           | Examples                                                     |
| ---------------- | ----------------------------------------------- | ------------------------------------------------------------ |
| **Project**      | Project → **Integrations** tab                  | GitHub repo, Jira import, project AI keys, org model enables |
| **Organization** | **Settings** → **Integrations** (manager/admin) | Shareable AI vault, Slack (planned)                          |

Organization models are **enabled by reference**. Project models keep their own
keys on that project. See
[INTEGRATION_SCOPES.md](../../features/integrations/INTEGRATION_SCOPES.md).

---

## Related

- [Create a project](./create-project.md)
- [Workspace integrations](../profile-and-settings/workspace-integrations.md)
