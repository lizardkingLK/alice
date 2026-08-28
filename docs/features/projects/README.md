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
2. **Project workspace membership** — within that, only **admin**, **owner**, or active **`project_members`** may open a given `/projects/[id]` workspace and see that project on the registry list.

There is no separate “private project” setting; membership is the ACL.

### Registry list (`/projects`)

`getProjectListPaginated` scopes rows via `listAccessibleProjectIds`:

| Viewer                 | Projects shown                                          |
| ---------------------- | ------------------------------------------------------- |
| `admin`                | All projects                                            |
| Other manager+         | Union of `owner_id = self` and active `project_members` |
| No accessible projects | Empty list (create a project or get added as a member)  |

Inaccessible projects are **omitted** from the list (not shown as disabled rows), so users do not navigate into a deny screen from the registry.

### Workspace (`/projects/[id]`)

`getProjectWorkspace` checks `canAccessProjectWorkspace` **before** loading members / work items / teams:

| Who                      | Result                                                                   |
| ------------------------ | ------------------------------------------------------------------------ |
| `admin`                  | Full workspace                                                           |
| Project `owner_id`       | Full workspace                                                           |
| Active `project_members` | Full workspace                                                           |
| Otherwise                | In-shell **“No access to this project”** card + link back to `/projects` |

Hierarchy **expand all** uses the same membership family (`canAccessProjectWorkspace`), plus assignee/reporter (and ancestors) for My Work contexts. Membership denial message: _You're not a member of this project._

### How managers get access

1. **Create** a project → they become `owner_id` → project appears in the list and workspace opens.
2. **Be added** to `project_members` (or become owner) by an admin/owner → same.

Dropdown caches used by board/backlog/forms (`getProjectList`) are separate from the registry filter; registry visibility is the membership-scoped list above.

## Jira Cloud integration

**Current:** Atlassian OAuth 2.0 (3LO) — managers connect Jira, link `jira_connection_id` + `jira_project_key`, then preview/import. See **[JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md)**.

**GitHub:** Per-project PATs with encrypt-at-rest — see **[GITHUB_INTEGRATION.md](./GITHUB_INTEGRATION.md)**. Shares `INTEGRATION_TOKEN_ENCRYPTION_KEY` with Jira OAuth token storage.
