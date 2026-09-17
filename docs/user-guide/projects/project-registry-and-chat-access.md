# Unified Role-Based Project Access (Registry & Alice Chat)

Understand how project access and role permissions work consistently across the **Project Registry View** (`/projects`) and **Alice Chat**.

**Audience:** All users (Members, Managers, Administrators)

---

## Overview

In ALICE, project access is governed by a **unified backend security and permission model**. Whether you navigate to the Project Registry table in the web application or ask the AI assistant Alice in chat to list your projects, the exact same role-based rules and project assignment validations apply.

This unified approach ensures:
- **Zero data leakage in chat**: An AI user cannot view or query projects they are not authorized to access.
- **Consistent permissions across UI and API**: What you can see, edit, create, or delete on the web matches what Alice knows and can do on your behalf.
- **Identical project listing**: Asking Alice *"show all projects"* or *"list down all the projects"* outputs the identical subset of projects displayed on your Project Registry page.

---

## Role Permissions Matrix

Permissions in ALICE are role-based and strictly enforced:

| Capability | Member | Manager | Administrator |
|:---|:---:|:---:|:---:|
| **Projects visible in Registry & Chat** | Assigned projects only ($n$ of $N$) | Assigned & owned projects | All workspace projects |
| **Add / Create Project (`+ Add Project`)** | ❌ Disallowed | ❌ Disallowed | ✅ Allowed |
| **Edit Project Settings & Details** | ❌ Disallowed | ✅ Allowed | ✅ Allowed |
| **Archive Project (Soft Delete)** | ❌ Disallowed | ✅ Allowed | ✅ Allowed |
| **Restore Archived Project** | ❌ Disallowed | ✅ Allowed | ✅ Allowed |
| **Purge Project (Permanent Delete)** | ❌ Disallowed | ❌ Disallowed | ✅ Allowed |

---

## 1. Project Registry View (`/projects`)

When accessing the Project Registry table at `/projects`:

### Member Role
- Only projects where the member is actively assigned in `project_members` (or allowlisted for the project) are displayed.
- Unassigned projects are completely hidden from the table.
- The **+ Add Project** button is hidden.
- Row actions (Edit, Archive, Restore, Purge) are disabled and hidden.
- Members can click on their assigned projects to view the project overview, boards, and work items.

### Manager Role
- Projects owned by the manager or where the manager is an active member are displayed.
- The **+ Add Project** button is hidden (only Administrators can create new projects).
- Managers have access to row actions to **Edit** project settings and **Archive** (soft delete) active projects. In the Archived tab, managers can **Restore** projects, but cannot permanently purge them.

### Administrator Role
- All workspace projects are displayed.
- The **+ Add Project** button is visible and active.
- Full row actions are available: Edit, Archive, Restore, and **Purge** (permanent deletion).

---

## 2. Alice Chat AI Agent (`/chat` & Header Drawer)

When interacting with Alice in full-page chat or the header drawer:

### Project Listing Protocol
When you ask Alice to list or show your projects (e.g., *"show all projects"*, *"list all projects"*, *"list down all the projects"*):

1. **Automatic Access Validation**: Alice executes the `list_projects` tool with your authenticated user ID.
2. **Access Scoping**: The backend resolves your assigned project IDs via `listProjectsForActor`, applying the exact same access query as the Project Registry view.
3. **Standard Response Intro**: Alice always introduces the accessible projects with:
   ```text
   Here are all the projects that are available to you:
   ```
4. **Structured Table Output**: Directly below the intro, Alice presents a clean Markdown table with your accessible projects:
   ```markdown
   | Project Name | Key | Description |
   | ------------ | --- | ----------- |
   | Alice Core   | ALC | Core platform repository and services |
   | Mobile App   | MOB | Native mobile client applications |
   ```
5. **No Access Fallback**: If you do not currently belong to any projects, Alice responds:
   > *"You do not currently have access to any projects. Please contact your workspace administrator to request access."*

### Workspace Prompt Isolation
When you start or continue a conversation with Alice, Alice's internal workspace context is scoped strictly to your accessible projects. Projects outside your assigned list are **never** injected into the LLM context, preventing any accidental disclosure of unassigned project names, keys, or metadata.

---

## Related Documentation

- [User Testing Guide: Role-Based Project Access](./project-registry-and-chat-access-testing.md)
- [Browse Projects](./browse-projects.md)
- [Use the AI Assistant](../chat/use-ai-assistant.md)
- [Project Members](./project-members.md)
