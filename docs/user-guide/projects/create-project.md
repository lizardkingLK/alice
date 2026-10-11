# Create a project

Add a new project to the workspace.

**Audience:** Admins

---

## Before you start

Only **admins** can create projects in Alice. Managers and members can be added
to existing projects but cannot use **Add Project**.

Ensure Jira or GitHub details are ready if you plan to connect integrations
during setup.

---

## Steps

1. Go to **Projects** in the sidebar (`/projects`).
2. Select **Add Project**.
3. Complete the **Create New Project** form (name, description, dates, etc.).
4. Optionally connect **Jira** or **GitHub** in the same flow if prompted.
5. Submit **Create Project**.

Creation is accepted quickly — you are not left waiting on the form while the
database finishes. Watch the [dashboard inbox](../notifications/dashboard-inbox.md)
for a **project ready** notification with a link to the new project, or a
**failure** notice if something went wrong (includes a short reference id for
support).

You become a **project member** (so the project stays in your accessible list).
The manager you pick as **Project Owner** becomes the owner and is also added as
a member.

If you checked **import from Jira** during create, import after the project
appears: open it from the inbox link (or Projects list), then use the
**Integrations** tab.

---

## After creation

- Open the project workspace to add **Members**, **Teams**, and **Work items**
- Configure **Integrations** on the project **Integrations** tab
- Adjust allowed types with [Project types](./project-settings.md)

The creating admin and the owner stay on the Members list and cannot be removed
from membership (see [Project members](./project-members.md)).

---

## Related

- [Browse projects](./browse-projects.md)
- [Project integrations](./project-integrations.md)
- [Dashboard inbox](../notifications/dashboard-inbox.md)
