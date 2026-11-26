# Dashboard feature documentation

Authenticated workspace hub. **Overview** is moving from a mock widget grid to
a slider of pinned **chart workspaces** (see
[CHARTS.md](./CHARTS.md#planned-dashboard-overview--chart-workspace-slider));
legacy mocks stay behind `?mockOverview=1` until KPI/velocity/activity catalog
widgets replace them.

| Document                                         | Description                                                                                                  | Status |
| ------------------------------------------------ | ------------------------------------------------------------------------------------------------------------ | ------ |
| [CHARTS.md](./CHARTS.md)                         | `/charts` boards + planned Overview slider, descriptions, fork, mockOverview escape hatch                    | Living |
| [CHARTS_AGGREGATION.md](./CHARTS_AGGREGATION.md) | Categorical + burndown + hierarchy rollups, series APIs; Tier 1 product (Tier 2–3 → architecture doc)        | Living |
| —                                                | Productivity **Notes** widget → [notes feature](../notes/README.md)                                          | Living |
| —                                                | See [ARD](../../product/ARD.md) and [TRD](../../architecture/TRD.md); add widget/layout notes here as needed | Living |

Quick links:

- Implementation: `apps/web/app/dashboard/`
- Notes: [notes feature](../notes/README.md)
- User guide: [Dashboard overview](../../user-guide/navigation/dashboard-overview.md), [Notes](../../user-guide/navigation/notes.md)
- Charts UI: `apps/web/app/charts/`
- Notifications inbox: [notifications feature](../notifications/README.md)
- Favorites / Saved Views: [views feature](../views/FAVORITES_AND_VIEWS.md)
- Auth / role access: [RBAC plan](../../auth/RBAC_AUTHORIZATION_SKELETON.md)
- SEO: dashboards are `noindex` — see [SEO guide](../../guides/SEO.md)
