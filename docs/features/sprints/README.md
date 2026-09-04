# Sprints feature documentation

Sprint lifecycle: planned, active, closed, archived — list, create, and status transitions.

| Document | Description                                                                                                      | Status |
| -------- | ---------------------------------------------------------------------------------------------------------------- | ------ |
| —        | See [ARD](../../product/ARD.md) (SPR-1) and [TRD](../../architecture/TRD.md); add dedicated notes here as needed | Living |

Quick links:

- Implementation: `apps/web/app/sprints/`
- API: `apps/api/src/routes/api/sprints/`
- Related: [board](../board/), [work items](../work-items/), backlog under `apps/web/app/backlog/`
- Summary report: `/sprints/[id]/report?from=sprints|backlog` — `from` drives
  unavailable-state back CTA and breadcrumbs (`sprint-report-links.ts`)
