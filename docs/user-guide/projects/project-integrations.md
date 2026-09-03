# Project integrations

Connect GitHub and Jira to a project.

**Audience:** Managers and admins

---

## Open integrations

1. Go to **Projects** and open a project you can access.
2. Select the **Integrations** tab.

Anyone with project workspace access can view the tab; connecting credentials
requires appropriate permissions for each integration.

---

## GitHub

Use the **GitHub** card to:

1. Select **Modify GitHub Settings** (or equivalent).
2. Enter your repository and a **personal access token** (PAT).
3. Save.

Tokens are stored encrypted. Alice uses a **write-only** contract for linked PR
and commit metadata — follow your org's token scope policy.

---

## Jira Cloud

Use the **Jira** card to:

1. **Connect** with Atlassian OAuth (3LO) as a manager.
2. Link a Jira site and **project key** to this Alice project.
3. **Preview** and **import** issues when ready.

After OAuth, return via `/integrations/jira/done` if redirected by Atlassian.

---

## Workspace vs project

| Level         | Where                                   | Examples                  |
| ------------- | --------------------------------------- | ------------------------- |
| **Project**   | Project → **Integrations** tab          | GitHub repo, Jira import  |
| **Workspace** | **Settings** → **Integrations** (admin) | AI providers, Slack mocks |

Project integrations do not replace workspace-level AI settings on your profile.

---

## Related

- [Create a project](./create-project.md)
- [Workspace integrations](../profile-and-settings/workspace-integrations.md)
