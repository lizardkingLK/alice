# User Testing Guide: Alice Chat & Document Attachment Enhancement

This guide provides step-by-step instructions for testing the enhanced Alice conversational AI assistant, including document upload sessions, file parsing, duplicate checking, batch work item import, and scope guardrails.

---

## 1. Prerequisites

1. **API Backend Server** running on `http://localhost:5000`:
   ```powershell
   pnpm --filter api dev
   ```
2. **Web Frontend Server** running on `http://localhost:3000`:
   ```powershell
   pnpm --filter web dev
   ```
3. An active user account with access to at least one project in Alice.
4. Open your browser to `http://localhost:3000/chat`.

---

## 2. Sample Test Files

Create two test files on your machine to test the document upload and parsing workflows:

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

## 3. Test Cases & Step-by-Step Instructions

### Test Case 1: Direct-to-Storage Attachment Upload Flow

**Goal**: Verify that files upload directly to Supabase Storage via signed upload URLs, avoiding server payload limits.

1. Open DevTools in your browser (`F12` or `Ctrl+Shift+I`) and switch to the **Network** tab.
2. In `/chat`, click the **Paperclip (📎)** icon next to the chat input.
3. Select `test-work-items.json`.
4. **Inspect the UI**:
   - An attachment tile appears above the input composer.
   - Shows a loading spinner transitioning to ready state.
   - Shows the file name `test-work-items.json`, human-readable size (e.g. `650 B`), and a purple `JSON` badge.
   - A delete `×` button is visible.
5. **Inspect the Network Tab**:
   - **Step A**: `POST /api/v1/chat/attachments/upload-session` returns status `200` with:
     ```json
     {
       "upload": {
         "bucket": "alice_storage_chat_attachments",
         "signedUrl": "https://...",
         "token": "...",
         "path": "chat-attachments/<userId>/<timestamp>-test_work_items.json"
       }
     }
     ```
   - **Step B**: Direct upload to the Supabase Storage signed URL (`uploadToSignedUrl`).
   - **Step C**: `POST /api/v1/chat/attachments/finalize` returns status `200` with the finalized `attachment` record.

---

### Test Case 2: Soft-Delete & Archive Attachment

**Goal**: Verify that deleting an attachment soft-deletes the record in the database and cleans up storage.

1. Upload a test file (e.g., `test-work-items.csv`).
2. Before sending the message, click the **`×`** button on the attachment tile.
3. **Expected Behavior**:
   - The tile is removed from the composer immediately.
   - A `DELETE /api/v1/chat/attachments/:id` request is sent in the Network tab.
   - Database row `status` is updated to `'archived'`.
   - File is removed from the Supabase Storage bucket.

---

### Test Case 3: Document Parsing via Alice (`parse_work_item_attachment`)

**Goal**: Verify that Alice automatically detects attached documents, fetches them from storage, and parses the structured work items.

1. Attach `test-work-items.json` via the paperclip icon.
2. Type the message:
   > *"Please inspect and parse the attached file, and tell me what work items are in it."*
3. Press **Enter** or click **Send**.
4. **Expected Behavior**:
   - Alice executes the `parse_work_item_attachment` tool.
   - Alice presents a clean summary of the work items found in the file:
     - `Implement User Notification Center` (Story, High, 5 pts)
     - `Fix Profile Picture Upload Bug` (Bug, Medium, 2 pts)
     - `Database Query Optimization` (Task, Low, 3 pts)
   - The uploaded file tile remains visible under your sent message.

---

### Test Case 4: Duplicate Checking (`check_work_item_duplicates`)

**Goal**: Verify that Alice compares parsed items against existing project work items before importing.

1. In the same chat conversation, type:
   > *"Check if any of these items already exist in project [Your Project Key or Name]."*
2. **Expected Behavior**:
   - Alice executes `check_work_item_duplicates`.
   - Alice returns a clear breakdown:
     - Total items evaluated.
     - Count of **New** items (safe to create).
     - Count of **Exact duplicates** or **Potential duplicates** (with matching reasons).
   - Alice recommends appropriate actions (e.g., skip duplicates or import new items).

---

### Test Case 5: Batch Work Item Import (`batch_import_work_items`)

**Goal**: Verify that Alice creates work items in bulk from the parsed document.

1. In the chat conversation, type:
   > *"Go ahead and import the new items into project [Your Project Key or Name]."*
2. **Expected Behavior**:
   - Alice executes `batch_import_work_items`.
   - Below Alice's reply, an **Executed Action Card** appears listing the newly created work items.
   - Click one of the created work item links in the action card:
     - Navigates to `/work-items/[id]`.
     - Confirms that title, description, priority, type, and story points match the original file.
3. Open `/work-items` or `/backlog` in another tab to confirm the items appear in the project list.

---

### Test Case 6: CSV and Image File Support

**Goal**: Verify that non-JSON attachments are classified and handled properly.

1. Upload `test-work-items.csv`:
   - Verify badge displays `CSV`.
   - Ask Alice: *"Parse this CSV file and list the items."*
   - Verify Alice reads the CSV columns and correctly maps Title, Type, Priority, and StoryPoints.
2. Upload an image (`.png`, `.jpg`, or `.webp`):
   - Verify badge displays `IMAGE`.
   - Ask Alice a question about the project.
   - Verify attachment displays properly without breaking chat flow.

---

### Test Case 7: Project Scope Guardrails

**Goal**: Verify that Alice strictly adheres to the ALICE system scope and politely declines out-of-scope requests.

1. Ask Alice:
   > *"Can you write an essay comparing Agile and Waterfall?"*
2. **Expected Behavior**:
   - Alice politely declines:
     > *"I'm sorry, but my scope is limited to assisting with project and sprint management in Alice (such as listing projects, creating sprints, or managing work items)..."*
3. Ask Alice:
   > *"List all projects in Alice."*
4. **Expected Behavior**:
   - Alice successfully executes `list_projects` and displays your workspace projects.

---

### Test Case 8: Multi-Turn Conversation & History Reload

**Goal**: Verify conversation persistence and attachment tile reloading.

1. Refresh the page (`F5` or `Ctrl+R`).
2. Select the conversation from the left history sidebar.
3. **Expected Behavior**:
   - Full message history reloads.
   - All past attachment tiles render above messages with valid signed download links.
   - Action cards render with working navigation links.
