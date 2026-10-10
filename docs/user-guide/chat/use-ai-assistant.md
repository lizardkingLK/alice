# Use the AI assistant

Chat with Alice to inspect and create workspace data.

**Audience:** All users

---

## Full-page chat

1. Open **Alice** in the sidebar (`/chat`).
2. Optionally open **Agents** from the grid icon in the chat header to browse
   and customize role agents (see [Alice agents](./agents.md)).
3. Optionally pick a **model** from the **Cpu** icon in the chat header (when
   your admin configured models). Open a **provider** (for example Gemini or
   SpaceXAI), then choose the model in the submenu.
4. Use the **plus** icon to start a **new chat**. Admins also get **Configure AI
   models** from that plus menu (opens Settings). Admins can mark the selected
   model as the workspace default from the model menu.
5. Type a message in the composer and press **Enter** to send (**Shift+Enter**
   for a new line).
6. Read Alice's reply on the left; your messages appear on the right.

Use the header **plus** (or **New chat** in the admin menu) to start a fresh
conversation. Open the history sidebar to switch, **rename**, or delete past
threads. When a conversation is open, the header breadcrumb shows
**Dashboard → Chat →** that chat’s title.

If no models are connected, Alice asks you to **add an AI model** first. If
models exist but you have no conversations yet, use **Create conversation**.

---

## Header sidebar (Alice dock)

On any dashboard page (except `/chat`):

1. Select the **Alice** control in the header (between notifications and your
   profile).
2. Alice opens as a **right-hand sidebar** that shares the page width — it does
   **not** cover the page with a blur overlay.
3. Select the control again (or the **Close** control in Alice’s header) to
   hide the sidebar and give the page full width.
4. Continue the conversation without leaving your current page.

---

## Workflow designer context

When the project **Workflow** designer is open (managers/admins), Alice is
**aware of that designer** (project, live draft, unsaved changes). You can ask
in natural language to change the graph — for example add a state, connect Dev
to QA, or turn on **Lock record in this state**, **Terminal state**, or
**Require children** on a transition.

Board column drafts are no longer offered; workflow proposals are the only
structured configuration path.

### Apply or reject suggestions

1. Alice proposes a change and shows an **action card** with a short summary
   (and optional change list).
2. Choose **Apply** or **Reject**. Changes are **not** written until you Apply.
   **Reject** dismisses the card without changing the canvas.
3. Keep the **Workflow** designer open for that project when you Apply. If the
   canvas has **unsaved** edits, Alice **saves** them first, then applies, then
   refreshes the designer — without a full page reload.
4. If validation fails, the card explains the problem; your saved graph stays
   put.
5. To undo a proposal you have not Applied yet, ask Alice to cancel or discard
   it — she dismisses the pending card; the canvas stays unchanged.

Alice still cannot bypass project roles: only managers/admins can persist
workflow configuration. See
[Workflow designer](../board-and-planning/workflow-designer.md).

---

## What Alice can help with

Examples:

- **List accessible projects**: Ask _"show all projects"_ or _"list down all the projects"_. Alice enforces your role permissions and project memberships, responding with _"Here are all the projects that are available to you:"_ followed by a clean Markdown table (`| Project Name | Key | Description |`). Unassigned projects are strictly hidden
- **Create** projects, sprints, and work items through guided prompts
- **Propose workflow designer changes** (managers) with Apply / Reject cards when
  the workflow side panel is open. Ask Alice to undo or cancel before you Apply
  to dismiss a pending proposal without changing the canvas
- **Attach and inspect documents**: Click the paperclip icon (📎) to attach JSON, CSV, TSV, Markdown tables, Indented text outlines, YAML, or image files
- **Universal file parsing**: Ask Alice to extract work items, estimates, priorities, parent links, and custom dynamic fields from any supported document format
- **Check duplicates**: Ask Alice to compare parsed items against existing project items to spot duplicates before creating
- **Atomic batch import**: Bulk create work items with strict hierarchy validation (`Epic` &rarr; `Feature` &rarr; `Story` &rarr; `Task` &rarr; `Issue`). If invalid, zero items are created and Alice asks whether you want to fix the file or skip invalid items
- **Incremental backlog synchronization**: Re-upload an updated file anytime to update existing items' fields and reorganize their parent-child hierarchy in-place without creating duplicates
- **Interactive action cards**: View real-time cards for created, updated, or removed items with deep links to their detail pages
- Answer questions about projects and sprints you can already access

Alice confirms intent in conversation before making changes. Attachment links auto-refresh if their signed URLs expire, so you never encounter expired download errors.

Alice respects your sign-in and role — it cannot bypass project membership or
admin-only areas. Alice is focused exclusively on ALICE workspace management and will politely decline unrelated general requests.

---

## Tips

- Be specific about project names, types, and assignees.
- If no model appears in the dropdown, ask an admin to configure chat models under
  [Workspace integrations](../profile-and-settings/workspace-integrations.md).
- Notifications for processed chat tasks may appear in the
  [dashboard inbox](../notifications/dashboard-inbox.md).

---

## Related

- [Alice (AI chat)](./README.md)
- [Role-based project & chat access](../projects/project-registry-and-chat-access.md)
- [User testing guide](./user-test-guide.md)
- [Create a work item](../work-items/create-work-item.md)
