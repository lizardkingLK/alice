# Views and Favorites feature documentation

Personal Favorites (pathname bookmarks) and shareable Saved Views (pathname +
query), with a `/views` workspace for manage / share / archive.

| Document                                           | Description                         | Status      |
| -------------------------------------------------- | ----------------------------------- | ----------- |
| [FAVORITES_AND_VIEWS.md](./FAVORITES_AND_VIEWS.md) | Storage, UX, share, archive, notify | Implemented |

Quick links:

- Web UI: `apps/web/app/views/`, `apps/web/lib/favorites/`, dashboard sidebar / page meta
- API: `apps/api/src/routes/api/savedViews/`
- Schema: `saved_views`, `saved_view_shares` in `packages/db/prisma/schema.prisma`
- Related: [Dashboard](../dashboard/README.md), [RBAC](../../auth/RBAC_AUTHORIZATION_SKELETON.md)
