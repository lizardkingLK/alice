# Project Work-Item Types & Hierarchy

Configure project-level work-item types and map Jira issue hierarchies during import in ALICE.

**Audience:** Managers and admins

---

## Overview

In ALICE, projects can configure which work-item types are permitted. This ensures that teams only use work-item types relevant to their specific project methodology, while keeping system-wide reporting and filtering unified.

### Standard System Hierarchy

The fixed standard ALICE work-item hierarchy follows these rules:

```text
Epic
 └── Story
      └── Task
           └── Issue
```

- **Epic**: Top-level strategic initiative.
- **Story**: User story or feature deliverable under an Epic.
- **Task**: Standard execution unit under a Story.
- **Issue**: Leaf work-item or bug under a Task. Issues cannot have subtasks.
- **Feature**: An optional high-level product capability that can be enabled per project.

> [!NOTE]
> Arbitrary hierarchy customization is **strictly restricted** to Jira import configuration. Project creation and editing only configure which types are active in the project.

---

## 1. Project Creation Configuration

When creating a new project as an administrator:

1. Navigate to **Projects** (`/projects`) and select **+ New Project**.
2. In **Step 1: Basic Details**, scroll to **Allowed Work-Item Types**.
3. Select any combination of work-item types from the canonical set:
   - `Epic`
   - `Feature`
   - `Story`
   - `Task`
   - `Issue`
4. **Validation**: At least one work-item type must be selected to proceed.
5. Submit the form to save the project. The selected types are stored in the project's workflow configuration.

---

## 2. Create & Edit Work-Item Form Scoping

When creating or editing work items:

- The **Type** dropdown in both the **Create Work-Item** and **Edit Work-Item** forms only displays the types allowed for the active project.
- If a project only has `Epic`, `Story`, `Task`, and `Issue` enabled, `Feature` will not appear in the dropdown.
- **Backend Validation**: ALICE backend APIs enforce this restriction. Attempting to create or update an item with a disallowed type returns an HTTP 400 error.
- **Global Filters**: Unrelated dropdowns (such as the Backlog filter dialog, Work-Item Registry filters, and Calendar filters) continue to list all canonical types across all projects.

---

## 3. Mandatory Type Behavior & Fallback to Issue

In ALICE, work items have a **mandatory** type field in the database.

When an administrator or project manager removes an active type from a project:

1. **Automatic Fallback**: Any existing work items in that project with the removed type are automatically reassigned to **`Issue`** (the leaf type).
2. **Hierarchy Pruning**: Since `Issue` cannot have subtasks, any children of the migrated items have their parent link cleared (`parent_id = null`).
3. **Invalid Link Cleanup**: Any parent-child relationship that no longer conforms to the project's active hierarchy is unlinked to avoid orphan or cycle errors.

---

## 4. Restoring Removed Types in Project Settings

Managers and Admins can update allowed work-item types at any time:

1. Open the project workspace and select the **Settings** tab (`/projects/[id]?tab=settings`).
2. In the **Allowed Work-Item Types** card:
   - Check or uncheck permitted types.
   - If removing a type that currently has work items, a warning alert explains that affected items will fall back to `Issue`.
3. Select **Save Settings**.
4. **Restoring a Type**:
   - Re-enabling a previously removed type allows it to be used for new work items immediately.
   - **Important**: Restoring a type does **not** retroactively convert items that previously fell back to `Issue` back to their old type.

---

## 5. Jira Import & Hierarchy Mapping

When importing issues from Jira into ALICE:

1. Open the project's **Integrations** tab and locate the **Jira Cloud** card.
2. Select **Jira Import & Hierarchy Mapping** to scan issue types from the linked Jira project.
3. **Configure Type Handling**:
   - **Map to ALICE type**: Map each Jira issue type (e.g., Jira `Story` → ALICE `Story`).
   - **Ignore (Skip)**: Completely skip issues of this type during import. Children of ignored issues will be imported with `parent_id = null`.
   - **Drop type (Fallback to Issue)**: Import issues of this type as an ALICE `Issue`.
4. **Configure ALICE Target Hierarchy**:
   - Customize the hierarchy order (e.g., `Epic → Feature → Story → Task → Issue`).
   - Use the **Up** and **Down** arrow buttons to adjust level ordering.
   - Add or remove levels as needed.
5. Select **Start Import**:
   - Issues are imported with their mapped types.
   - Parent-child links are established conforming strictly to the configured target hierarchy.
   - The custom hierarchy is saved in the project configuration, and an indicator badge in **Settings** confirms custom hierarchy is active.

---

## Related Documentation

- [User Testing Guide](./work-item-types-testing.md)
- [Project Settings](./project-settings.md)
- [Create a Project](./create-project.md)
- [Project Integrations](./project-integrations.md)
