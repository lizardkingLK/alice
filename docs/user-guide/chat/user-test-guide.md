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

### File 3: `test-work-items-hierarchy.csv`

```csv
Issue key,Type,Title,Parent,Priority,StoryPoints,Description,Department
CORE-1,Epic,Core Platform Architecture,,highest,,Core infrastructure overhaul,Platform
CORE-2,Feature,Authentication Service,CORE-1,high,5,NextAuth and JWT refresh pipeline,Security
CORE-3,Story,Login Endpoint,CORE-2,high,3,User login API route and session minting,Security
CORE-4,Task,Write Unit Tests for Login,CORE-3,medium,2,Vitest test cases covering all error paths,Security
```

### File 4: `test-work-items-outline.txt`

```text
- [Epic] Mobile App Release (Key: MOB-1, Priority: High)
  - [Feature] Push Notifications (Key: MOB-2)
    - [Story] FCM Integration (Key: MOB-3, Points: 5): Set up Firebase Cloud Messaging pipeline
      - [Task] Unit Testing (Points: 2): Write tests for payload deserialization
```

### File 5: `test-invalid-hierarchy.json` (Atomic Failure Simulation)

```json
{
  "items": [
    {
      "temporaryIdentifier": "item-epic",
      "title": "Alpha Platform Overhaul",
      "type": "epic"
    },
    {
      "temporaryIdentifier": "item-issue",
      "title": "Critical Security Vulnerability",
      "type": "issue",
      "parentReference": "item-epic"
    },
    {
      "temporaryIdentifier": "item-invalid-child",
      "title": "Subtask Under Issue",
      "type": "task",
      "parentReference": "item-issue",
      "description": "Invalid: Issue cannot have child tasks!"
    }
  ]
}
```

### File 6: `test-work-items-updated.json` (Backlog Update Simulation)

```json
{
  "items": [
    {
      "temporaryIdentifier": "item-1",
      "title": "Implement User Notification Center",
      "type": "story",
      "priority": "highest",
      "description": "UPDATED: Real-time notifications enabled.",
      "storyPoints": 8
    },
    {
      "temporaryIdentifier": "item-2",
      "title": "Fix Profile Picture Upload Bug",
      "type": "bug",
      "priority": "highest",
      "description": "UPDATED: Bug hotfixed in staging.",
      "storyPoints": 3
    },
    {
      "temporaryIdentifier": "item-4-new",
      "title": "Add Webhook Dispatcher",
      "type": "story",
      "priority": "high",
      "description": "NEW: Webhook integrations.",
      "storyPoints": 5
    }
  ]
}
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

### 6. Multi-format parsing (CSV, Outlines, Markdown, YAML)

1. Attach `test-work-items-hierarchy.csv` and ask:
   > _"Import the work items from this CSV into project [Project Key]."_
   - Alice extracts the multi-tier hierarchy (`CORE-1` &rarr; `CORE-2` &rarr; `CORE-3` &rarr; `CORE-4`) and custom columns (`Department`).
2. Attach `test-work-items-outline.txt` and ask:
   > _"Parse this outline and import into project [Project Key]."_
   - Alice creates the items preserving tree depth from indentation and explicit types/points.
3. Attach an image (`.png`, `.jpg`, `.webp`) to verify clean rendering with the `IMAGE` badge.

---

### 7. Attachment signed URL auto-refresh

1. Attach any file and send a message.
2. If you return to a conversation after the signed URL's 1-hour expiration period, click the attachment chip.
3. The attachment link automatically requests fresh signed URLs behind the scenes, ensuring the file opens or downloads without `Invalid token` errors.

---

### 8. Atomic import validation & user choice

1. Attach `test-invalid-hierarchy.json` (which contains an `Issue` attempting to have a child `Task`).
2. Ask Alice:
   > _"Import work items from this file into project [Project Key]."_
3. Alice validates the hierarchy **before** touching the database:
   - Zero items are inserted.
   - Zero executed action cards are shown.
   - Alice explains that Issues/Bugs are leaf items and cannot have children.
   - Alice asks whether you want to:
     1. Re-parse after correcting the file, or
     2. Proceed with importing only the valid items (skipping the invalid hierarchy).
   - Alice strictly pauses and waits for your choice.
4. Reply:
   > _"Proceed with option 2."_
   - Alice now imports only the valid items (`Alpha Platform Overhaul` and `Critical Security Vulnerability`), skips the invalid task, and summarizes the result.

---

### 9. Backlog synchronization on file re-upload

1. Import `test-work-items.json` into your project.
2. Attach `test-work-items-updated.json` and ask:
   > _"Update the work items from this file in project [Project Key]. Also remove omitted items."_
3. Alice synchronizes the backlog:
   - Existing items are updated in place with their new priorities and descriptions.
   - Parent-child hierarchy shifts are applied directly.
   - New items are created.
   - Omitted items are archived.
   - Executed action cards show `Work Item Updated: ...` and `Work Item Created: ...`.
   - No duplicate work items are created.

---

### 10. Scope guardrails & conversation persistence

1. Ask Alice an out-of-scope question:
   > _"Write an essay about agile development history."_
   - Alice politely declines, clarifying its scope is project and sprint management in ALICE.
2. Refresh your browser (`F5`).
3. Re-select the conversation in the left history sidebar.
   - Confirm that previous messages, attachment chips with auto-refreshing links, and action cards reload correctly.

---

## Related

- [Alice (AI chat)](./README.md)
- [Use the AI assistant](./use-ai-assistant.md)
