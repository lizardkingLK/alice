# User testing guide

Step-by-step instructions for testing Alice AI chat document attachments, parsing, and batch imports.

**Audience:** All users

---

## Prerequisites

1. **API Backend Server** running on `http://localhost:5000`:
   ```powershell
   pnpm --filter api dev
   ```
2. **Web Frontend Server** running on `http://localhost:3000`:
   ```powershell
   pnpm --filter web dev
   ```
3. An active user account with access to at least one project in Alice.
4. Open your browser to `/chat` or open the Alice header drawer on any dashboard page.

---

## Sample test files

Create these sample files on your machine to test the document upload and parsing workflows:

### File 1: `test-work-items.json`

```json
{
  "items": [
    {
      "temporaryIdentifier": "item-1",
      "title": "Implement User Notification Center",
      "type": "story",
      "priority": "high",
      "description": "Create in-app notifications for assigned work items.",
      "storyPoints": 5
    },
    {
      "temporaryIdentifier": "item-2",
      "title": "Fix Profile Picture Upload Bug",
      "type": "bug",
      "priority": "medium",
      "description": "Resolve image compression issue during avatar upload.",
      "storyPoints": 2
    },
    {
      "temporaryIdentifier": "item-3",
      "title": "Database Query Optimization",
      "type": "task",
      "priority": "low",
      "description": "Add missing compound indexes on work_items table.",
      "storyPoints": 3
    }
  ]
}
```

### File 2: `test-work-items.csv`

```csv
Title,Type,Priority,StoryPoints,Description
Setup Redis Caching,task,medium,3,Cache frequent query results for sprint board
Fix Auth Token Expiry Bug,bug,high,2,Refresh tokens automatically before session expiry
Refactor Navigation Header,story,low,1,Modernize responsive navigation menu bar
```

---

## Test scenarios

### 1. Attachment upload flow

Verify that files upload directly to Supabase Storage via signed upload URLs:

1. Open DevTools in your browser (`F12` or `Ctrl+Shift+I`) and switch to the **Network** tab.
2. In `/chat`, click the **Paperclip (📎)** icon next to the chat input.
3. Select `test-work-items.json`.
4. Observe the UI:
   - An attachment tile appears above the input composer.
   - Shows file name `test-work-items.json`, size (e.g. `650 B`), and a purple `JSON` badge.
   - A delete `×` button is visible.
5. In the Network tab, verify:
   - `POST /api/v1/chat/attachments/upload-session` returns signed upload credentials.
   - Direct PUT/POST to Supabase Storage.
   - `POST /api/v1/chat/attachments/finalize` records the attachment.

---

### 2. Attachment deletion

1. Upload `test-work-items.csv`.
2. Before sending your prompt, click the **`×`** button on the attachment tile.
3. Verify the tile is removed and a `DELETE /api/v1/chat/attachments/:id` request is issued.

---

### 3. Document parsing via Alice

1. Attach `test-work-items.json` via the paperclip icon.
2. Type:
   > _"Please inspect and parse the attached file, and tell me what work items are in it."_
3. Send the message.
4. Alice runs `parse_work_item_attachment` and lists:
   - `Implement User Notification Center` (Story, High, 5 pts)
   - `Fix Profile Picture Upload Bug` (Bug, Medium, 2 pts)
   - `Database Query Optimization` (Task, Low, 3 pts)

---

### 4. Duplicate checking

1. In the same thread, ask Alice:
   > _"Check if any of these items already exist in project [Your Project Key or Name]."_
2. Alice invokes `check_work_item_duplicates` and summarizes:
   - Number of new items ready to import.
   - Any matching items found in the project.

---

### 5. Batch work item import

1. Ask Alice:
   > _"Go ahead and import the new items into project [Your Project Key or Name]."_
2. Alice executes `batch_import_work_items`.
3. An **Executed Action Card** appears below Alice's reply with clickable links to the newly created work items.
4. Click a created item link to verify its details on `/work-items/[id]`.

---

### 6. CSV and image files

1. Attach `test-work-items.csv` and ask Alice to parse it to test CSV tabular extraction.
2. Attach an image (`.png`, `.jpg`, `.webp`) and verify it renders cleanly with the `IMAGE` badge.

---

### 7. Scope guardrails

1. Ask Alice an out-of-scope question, such as:
   > _"Write an essay about project management theory."_
2. Alice politely declines, clarifying its scope is project and sprint management in ALICE.

---

### 8. Conversation persistence

1. Refresh your browser (`F5`).
2. Re-select the conversation in the left history sidebar.
3. Confirm that previous messages, attachment chips, and action cards reload correctly.

---

## Related

- [Alice (AI chat)](./README.md)
- [Use the AI assistant](./use-ai-assistant.md)
