# Edit a work item

Update title, description, and fields on an existing item.

**Audience:** All users

---

## Open an item

1. From **Work Items**, **Board**, **Backlog**, or a project tab, select a row
   or card.
2. You'll land on `/work-items/[id]`.

---

## What you can edit

On the detail page:

- **Title** and **description** (rich text) in the main pane
- **Status**, **priority**, **assignee**, **reporter**, **labels**, **due date**,
  **sprint**, and other fields in the sidebar

## Edit from a dialog

Create/edit dialogs (work-item list, board, calendar, charts table, and similar)
use the shared **Work Item** form:

- Opening **Edit** loads the full work item (including description) before the
  form binds — list and chart table rows intentionally omit TipTap JSON.
- **Description** uses the same compact rich-text editor as comments (select
  text for formatting).
- Validation and save messages stay **above Cancel / Save** so you do not need
  to scroll the form to see them.

---

## Done items are read-only (mostly)

When status is **Done**:

- Title, description, assignee, attachments, and subtask actions are locked
- **Status** stays editable so you can reopen the item
- **Discussion** comments still work

---

## Subtasks

| Action               | How                                                      |
| -------------------- | -------------------------------------------------------- |
| **Create subtask**   | Header button — new child item                           |
| **Link Subtask** (+) | Attach an existing orphan item of the allowed child type |
| **Unlink**           | Remove parent link (item becomes orphan again)           |

You cannot move an item to **Done** while direct subtasks are incomplete.

---

## Related

- [Assign and status](./assign-and-status.md)
- [Comments and activity](./comments-and-activity.md)
