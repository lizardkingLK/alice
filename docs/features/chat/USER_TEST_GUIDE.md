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

### File 5: `test-invalid-hierarchy.json` (Tests Atomic Validation)

```json
{
  "items": [
    {
      "temporaryIdentifier": "item-epic",
      "title": "Alpha Platform Overhaul",
      "type": "epic",
      "priority": "high"
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
      "description": "Invalid: Issues and Bugs are leaf items and cannot have child tasks!"
    }
  ]
}
```

### File 6: `test-work-items-updated.json` (Tests Backlog Sync & Hierarchy Re-linking)

```json
{
  "items": [
    {
      "temporaryIdentifier": "item-1",
      "title": "Implement User Notification Center",
      "type": "story",
      "priority": "highest",
      "description": "UPDATED: In-app real-time notifications with push support.",
      "storyPoints": 8
    },
    {
      "temporaryIdentifier": "item-2",
      "title": "Fix Profile Picture Upload Bug",
      "type": "bug",
      "priority": "highest",
      "description": "UPDATED: Resolved memory leak during sharp image resizing.",
      "storyPoints": 3
    },
    {
      "temporaryIdentifier": "item-4-new",
      "title": "Add Webhook Dispatcher",
      "type": "story",
      "priority": "high",
      "description": "NEW: Dispatch webhooks on work item state transitions.",
      "storyPoints": 5
    }
  ]
}
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
   > _"Please inspect and parse the attached file, and tell me what work items are in it."_
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
   > _"Check if any of these items already exist in project [Your Project Key or Name]."_
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
   > _"Go ahead and import the new items into project [Your Project Key or Name]."_
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
   - Ask Alice: _"Parse this CSV file and list the items."_
   - Verify Alice reads the CSV columns and correctly maps Title, Type, Priority, and StoryPoints.
2. Upload an image (`.png`, `.jpg`, or `.webp`):
   - Verify badge displays `IMAGE`.
   - Ask Alice a question about the project.
   - Verify attachment displays properly without breaking chat flow.

---

### Test Case 7: Project Scope Guardrails

**Goal**: Verify that Alice strictly adheres to the ALICE system scope and politely declines out-of-scope requests.

1. Ask Alice:
   > _"Can you write an essay comparing Agile and Waterfall?"_
2. **Expected Behavior**:
   - Alice politely declines:
     > _"I'm sorry, but my scope is limited to assisting with project and sprint management in Alice (such as listing projects, creating sprints, or managing work items)..."_
3. Ask Alice:
   > _"List all projects in Alice."_
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

---

### Test Case 9: Expired Signed URL Auto-Refresh for Chat Attachments

**Goal**: Verify that when an attachment's 1-hour signed URL expires, clicking the attachment automatically refreshes the URL without error or re-upload.

#### Option A: Natural Expiration Test

1. Upload an attachment in any Alice chat conversation (e.g. `test-work-items.json`) and send the message.
2. Leave the tab open or return after 1 hour (when the original signed URL token expires).
3. Open DevTools (`F12` → **Network** tab).
4. Click on the attachment chip in the conversation thread.
5. **Expected Behavior**:
   - A `GET /api/v1/chat/attachments/<attachmentId>` request is fired.
   - The response status is `200` with fresh `previewUrl`, `downloadUrl`, and updated `expiresAt`.
   - The file opens/downloads successfully in a new tab without any Supabase `Invalid or expired token` error.

#### Option B: Fast Simulation via Database (No 1-hour wait needed)

1. Upload an attachment in chat and send the message.
2. Note the attachment or conversation.
3. Run a quick SQL query in Supabase / Postgres to simulate expiration:
   ```sql
   UPDATE "chat_attachments"
   SET "expires_at" = NOW() - INTERVAL '2 hours'
   WHERE "id" = (
     SELECT "id" FROM "chat_attachments"
     ORDER BY "created_at" DESC
     LIMIT 1
   );
   ```
4. In the browser, refresh the conversation or click the attachment chip.
5. **Expected Behavior**:
   - The attachment link auto-refreshes.
   - Check the DB: `expires_at` is updated to 1 hour in the future (`NOW() + INTERVAL '1 hour'`).
   - The file opens seamlessly without error.

---

### Test Case 10: Multi-Format Attachment Ingestion

**Goal**: Verify that Alice parses diverse document formats (CSV with hierarchy, Indented Outlines, Markdown tables, YAML) into structured work item trees.

#### Sub-case 10A: CSV with Hierarchy & Dynamic Columns

1. Attach `test-work-items-hierarchy.csv` via the paperclip icon.
2. Ask Alice:
   > _"Import the work items from this CSV into project [Project Key]."_
3. **Expected Behavior**:
   - Alice executes `parse_work_item_attachment` and preserves the 4-level parent links (`CORE-1` &rarr; `CORE-2` &rarr; `CORE-3` &rarr; `CORE-4`).
   - Dynamic columns (e.g. `Department`) are extracted into `dynamicFields`.
   - Executed action cards reflect the hierarchy with deep links to created items.

#### Sub-case 10B: Indented Text Outline

1. Attach `test-work-items-outline.txt`.
2. Ask Alice:
   > _"Inspect and import this outline into project [Project Key]."_
3. **Expected Behavior**:
   - Alice parses indentation levels into `Epic` &rarr; `Feature` &rarr; `Story` &rarr; `Task`.
   - Explicit bracketed tags (`[Epic]`, `[Feature]`) override default types.
   - Story points and priorities annotated in parentheses are extracted properly.

---

### Test Case 11: Atomic Pre-Validation & Interactive User Choice Protocol

**Goal**: Verify that when a file contains hierarchy violations, ZERO items are written to the database, ZERO action cards appear, and Alice strictly pauses for user confirmation before taking any action.

1. Attach `test-invalid-hierarchy.json` (contains an `Issue` with a child `Task`).
2. Ask Alice:
   > _"Import work items from this file into project [Project Key]."_
3. **Inspect the Behavior**:
   - Alice invokes `batch_import_work_items` with `skipInvalidHierarchy: false`.
   - The pre-validator detects that `Critical Security Vulnerability` (type `Issue`) has a child task (`Subtask Under Issue`).
   - **Database Check**: Run `SELECT count(*) FROM work_items WHERE project_id = '<projectId>';` — verify that **zero items were inserted**.
   - **UI Check**: Verify that **zero executed action cards** appear under Alice's reply.
   - **Alice's Prompt Response**:
     - Explains the exact hierarchy rule violation (_"Issue / Bug is a leaf item and cannot have child items"_).
     - Confirms that 0 items were created.
     - Presents the two standard choices:
       > 1. _Re-parse the file after you update and re-upload it, or_
       > 2. _Proceed with importing only the valid items (skipping the invalid hierarchy)?_
       >    _Let me know how you'd like to proceed._
     - **Critically**: Alice stops and does NOT automatically proceed with Option 2 without user permission.
4. **Test Choice Confirmation**:
   - Reply to Alice:
     > _"Proceed with option 2."_
   - **Expected Behavior**:
     - Alice now calls `batch_import_work_items` with `skipInvalidHierarchy: true`.
     - `Alpha Platform Overhaul` (Epic) and `Critical Security Vulnerability` (Issue) are created.
     - `Subtask Under Issue` is skipped and reported in the summary as pruned.
     - Executed action cards appear only for the 2 valid items.

---

### Test Case 12: Incremental Backlog Synchronization & Hierarchy Change Reporting

**Goal**: Verify that re-uploading an updated file (JSON, CSV, TSV, Markdown tables, text outlines, YAML) synchronizes field changes and hierarchy moves in-place without creating duplicate work items, and explicitly reports hierarchy changes in Alice's message.

1. First, import `test-work-items-hierarchy.csv` into your project (creates `CORE-1` Epic, `CORE-2` Feature, `CORE-3` Story, and `CORE-4` Task).
2. Create an updated file where the hierarchy is modified (e.g., `CORE-4` Task is moved directly under `CORE-2` Feature instead of `CORE-3` Story, and priority of `CORE-3` is changed to `highest`).
3. Attach the updated file and ask Alice:
   > _"Update the work items in project [Project Key] based on this updated file."_
4. **Expected Behavior**:
   - Alice runs duplicate/hierarchy analysis via `check_work_item_duplicates`.
   - **MANDATORY Conversational Hierarchy Reporting**:
     - Alice's message **explicitly states that the hierarchy was changed** based on the updated file changes.
     - Specifically lists each item whose parent was modified (e.g., `"- Write Unit Tests for Login hierarchy updated: parent changed to Authentication Service"`).
     - Alice never claims modified hierarchy items are "Exact duplicates (no change)".
   - **Database Check**:
     - The existing item record in `work_items` is updated in-place (`await prisma.work_items.update`).
     - `parent_id` is updated to point to the new parent.
     - No duplicate rows are created.
   - **Action Cards**:
     - Shows `Work Item Updated: ...` for modified items.

---

### Test Case 13: Work Item Deletion Disallowed via Chat

**Goal**: Verify that deleting work items is strictly prohibited via Alice chat, and that omitted items from updated files are preserved in the project backlog with an explicit user notice.

1. In the same project, edit the file to delete or omit one of the parent work items and its children.
2. Re-upload the file and ask Alice:
   > _"Update the work items from this file in project [Project Key]."_
3. **Expected Behavior**:
   - Alice processes the file and detects omitted existing project items.
   - **Strict No-Deletion Guardrail**:
     - Zero work items are deleted or archived in the database.
     - Alice explicitly includes a notice in her conversational response:
       > _"Note: Deletion of work items is not allowed via Alice chat. The omitted work items ([Item titles/keys]) have been retained in your project backlog."_
   - **Database Check**:
     - Run `SELECT id, title, record_status FROM work_items WHERE project_id = '<projectId>';`
     - Verify that all previously existing items remain `record_status = 'active'`.
   - Any valid items present in the file are updated or created as usual.

---

### Test Case 14: Network Resilience & Provider Retry Handling

**Goal**: Verify that transient network connection drops or fetch errors are caught gracefully, logged, retried up to 3 times with exponential backoff, and return clear user-facing messages rather than crashing with unhandled `fetch failed`.

1. If an intermittent network error or socket drop occurs during model communication:
   - The backend catches the error in `fetchChatProviderWithRetries`.
   - Logs diagnostics to `alice-chatbot-errors.log`.
   - Retries the fetch after 2s, 4s, etc.
   - If network remains down, returns a clean user-facing error message:
     > _"Alice AI service is temporarily unavailable due to a network connection issue (...). Please try again in a few moments."_
   - The chat conversation remains intact and healthy.
