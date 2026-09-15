# User Testing Guide: Project Details & Dynamic Fields

Step-by-step instructions for testing the **Project Details workspace**, **sidebar navigation**, **banner isolation**, **JSON Schema dynamic fields**, **starter templates catalog**, **Alice AI generation**, **safe template removal**, and **work-item integration** on the running system.

**Audience:** Managers, Administrators, QA Engineers, and Developers

---

## Prerequisites & Environment Setup

1. **API Backend Server** running on `http://localhost:5000`:
   ```powershell
   pnpm --filter api dev
   ```
2. **Web Frontend Server** running on `http://localhost:3000`:
   ```powershell
   pnpm --filter web dev
   ```
3. **Database**: PostgreSQL / Supabase running with migrations applied (`pnpm --filter db prisma:migrate:dev`).
4. **User Roles**:
   - One user account with **Manager** or **Admin** role (to test dynamic field editing, template loading, and saving).
   - One user account with **Member** role (to test view-only permissions and optional work-item input).
5. Open your browser to `http://localhost:3000` and sign in.

---

## Test Scenarios

### 1. Sidebar Navigation & URL Synchronization

Verify that the Project Details layout uses vertical sidebar navigation and synchronizes tab state with the URL query parameter without full-page reloads:

1. Navigate to **Projects** (`/projects`) from the main sidebar.
2. Click any project (e.g. `Mobile App` / `MOB`) to open `/projects/[id]`.
3. Verify the left sidebar navigation displays the following tabs:
   - **Details** (Icon: Info)
   - **Members** (Icon: Users)
   - **Teams** (Icon: Network)
   - **Work Items** (Icon: ClipboardPenLine)
   - **Sprints** (Icon: Timer — visible only to managers and admins)
   - **Integrations** (Icon: Plug)
   - **Fields** (Icon: SlidersHorizontal)
4. Click on **Fields**:
   - Verify the URL updates to `/projects/[id]?tab=fields` without reloading the page.
   - Verify the **Fields** tab button highlights with active styling (`bg-muted font-medium`).
5. Click on **Work Items**:
   - Verify the URL updates to `/projects/[id]?tab=work-items`.
6. Click the browser's **Back** button:
   - Verify the view smoothly transitions back to the **Fields** tab without layout shifts.

---

### 2. Project Summary Banner Isolation

Verify that the project summary banner is strictly confined to the **Details** tab, freeing up canvas space for data-dense views:

1. Click the **Details** tab in the sidebar (`/projects/[id]?tab=details` or `/projects/[id]`):
   - Verify that `ProjectSummaryBanner` renders at the top of the canvas, showing:
     - Project name, key badge, owner, timeline dates, and branding/cover image.
     - Clickable metric cards (Members, Teams, Work Items, Sprints, Integrations, Fields).
2. Click the **Fields** tab:
   - Verify that `ProjectSummaryBanner` is **completely hidden**.
   - Verify the **Dynamic Fields** workspace mounts directly at the top of the canvas.
3. Click **Work Items**, **Teams**, and **Members**:
   - Verify the summary banner remains hidden on all of these views.

---

### 3. Dynamic Fields Workspace & Initial Zero-Selection Rule

Verify that unconfigured projects initialize with zero pre-selected templates, giving managers a clean slate:

1. Navigate to the **Fields** tab (`/projects/[id]?tab=fields`) on a project that does not yet have dynamic fields configured.
2. Verify the workspace displays:
   - Header title: **Dynamic Fields** with description.
   - Action controls: **Load Template**, **Beautify**, **Validate**, **Generate with Alice**, and **Save Changes**.
   - Empty state banner: _"No dynamic fields configured yet. Click Load Template to start from a standard template, or write custom JSON schema below."_
   - JSON Schema editor pre-populated with empty Draft 2020-12 schema (`properties: {}`).
3. Click **Load Template**:
   - The **Load Field Templates** dialog opens.
   - Verify the selection counter shows: **`0 selected • 8 available templates`**.
   - Verify that **zero (0) template cards are pre-selected**.
   - Verify the **Add Selected** button is disabled.

