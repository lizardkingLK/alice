# Audit columns

Every domain table includes standard audit metadata. Use the shared helpers in `@repo/types/audit` so inserts and updates stay consistent across the web app, API, and seed scripts.

Related:

- [`ER_DIAGRAM.md`](./ER_DIAGRAM.md) — entity model
- [`../guides/DATABASE.md`](../guides/DATABASE.md) — migrations and workflow

---

## Standard columns

| Column       | Type        | Nullable | Notes                                          |
| ------------ | ----------- | -------- | ---------------------------------------------- |
| `created_by` | UUID        | Yes      | FK → `users.id`, `ON DELETE SET NULL`          |
| `created_at` | timestamptz | No       | Defaults to `now()` at insert                  |
| `updated_by` | UUID        | Yes      | FK → `users.id`, `ON DELETE SET NULL`          |
| `updated_at` | timestamptz | No       | Set explicitly on Supabase updates (see below) |

Prisma marks `updated_at` with `@updatedAt` for migrations and schema tooling. Runtime writes through the Supabase JS client must set `updated_at` manually — there is no Postgres trigger.

---

## Status column

Entities with a domain lifecycle keep their own status enum. All other tables use `RecordStatus`.

| Tables                                                                                                         | Status enum      |
| -------------------------------------------------------------------------------------------------------------- | ---------------- |
| `projects`                                                                                                     | `ProjectStatus`  |
| `sprints`                                                                                                      | `SprintStatus`   |
| `work_items`                                                                                                   | `WorkItemStatus` |
| `users`, `instruments`, `project_members`, `teams`, `team_members`, `comments`, `attachments`, `notifications` | `RecordStatus`   |

`RecordStatus` values: `active`, `inactive`, `archived`, `deleted`.

`users` also keeps the legacy `active` boolean for auth gating. When toggling activation, update both `active` and `status` via `userActiveAuditUpdate()`.

---

## Shared helpers (`@repo/types/audit`)

```typescript
import {
  auditCreate,
  auditCreateWithoutStatus,
  auditUpdate,
  userActiveAuditUpdate,
} from '@repo/types/audit';
```

| Helper                     | Use on                        | Sets                                               |
| -------------------------- | ----------------------------- | -------------------------------------------------- |
| `auditCreate(actorId)`     | INSERT (RecordStatus tables)  | `status`, `created_by`, `updated_by`, `updated_at` |
| `auditCreateWithoutStatus` | INSERT (domain status tables) | `created_by`, `updated_by`, `updated_at`           |
| `auditUpdate(actorId)`     | UPDATE (any audited table)    | `updated_by`, `updated_at`                         |
| `userActiveAuditUpdate`    | UPDATE `users` activation     | `active`, `status`, `updated_by`, `updated_at`     |

`actorId` is the authenticated user's `users.id` (same as Supabase Auth `user.id`).

---

## Usage patterns

### Next.js server action (web)

```typescript
import { auditCreate, userActiveAuditUpdate } from '@repo/types/audit';

const currentUser = await getDbUser();
if (!currentUser) throw new Error('Not authenticated');

await supabase.from('users').insert({
  id: invitedUser.id,
  name,
  email,
  role,
  active: true,
  ...auditCreate(currentUser.id),
});

await supabase
  .from('users')
  .update(userActiveAuditUpdate(currentUser.id, false))
  .eq('id', targetUserId);
```

### Express API route

Auth middleware sets `req.userId`. Use `requireActorId()` from `apps/api/src/lib/audit.ts`:

```typescript
import { requireActorId } from '../../../lib/audit';
import { auditCreate, auditUpdate } from '@repo/types/audit';

router.post('/', requireApiAuth, async (req, res) => {
  const actorId = requireActorId(req);

  const { error } = await supabase.from('comments').insert({
    work_item_id,
    author_id: actorId,
    content,
    ...auditCreate(actorId),
  });
});
```

### Seed scripts (`packages/db`)

Seeds import the same helpers so dev data matches production conventions:

```typescript
import { auditCreate, auditCreateWithoutStatus } from '@repo/types/audit';

await supabase.from('projects').insert({
  name: 'Alice Platform',
  key: 'ALICE',
  owner_id: adminId,
  status: 'active',
  ...auditCreateWithoutStatus(adminId),
});
```

---

## Nullable actor FKs

`created_by` and `updated_by` are nullable so system jobs, migrations, and bootstrap seeds can write rows without a user context. Application code should always pass the authenticated actor when one is available.

Optional domain FKs that remain nullable include `work_items.reporter_id`, `work_items.assignee_id`, and `work_items.sprint_id`.

---

## Column renames (migration `add_audit_metadata`)

| Before                      | After        |
| --------------------------- | ------------ |
| `project_members.joined_at` | `created_at` |
| `attachments.uploaded_at`   | `created_at` |

Do not reference the old column names in new code.
