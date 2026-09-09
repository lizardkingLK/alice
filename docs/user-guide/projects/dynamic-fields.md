# Project dynamic fields & sidebar

Configure project-aligned custom fields for work items using JSON Schema, navigate project workspaces via the sidebar, and use Alice Assistant for field generation.

**Audience:** All project members (editing requires manager or admin role)

---

## Overview

Each project in Alice supports **custom dynamic fields** that appear optionally on work items belonging to that project (for example, **MoSCoW Rating**, **Acceptance Criteria**, **Risk Level**, or **Target Release**).

The Project Details workspace uses a clean **sidebar navigation** to access workspace areas, and confines the project summary banner to the **Details** tab so other views enjoy maximum canvas area.

---

## Navigating with the Project Sidebar

When you open a project from **Projects** (`/projects/[id]`), the left sidebar provides direct access to all workspace sections:

- **Details**: Overview metrics, project dates, and the editable project banner.
- **Members**: Project membership roster and roles.
- **Teams**: Teams assigned to or working on this project.
- **Work Items**: The full-width work items table, backlog, and hierarchy view.
- **Integrations**: Connections to GitHub and Atlassian Jira Cloud.
- **Fields**: Configuration interface for project dynamic fields (managers and admins).

> [!TIP]
> The project banner appears **only on the Details tab**. Tabs such as Work Items and Fields utilize the full available height of the screen for maximum data visibility.

---

## Configuring Dynamic Fields

Managers and Administrators can define custom metadata fields on the **Fields** tab.

### Step 1: Open the Fields Tab

1. Navigate to **Projects** and select your project.
2. In the project sidebar, click **Fields**.

### Step 2: Configure the JSON Schema

Fields are defined using standard, extensible **JSON Schema**. You can edit the schema directly in the built-in editor:

```json
{
  "type": "object",
  "properties": {
    "moscowRating": {
      "type": "string",
      "title": "MoSCoW Rating",
      "enum": ["Must", "Should", "Could", "Won't"]
    },
    "acceptanceCriteria": {
      "type": "string",
      "title": "Acceptance Criteria"
    }
  }
}
```

Supported field types include:

- **Text**: Single-line text input (`type: "string"`).
- **Long text**: Multi-line textarea (`type: "string"`, format or x-component).
- **Single select**: Dropdown menu (`type: "string"`, `enum: [...]`).
- **Multi-select**: Multiple selectable tags (`type: "array"`, `items: { enum: [...] }`).
- **Number**: Numeric metrics or estimates (`type: "number"` or `"integer"`).
- **Checkbox**: Boolean toggles (`type: "boolean"`).
- **Date**: Date selector (`format: "date"`).

### Step 3: Validate and Save

- Click **Validate Schema** to check syntax and structure.
- If the schema has errors, an alert will highlight the problem line and property.
- Click **Save Changes** to persist the configuration to the project.

---

## Generating Fields with Alice (AI Assistant)

You can ask Alice Assistant to create or modify custom fields for you using natural language:

1. On the **Fields** tab, click **Generate with Alice** (or open Alice from the top navigation bar).
2. Type your request in plain English:
   > _"I want every work-item to optionally have a MoSCoW rating and acceptance criteria."_
3. Alice generates a validated JSON Schema matching your requirements and loads it directly into the editor for your review.
4. Review the generated configuration, make any fine adjustments, and click **Save Changes**.

---

## Using Dynamic Fields on Work Items

Once dynamic fields are saved for a project:

- All work items in that project will display the configured fields under the **Additional Fields** section.
- **Dynamic fields are optional**: Work items can be created, updated, and moved between statuses without filling dynamic fields.
- Dynamic fields **never block work-item saving or validation**.
- If a dynamic field is empty, it does not clutter the view.

---

## Permissions

| Action                               | Admin | Manager | Member |
| :----------------------------------- | :---: | :-----: | :----: |
| View configured project fields       |   ✓   |    ✓    |   ✓    |
| Fill in dynamic fields on work items |   ✓   |    ✓    |   ✓    |
| Edit and save project field schema   |   ✓   |    ✓    |   —    |
| Delete project field configuration   |   ✓   |    ✓    |   —    |

---

## Related

- [Project settings](./project-settings.md)
- [Create work item](../work-items/create-work-item.md)
- [Alice AI assistant](../chat/use-ai-assistant.md)
- [Technical Architecture Spec](../../features/projects/PROJECT_DETAILS_AND_DYNAMIC_FIELDS.md)
