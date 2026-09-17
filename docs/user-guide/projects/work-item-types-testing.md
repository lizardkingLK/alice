# User Testing Guide: Project Work-Item Types & Jira Hierarchy Mapping

Step-by-step instructions for testing **Project-Level Work-Item Types**, **Create/Edit Form Scoping**, **Fallback to Issue**, **Restoring Types**, and **Jira Import Hierarchy Mapping** on the running system.

**Audience:** Managers, Administrators, QA Engineers, and Developers

---

## Prerequisites & Environment Setup

1. **API Backend Server** running on `http://localhost:5000`:
   ```bash
   corepack pnpm --filter api dev
   ```
2. **Web Frontend Server** running on `http://localhost:3000`:
   ```bash
   corepack pnpm --filter web dev
   ```
3. **User Account**:
   - Sign in as an **Admin** or **Manager** at `http://localhost:3000`.

---

## Test Scenarios

### 1. Project Creation with Configured Types

Verify that allowed work-item types can be selected during project creation:

1. Navigate to **Projects** (`/projects`) and click **+ New Project**.
2. In **Step 1: Basic Details**:
   - Fill in Project Name (e.g., `Alpha Project`) and Key (e.g., `ALP`).
   - Scroll down to the **Allowed Work-Item Types** section.
   - Verify 5 checkboxes are present: `Epic`, `Feature`, `Story`, `Task`, `Issue`.
   - Verify there is **no** active hierarchy preview box in Step 1.
3. Deselect all 5 types and click **Next**:
   - Verify validation error: _"At least one work-item type must be selected."_
4. Select `Epic`, `Story`, `Task`, `Issue` (leave `Feature` unchecked).
5. Complete the wizard and submit **Create Project**.

---

### 2. Create & Edit Work-Item Form Scoping

Verify that forms show only permitted types for the selected project:

1. Navigate to **Work Items** -> click **+ New Work Item**.
2. Select your project (`Alpha Project`).
3. Open the **Type** dropdown:
   - Verify only `Epic`, `Story`, `Task`, and `Issue` appear.
   - Verify `Feature` is not present.
4. Create an `Epic` titled `Core Initiative`.
5. Create a `Story` with parent set to `Core Initiative`.
6. Open the newly created `Story` in the edit dialog:
   - Verify the edit form's Type dropdown is similarly restricted to the project's configured types.

---

### 3. Global Filters Remain Unrestricted

Verify that global filters continue listing all canonical types:

1. Open **Work Items** (registry table).
2. Click **Filter** and view the Type filter options:
   - Verify all 5 types (`Epic`, `Feature`, `Story`, `Task`, `Issue`) are available.
3. Open **Calendar** and view the Calendar filter options:
   - Verify all 5 types are present.

---

### 4. Project Settings: Type Removal & Fallback to Issue

Verify that deselecting a type migrates existing items to `Issue` and unlinks invalid parents:

1. Open `Alpha Project` -> click the **Settings** tab.
2. In **Allowed Work-Item Types**:
   - Deselect `Story`.
   - Verify the warning banner appears: _"Removing Story will cause all existing items of those types in this project to fall back to Issue..."_
3. Click **Save Settings**:
   - Verify success notification.
4. Navigate to the project's **Work Items** or **Backlog**:
   - Verify the item that was previously a `Story` now has type **`Issue`**.
   - Verify its child relationships have been pruned appropriately (child parent links set to `null`).

---

### 5. Project Settings: Restoring Removed Types

Verify that re-enabling a previously removed type allows it for future items without reverting migrated items:

1. Return to `Alpha Project` -> **Settings** tab.
2. Check `Story` and check `Feature`.
3. Click **Save Settings**.
4. Open **+ New Work Item**:
   - Verify both `Story` and `Feature` are selectable.
5. Inspect the work item that was migrated to `Issue`:
   - Verify it remains an `Issue` and was not automatically changed back.

---

### 6. Jira Import & Custom Hierarchy Configuration

Verify Jira import issue type mapping and hierarchy customization:

1. Open `Alpha Project` -> **Integrations** tab.
2. In the **Jira Cloud** card, open **Jira Import & Hierarchy Mapping**.
3. Verify the dialog opens with expanded width (`max-w-4xl` / `max-w-5xl`), hidden scrollbar, and fixed footer buttons.
4. In **1. Issue Type Mappings**:
   - Verify each mapping row displays Jira type and ALICE mapping options on a single row without wrapping.
   - Set one type to **Map to ALICE type**.
   - Set one type to **Ignore (Skip)**.
   - Set one type to **Drop type (Fallback to Issue)**.
5. In **2. ALICE Target Hierarchy**:
   - Reorder levels using **Up** / **Down** buttons (e.g. `Epic → Feature → Story → Task → Issue`).
6. Click **Start Import**:
   - Verify issues are imported with configured types.
   - Verify ignored issues are skipped.
   - Verify dropped issues are created as `Issue`.
   - Verify parent links conform strictly to the custom hierarchy.
7. Return to **Settings** tab:
   - Verify the informational badge indicates: _"Jira Import Custom Hierarchy Active"_.

---

## Summary Checklist

| #   | Test Case                       | Expected Result                                                                    | Pass/Fail |
| --- | ------------------------------- | ---------------------------------------------------------------------------------- | :-------: |
| 1   | Project creation type selection | Checkboxes for all 5 types; at least one required                                  |    [ ]    |
| 2   | Create/Edit form type scoping   | Disallowed types hidden from dropdown                                              |    [ ]    |
| 3   | Global filters                  | All 5 types remain available globally                                              |    [ ]    |
| 4   | Remove type in Settings         | Warning alert shown; affected items fall back to `Issue`; invalid parents unlinked |    [ ]    |
| 5   | Restore type in Settings        | Type available for new items; previously migrated items stay as `Issue`            |    [ ]    |
| 6   | Jira import layout & width      | Wide dialog (`max-w-4xl`), no scrollbar, fixed bottom buttons                      |    [ ]    |
| 7   | Jira import type mappings       | `Map`, `Ignore`, `Drop` actions executed cleanly                                   |    [ ]    |
| 8   | Jira import hierarchy           | Hierarchy reordered and saved in `workflow_config.hierarchy`                       |    [ ]    |
