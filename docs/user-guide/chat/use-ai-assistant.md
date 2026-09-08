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

Use **New Chat** to start a fresh conversation. Open the history sidebar to switch
or delete past threads.

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
- **Attach and inspect documents**: Click the paperclip icon (📎) to attach JSON, CSV, text, or image files
- **Parse attached files**: Ask Alice to extract work item definitions, story points, and priorities directly from your files
- **Check duplicates**: Ask Alice to check if items in your attached document already exist in the project
- **Batch import**: Have Alice create all new items in bulk and link parent/child tasks automatically
- Answer questions about projects and sprints you can already access

Alice confirms intent in conversation before making changes. Successful actions
show interactive cards with links to the created records.

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
