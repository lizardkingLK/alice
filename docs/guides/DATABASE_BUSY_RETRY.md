# Database busy retry (alice#562)

Status: **Living**

When Prisma + `@prisma/adapter-pg` cannot acquire a connection to start an
interactive transaction within `maxWait`, callers see:

`Transaction API error: Unable to start a transaction in the given time.`

Tracked in [alice#562](https://github.com/lizardkingLK/alice/issues/562).

## Mitigations

1. **Pool size** — `PG_POOL_MAX` in `packages/db/src/client.ts` (20).
2. **Server** — `withBusyRetry` from `@repo/db` around sensitive `$transaction`
   calls (e.g. project create), with raised `maxWait` / `timeout`.
3. **API contract** — exhausted / detected busy failures return **503** with
   `code: DATABASE_BUSY` and a friendly message.
4. **Client** — `apiFetch` (browser) wraps requests in `withApiBusyRetry` and
   shows a Sonner toast: “Database is busy. Retrying…”.

## Related

- Prisma transaction options:
  https://www.prisma.io/docs/orm/v7/prisma-client/queries/transactions
- Prisma client busy spike discussion:
  https://github.com/prisma/prisma/issues/27990
