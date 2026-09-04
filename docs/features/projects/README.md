# Projects feature documentation

Project administration registry: list, create, edit, soft delete, restore, and hard delete.

| Document                                         | Description                                                                   | Status |
| ------------------------------------------------ | ----------------------------------------------------------------------------- | ------ |
| [JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md)     | Manager OAuth (3LO) → persisted Jira link → import                            | Living |
| [GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md) | Per-project PAT, encrypt-at-rest, write-only client contract                  | Living |
| —                                                | See [ARD](../../product/ARD.md) (PROJ-1) and [TRD](../../architecture/TRD.md) | Living |

Quick links:

- Implementation: `apps/web/app/projects/`
- Detail overview (`/projects/[id]`): summary-report layout (primary banner + metric cards) with Members / Teams / Work Items tabs
- API: `apps/api/src/routes/api/projects/`
- Schema: projects-related models in `packages/db/prisma/schema.prisma`
- Access helper: `apps/web/lib/projects/project-workspace-access.ts`
- Platform RBAC (who can open `/projects` at all): [RBAC_AUTHORIZATION_SKELETON.md](../../auth/RBAC_AUTHORIZATION_SKELETON.md)

## Access model (platform + project)

Two layers apply:

1. **Platform RBAC** — `/projects` (list + detail) requires **manager+** (`RoleGatedLayout`). Members never open the projects area.
2. **Project workspace membership** — within that, only **owner** or active
   **`project_members`** may open a given `/projects/[id]` workspace and see
   that project on the registry list (same for admins; there is no admin
   “all projects” bypass).

There is no separate “private project” setting; membership is the ACL.

### Registry list (`/projects`)

`getProjectListPaginated` scopes rows via `listAccessibleProjectIds`:

| Viewer                 | Projects shown                                          |
| ---------------------- | ------------------------------------------------------- |
| Any authenticated role | Union of `owner_id = self` and active `project_members` |
| No accessible projects | Empty list (create a project or get added as a member)  |

Inaccessible projects are **omitted** from the list (not shown as disabled rows), so users do not navigate into a deny screen from the registry.

### Workspace (`/projects/[id]`)

`getProjectWorkspace` checks `canAccessProjectWorkspace` **before** loading members / work items / teams:

| Who                      | Result                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| Project `owner_id`       | Full workspace                                                           |
| Active `project_members` | Full workspace                                                           |
| Otherwise                | In-shell **“No access to this project”** card + link back to `/projects` |

Hierarchy **expand all** uses the same membership family (`canAccessProjectWorkspace`), plus assignee/reporter (and ancestors) for My Work contexts. Membership denial message: _You're not a member of this project._

### How users get access

1. **Admin creates** a project → picks a manager as `owner_id` → create inserts
   both the **owner** and the **creating admin** into `project_members`
   (creator stays assigned; owners cannot remove them).
2. **Ownership** → `owner_id` (and `ensureOwnerIsMember` on reassignment).
3. **Be added** to `project_members` by an admin/manager with access.

Dropdown caches used by board/backlog/forms (`getProjectList`) are separate from the registry filter; registry visibility is the membership-scoped list above.

## Jira Cloud integration

**Current:** Atlassian OAuth 2.0 (3LO) — managers connect Jira, link `jira_connection_id` + `jira_project_key`, then preview/import. See **[JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md)**.

**GitHub:** Per-project PATs with encrypt-at-rest — see **[GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md)**. Shares `INTEGRATION_TOKEN_ENCRYPTION_KEY` with Jira OAuth token storage.
