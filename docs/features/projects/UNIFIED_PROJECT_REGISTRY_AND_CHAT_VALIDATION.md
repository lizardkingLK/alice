# Technical Specification: Unified Role-Based Project Registry & Chat Access

Technical architecture and implementation specification for unifying role-based project access validation across the Project Registry View (`/projects`) and Alice Chat.

---

## 1. Architectural Overview

To eliminate duplicate access validation logic and prevent data leakage in AI conversations, ALICE uses a single backend source of truth for project accessibility:

```text
┌─────────────────────────┐         ┌─────────────────────────┐
│  Project Registry View  │         │     Alice AI Chat       │
│  (GET /api/v1/projects) │         │ (list_projects tool &   │
│                         │         │  workspace turn context)│
└────────────┬────────────┘         └────────────┬────────────┘
             │                                   │
             ▼                                   ▼
┌─────────────────────────┐         ┌─────────────────────────┐
│  listProjectsPaginated  │         │   listProjectsForActor  │
└────────────┬────────────┘         └────────────┬────────────┘
             │                                   │
             └─────────────────┬─────────────────┘
                               │
                               ▼
            ┌──────────────────────────────────────┐
            │       listAccessibleProjectIds       │
            │ (project_members, owner, allowlist)  │
            └──────────────────────────────────────┘
```

---

## 2. Core Modules & Changes

### Shared Types (`packages/types`)
- **`src/api/v1/projects.ts`**:
  - `ProjectRegistryPermissions`: `{ role: UserRole, canCreate: boolean, canManage: boolean, canPurge: boolean }`.
  - `getProjectRegistryPermissions(role: UserRole)`: Shared role permission resolver.
  - `ActorProjectsSummary`: `{ id, name, key, description, status }`.
  - `ListProjectsForActorResponse`: `{ projects, totalCount, userRole, permissions }`.

### Backend API Services (`apps/api`)
- **`src/lib/auth-helpers.ts`**:
  - `getActorUser(actorId)`: Resolves user role and email from Supabase.
- **`src/routes/api/projects/projects.repository.ts`**:
  - `listAccessibleSummaries({ accessibleIds, status?, search? })`: Executes Prisma query filtered by accessible project IDs.
- **`src/routes/api/projects/projects.service.ts`**:
  - `listProjectsForActor(actorId, options?)`:
    1. Resolves user role.
    2. Computes `permissions = getProjectRegistryPermissions(user.role)`.
    3. Fetches `accessibleIds = listAccessibleProjectIds(actorId)`.
    4. If empty, returns `{ projects: [], totalCount: 0, userRole, permissions }`.
    5. Calls `listAccessibleSummaries` and returns filtered projects.
- **`src/routes/api/chat/chat.service.ts`**:
  - `handleListProjects(userId)`: Calls `projectsService.listProjectsForActor(userId)`.
  - `loadWorkspaceContext`: Turn preparation prompt context uses `listProjectsForActor(userId)` to guarantee zero unassigned project leakage.
- **`src/routes/api/chat/chat.route.data.ts`**:
  - System prompt includes `PROJECT LISTING & ACCESS CONTROL PROTOCOL` enforcing:
    - Introduction sentence: *"Here are all the projects that are available to you:"*.
    - Markdown table structure: `| Project Name | Key | Description |`.
    - No-access fallback message.

---

## 3. Security & Access Boundaries

1. **Strict Assignment Scoping**: A Member can never receive or query projects outside their direct `project_members` rows or explicit allowlist entries.
2. **Prompt Isolation**: System turns never pass unassigned projects into LLM context, preventing prompt injection attacks from discovering project names.
3. **Immutability of Registry**: Existing `/projects` endpoint functionality remains completely intact while sharing the underlying security resolver.
