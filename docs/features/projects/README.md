# Projects feature documentation

Project administration registry: list, create, edit, soft delete, restore, and hard delete.

| Document                                     | Description                                                                                | Status |
| -------------------------------------------- | ------------------------------------------------------------------------------------------ | ------ |
| [JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md) | Manager OAuth (3LO) → persisted Jira link → import; **sweep interim API-token flow first** | Plan   |
| —                                            | See [ARD](../../product/ARD.md) (PROJ-1) and [TRD](../../architecture/TRD.md)              | Living |

Quick links:

- Implementation: `apps/web/app/projects/`
- API: `apps/api/src/routes/api/projects/`
- Schema: projects-related models in `packages/db/prisma/schema.prisma`

## Jira Cloud integration

**Planned:** Atlassian OAuth 2.0 (3LO) so the manager who creates a project authorizes Jira; Alice persists a `jira_connections` row and links the project to a Jira project key, then imports issues. See **[JIRA_INTEGRATION.md](./JIRA_INTEGRATION.md)** (Phase 0 = remove current token-based UI/API/`jira_settings` before building OAuth).

**Interim (current code, do not extend):** optional `jira_*` columns / global `jira_settings` / email+API-token preview & import. That path is documented only as the sweep target in the plan.