---

### 4. Starter Templates Catalog & Merging

Verify that standard agile field templates can be selected and merged into the schema:

1. In the **Load Field Templates** dialog, click to select:
   - **MoSCoW Rating** (Agile Prioritization — enum: Must, Should, Could, Won't)
   - **Acceptance Criteria** (Requirements & QA — multiline text)
   - **Include in Release Notes** (Release Management — boolean flag)
2. Verify the counter updates to **`3 selected`**, and **Add Selected (3)** is enabled.
3. Click **Add Selected (3)**:
   - The dialog closes.
   - A green feedback notification displays: _"Added 3 template fields. Review and save when ready."_
   - Three **Configured Field Preview Cards** appear above the editor:
     - **MoSCoW Rating** (string, options badges: Must, Should, Could, Won't)
     - **Acceptance Criteria** (string, multiline format badge)
     - **Include in Release Notes** (boolean badge, default: false)
   - The JSON editor displays the formatted schema with 2-space indentation.

---

### 5. Schema Validation & Line Highlighting

Verify that syntax and structure errors are caught in real-time and highlighted in the editor gutter:

1. In the JSON editor, introduce a syntax error (e.g. remove a quotation mark or comma on line 5).
2. Click **Validate**:
   - The **ProjectFieldsErrorDialog** opens with title **"JSON Syntax Error"**.
   - Description explains: _"The schema contains invalid JSON syntax. Please correct the syntax before proceeding."_
   - The error trace details the exact parse issue.
3. Click **OK** to close the error dialog:
   - Observe the line numbers gutter on the left: the offending line number is highlighted in **red** (`bg-destructive/20 text-destructive`).
4. Click **Beautify**:
   - An error dialog appears preventing beautification of invalid JSON.
5. Fix the syntax error in the editor and click **Validate**:
   - An emerald green banner appears: _"Schema is syntactically valid (3 dynamic fields defined). Ready to save."_
   - The banner auto-dismisses after 4.5 seconds.
6. Click **Beautify**:
   - The JSON is neatly re-formatted with 2-space indentation.

---

### 6. Alice AI Assistant Natural Language Schema Generation

Verify that managers can describe custom fields in plain English and let Alice generate the schema:

1. Click **Generate with Alice** on the Fields tab.
2. The **Generate Fields with Alice** dialog opens.
3. Notice the starter suggestion chips:
   - `+ MoSCoW rating and acceptance criteria`
   - `+ Security classification and compliance tier`
   - `+ Customer impact score and release notes flag`
   - `+ Defect severity, reproduction steps, and browser`
4. Click `+ Security classification and compliance tier`:
   - The prompt textarea auto-populates.
5. Click **Generate Schema**:
   - A loading spinner displays while Alice communicates with the Gemini chat backend.
   - When finished, the generated schema is merged into the editor and preview cards update to show **Security Classification** and **Compliance Tier**.

---

### 7. Saving Configuration & Optimistic Concurrency

Verify that saving persists the JSON Schema to PostgreSQL via Prisma and enforces optimistic concurrency:

1. Click **Save Changes**.
2. Observe the button state: changes to _"Saving…"_ with a spinner.
3. Upon success, a confirmation banner confirms: _"Changes saved to project."_
4. Open your browser DevTools **Network** tab:
   - Verify `PUT /api/projects/[id]` was issued with `attributes_config` and `expectedUpdatedAt`.
5. Refresh the browser (`F5`):
   - Verify the configured fields and preview cards persist cleanly.

---

### 8. Safe Template Removal Warning Modal

Verify that removing a template that already has work-item values assigned requires interactive confirmation:

1. Switch to **Work Items** tab and open or create a work item in this project.
2. In the work-item details sidebar under **Additional Fields**, set **MoSCoW Rating** to **"Must"**.
3. Return to the **Fields** tab (`/projects/[id]?tab=fields`).
4. Click **Load Template**:
   - Notice that **MoSCoW Rating** displays an **"Added"** badge.
5. Click the **MoSCoW Rating** card to uncheck it:
   - An interactive confirmation popup (**`ProjectFieldsErrorDialog`**) appears immediately:
     - Title: `Remove Field Template: MoSCoW Rating`
     - Description: _"Work item values will be removed under this template. Existing values assigned in work items for this field will no longer be available once this template is unselected and saved."_
     - Affected work items list: shows your work item's key, title, and assigned value (`Must`).
     - Buttons: `Cancel` and `OK`.
6. Click **Cancel**:
   - The template remains selected and checked.
7. Click **Clear Selection**:
   - A consolidated warning popup appears listing all affected templates and work items.
8. Click **OK**:
   - The templates are unselected.
   - Click **Save Changes** to commit the removal.

---

### 9. Work-Item Integration & Inline Editing

Verify that configured dynamic fields render dynamically on work items with customized inline editors:

1. Open any work item in the project (`/work-items/[id]`).
2. In the right sidebar, expand the **Additional Fields** section:
   - Verify all fields defined in the project's schema appear:
     - **MoSCoW Rating**: Dropdown selector (`Select`) with options `Must`, `Should`, `Could`, `Won't`, and a `None / Clear` option.
     - **Acceptance Criteria**: Multiline expandable `Textarea` with **Save** (`Check`) and **Cancel** (`X`) controls.
     - **Include in Release Notes**: Instant `Switch` toggle with `Yes`/`No` status text.
3. Test editing each field:
   - Select `Must` for MoSCoW Rating: value updates immediately.
   - Toggle the Release Notes switch to `Yes`: updates immediately.
   - Type acceptance criteria text and click **Save**: criteria persists.
4. Refresh the page:
   - Verify all dynamic field values remain saved in TipTap ProseMirror document attributes (`doc.attrs.dynamicFields`).

---

### 10. Non-Validation Invariant & Graceful Degradation

Verify that dynamic fields never become mandatory validation rules or impede core workflow operations:

1. Click **Create Work Item** (`+ New Item`):
   - Fill in only the required Title (e.g. `Test Invariant Item`).
   - Leave **all** dynamic fields completely empty.
   - Click **Create**:
     - Verify creation succeeds immediately without validation warnings.
2. On the created work item:
   - Change the status from `ToDo` to `InProgress` to `Done`.
   - Verify status transitions succeed without requiring dynamic fields to be filled.
3. Test graceful degradation:
   - Even if corrupted or malformed schema properties exist in the database, the work-item view catches errors via `DynamicFieldsErrorBoundary` and displays `DynamicFieldsErrorNotice` without crashing the parent view.

---

### 11. Role-Based Access Control (RBAC) Verification

Verify role permissions between Managers/Admins and standard Members:

| Verification Step               | Logged in as Manager / Admin                                              | Logged in as Member                                                       |
| :------------------------------ | :------------------------------------------------------------------------ | :------------------------------------------------------------------------ |
| **Sidebar Sprints Tab**         | Visible                                                                   | **Hidden**                                                                |
| **Fields Tab Access**           | Full edit & configuration                                                 | **View-only** access                                                      |
| **Banner Notice on Fields**     | None (Full editing controls)                                              | Amber warning banner with **Lock** icon: _"You have view-only access..."_ |
| **Action Buttons**              | `Load Template`, `Beautify`, `Save Changes`, `Generate with Alice` active | All edit buttons **disabled**                                             |
| **Work-Item Additional Fields** | Editable                                                                  | Editable (optional metadata input)                                        |

---

## Automated Verification with Vitest

To run the complete automated test suite on your local machine:

```powershell
cmd /c "pnpm --filter web exec vitest run tests/projects/project-details-sidebar-fields.test.tsx tests/projects/update-project-fields-action.test.ts tests/projects/generate-fields-alice-dialog.test.tsx tests/projects/project-fields-error-dialog.test.tsx tests/work-items/work-item-dynamic-fields.test.tsx tests/work-items/work-item-dynamic-fields-helpers.test.ts"
```

Expected result:

```text
Test Files  6 passed (6)
     Tests  61 passed (61)
```
