# Technical Specification: Project Work-Item Types & Jira Hierarchy Mapping

Technical architecture and implementation specification for project-level work-item types, Create/Edit form scoping, hierarchy enforcement, and Jira import hierarchy mapping.

---

## 1. Architectural Architecture

ALICE uses a two-tier hierarchy model:

1. **Fixed System Hierarchy**:
   ```text
   Epic → Story → Task → Issue
   ```
   Applied by default to all projects. Projects configure which types are enabled via `workflow_config.work_item_types`. `Feature` is an optional higher-level capability that can be permitted per project. Selecting allowed types restricts available levels but does not customize the hierarchy chain.

2. **Custom Jira Import Hierarchy**:
   Configured strictly within the Jira import dialog. When custom hierarchy is defined during Jira import, it is stored in `workflow_config.hierarchy` as a parent-to-child map (e.g., `{ Epic: "Feature", Feature: "Story", Story: "Task", Task: "Issue" }`) and takes precedence for that project.

---

## 2. Core Modules & Files

### Shared Types (`packages/types`)
- **`src/work-item-types.ts`**:
  - `DEFAULT_SYSTEM_HIERARCHY`: `['Epic', 'Story', 'Task', 'Issue']`
  - `resolveProjectHierarchy(allowedTypes?, customHierarchy?)`: Derives parent-to-child and child-to-parent maps.
  - `getAllowedChildType` & `getAllowedParentType`: Computes permitted adjacent hierarchy types.
- **`src/api/v1/jira-import-types.ts`**:
  - `jiraImportConfigSchema`: Validates import configuration including type mappings and hierarchy array.
  - `JiraImportAction`: `'map' | 'ignore' | 'drop'`.
- **`src/api/v1/board-config.ts` & `src/api/v1/projects.ts`**:
  - `projectWorkflowConfigSchema`: Includes `work_item_types` array and `hierarchy` map.

### API Backend (`apps/api`)
- **`src/routes/api/projects/projects.repository.ts`**:
  - `migrateWorkItemTypesAndPruneHierarchy`: Reassigns work items of removed types to `Issue` and unlinks invalid parent-child relations.
  - `linkImportedJiraParents`: Links imported Jira parents complying strictly with the project's active hierarchy.
- **`src/routes/api/projects/projects.service.ts`**:
  - Detects removed types during project updates and triggers migration.
- **`src/routes/api/workItems/workItems.service.ts`**:
  - Validates that `createWorkItem` and `updateWorkItem` enforce allowed project types.
- **`src/routes/api/projects/projects.route.ts`**:
  - `POST /:id/jira/preview`: Returns discovered Jira issue types and preview counts.
  - `POST /:id/jira/import`: Processes `JiraImportConfig`, executing mapped, ignored, and dropped actions.

### Web Frontend (`apps/web`)
- **`app/projects/_components/project-form.tsx`**:
  - Basic Details Step 1 checkboxes for allowed types.
- **`app/projects/_components/project-details/project-settings-tab.tsx`**:
  - Settings tab card for toggling permitted types with migration warning.
- **`app/work-items/_components/work-item-form/work-item-form.tsx`**:
  - Scopes Type dropdown to project-configured types.
- **`app/projects/_components/project-details/jira-import-dialog.tsx`**:
  - Wide modal (`max-w-4xl`), hidden scrollbar, fixed bottom buttons, single-row type mappings, and hierarchy reordering.

---

## 3. Database Schema Integrity

In Prisma (`schema.prisma`), `work_items.type` is non-nullable (`WorkItemType`).
Therefore:
- ALICE work-item type is **mandatory**.
- When an enabled type is removed from project configuration, affected items fall back to **`Issue`** (the leaf type).
- Leaf items cannot have children, ensuring hierarchy integrity.
