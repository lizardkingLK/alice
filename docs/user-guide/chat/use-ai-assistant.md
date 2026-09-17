# Use the AI assistant

Chat with Alice to inspect and create workspace data.

**Audience:** All users

---

## Full-page chat

1. Open **Alice** in the sidebar (`/chat`).
2. Optionally pick a **model** from the header menu (when your admin configured
   models). Open a **provider** (for example Gemini or SpaceXAI), then choose the
   model in the submenu.
3. Admins can use the **star** icon (left of the title area) to mark the selected
   model as the workspace default — the star hides once that model is already
   default. Use the **plus** icon anytime to open Settings and add or configure
   models.
4. Type a message in the composer and press **Enter** to send (**Shift+Enter**
   for a new line).
5. Read Alice's reply on the left; your messages appear on the right.

Use **New Chat** to start a fresh conversation. Open the history sidebar to
switch, **rename**, or delete past threads. When a conversation is open, the
header breadcrumb shows **Dashboard → Chat →** that chat’s title.

---

## Header drawer

On any dashboard page (except `/chat`):

1. Select the **Alice** control in the header (between notifications and your
   profile).
2. The same chat UI opens in a right-hand drawer.
3. Continue the conversation without leaving your current page.

---

## What Alice can help with

Examples:

- List or summarize **projects**, **sprints**, and **work items**
- **Create** projects, sprints, and work items through guided prompts
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
- [User testing guide](./user-test-guide.md)
- [Create a work item](../work-items/create-work-item.md)
