# Create a work item

Add a new epic, story, task, or issue to a project.

**Audience:** All users

---

## From the registry

1. Go to **Work Items** (or **My Work**, or a project's **Work items** tab).
2. Select **Add Work-Item**.
3. Fill in the form:
   - **Project** (required)
   - **Type** — Epic, Story, Task, or Issue
   - **Title** (required)
   - **Description**, assignee, sprint, and due date (optional)
   - On the compact (modern) form: **priority**, **story points**, and
     **labels** are under **More**
4. Submit **Create Work Item** (or **Create** on the compact form).

The new item opens in the list and on the board (unless status is **Draft**).

---

## Modern create dialog chrome

When your preference is the **compact (modern)** create form, the dialog
supports a few layouts (similar to Jira create):

| Control               | What it does                                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Minimize**          | Shrink to a small **Create** pill in the corner (from default, expanded, or floating). Click the pill to restore the **previous** layout.                                        |
| **Float**             | Detach into a bottom-right floating card so the rest of the page stays usable.                                                                                                   |
| **Expand / Collapse** | Switch between the default centered dialog and a larger expanded panel (fields as a vertical label + control list). From floating, **Expand** returns to the last centered size. |
| **Close**             | Dismiss the draft.                                                                                                                                                               |

If you click **Add Work-Item** / **Create** again while a draft is still open
(including floated or minimized), Alice asks whether to **Keep editing** or
**Discard draft**. Reloading the page while a modern create draft is open also
prompts the browser that unsaved changes may be lost.

Classic create and edit dialogs stay as blocking centered modals (expand /
collapse only).

---

## From a parent item

1. Open a work item that can have children (Epic, Story, or Task).
2. Select **Create subtask** in the header.
3. Project and child **type** are pre-filled; complete the form and submit.

The child appears in the **Subtasks** section and in hierarchy list view.

---

## Rules to know

- Child type must match the hierarchy (Epic → Story → Task → Issue).
- Parent and child must be in the **same project**.
- **Issue** items cannot have subtasks — the **Subtasks** section is hidden on
  those details pages.
- Changing the **Type** of an item that still has subtasks asks you to unlink
  those children first (or confirm detaching them), so the hierarchy stays valid.

---

## Related

- [Edit a work item](./edit-work-item.md)
- [Assign and status](./assign-and-status.md)
