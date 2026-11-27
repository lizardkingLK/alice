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
2. Select **Add Project** (opens fullscreen by default; use minimize if you prefer
   a smaller dialog). If a draft was saved earlier, choose **Resume Draft** or
   **Start Fresh** inside the same form before continuing — unless
   **Settings → Preferences → Auto-save project drafts** is on, in which case
   the draft resumes automatically.
3. Complete **Details** (name, key, description, dates — owner moves to
   **Members**).
4. On **Types**, configure the work-item catalog (drag to order; icon and color
   pickers update cards live). Names must be unique; custom types get a hidden
   key automatically.
5. On **Integrations**, pick **None** or one **project management** provider
   (Jira) and **None** or one **source control** provider (GitHub), then bind
   one or more organization **AI agents** (star one as the project default).
   Mint new AI keys in
   [Workspace integrations](../profile-and-settings/workspace-integrations.md)
   first — create only **binds** them (no API keys on this step).
6. On the optional **Sprint** step, configure an initial sprint if needed.
7. On **Members**, select project members and mark one **Owner** (must be a
   manager). The list shows **verified** users only — someone who has finished
   signup. Use **Quick create** beside search to:
   - select an existing verified user by email, or
   - invite a new **Manager** or **Member** (you get **Invitation sent**; they
     are not selectable as member/owner until they complete signup).

   That delay is intentional: project ownership and membership require a real
   account. Ask invitees to check spam if the mail is missing. Optionally enable
   **Create an initial team** and search members by name or email.

8. Submit **Create Project**.

Drafts keep Integrations choices (including AI binds) on resume; API keys are
never stored in drafts. See
[INTEGRATION_SCOPES.md](../../features/integrations/INTEGRATION_SCOPES.md).

Creation is accepted quickly — you are not left waiting on the form while the
database finishes (**async** acknowledge, then background create/import). Watch
the [dashboard inbox](../notifications/dashboard-inbox.md) for a **project
ready** notification with a link to the new project, or a **failure** notice if
something went wrong (includes a short reference id for support). The bell
badge updates live when that alert arrives (no reload needed).

You become a **project member** (so the project stays in your accessible list).
The manager you mark as **Owner** on the Members step becomes the owner and is
also added as a member (along with any other members you selected).

If you checked **import from Jira** during create, import after the project
appears: open it from the inbox link (or Projects list), then use the
**Integrations** tab.

---

## After creation

- Open the project workspace to add **Members**, **Teams**, and **Work items**
- Configure **Integrations** on the project **Integrations** tab
- Adjust the work-item type catalog with [Project types](./project-settings.md)
  and [Work-item types and hierarchy](./work-item-types-and-hierarchy.md)

The creating admin and the owner stay on the Members list and cannot be removed
from membership (see [Project members](./project-members.md)).

---

## Related

- [Browse projects](./browse-projects.md)
- [Project integrations](./project-integrations.md)
- [Dashboard inbox](../notifications/dashboard-inbox.md)
