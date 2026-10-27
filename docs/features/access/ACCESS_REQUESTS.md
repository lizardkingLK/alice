# Access requests

Canonical admission requests from **`/access-denied`** (after sign-up / Google
denial) and the `/contact` form (subject **Access request**). Email/password
**sign-in** with an unknown address does **not** open the request form.
Admins review requests under **Users → Requests**; **Edit** opens a grant
dialog scoped to the admin’s accessible projects (Grant + optional Member).

Related: [ACCESS_ALLOWLIST.md](./ACCESS_ALLOWLIST.md)

## Limits (hardcoded in `@repo/types`)

| Constant                             | Value      | Meaning                                                              |
| ------------------------------------ | ---------- | -------------------------------------------------------------------- |
| `ACCESS_REQUEST_MAX_SUBMISSIONS`     | **3**      | Max submissions per email in the rolling window                      |
| `ACCESS_REQUEST_ROLLING_WINDOW_DAYS` | **30**     | Rolling window for the submission cap                                |
| `ACCESS_REQUEST_IDEMPOTENCY_MS`      | **1 hour** | Resubmitting inside this window updates message only (no count bump) |
| `ACCESS_REQUEST_MAX_PROJECT_KEYS`    | **20**     | Max project keys accepted per submission                             |

Shared cap applies to all request kinds (`admission`, `project_expansion`).

## Data model

Table: `access_requests`

| Field                         | Purpose                                                 |
| ----------------------------- | ------------------------------------------------------- |
| `requester_email`             | Normalized contact email                                |
| `requester_name`              | Optional display name                                   |
| `message`                     | Latest request body                                     |
| `kind`                        | `admission` \| `project_expansion`                      |
| `status`                      | `pending` \| `granted` \| `denied`                      |
| `request_count`               | Submissions counted in the current rolling window       |
| `requested_project_keys`      | Optional JSON array of project keys the requester needs |
| `resolved_by` / `resolved_at` | Admin who closed the request                            |

Notifications: `type = access_request`, `related_item_id = access_requests.id` (one per active admin).

## User flow

```mermaid
sequenceDiagram
  actor U as Requester
  participant D as /access-denied or /contact
  participant API as POST /api/notifications/contact
  participant AR as access_requests
  participant N as notifications

  U->>D: Access request (+ optional project keys)
  D->>API: contact payload
  API->>AR: upsert pending (respect 30d / max 3; store keys)
  API->>N: notify admins (linked)
```

Requesters can name **project keys** (comma-separated). Keys are normalized
(uppercase) onto `requested_project_keys`. Free-text project names still belong
in `message` when keys are unknown.

## Admin flow

Route: `/users?tab=requests` (paginated registry).

Deep link (from inbox or row action):

`/users?tab=requests&requestId={uuid}&addEmail={email}`

| Request status | Dialog                                                             |
| -------------- | ------------------------------------------------------------------ |
| `pending`      | **Edit** — renew if needed, then Grant/Member; row **Deny** OK     |
| `granted`      | **Edit** — revoke warning + shared memberships; **Deny** in dialog |
| `denied`       | **Edit** — re-grant (same grant UI as pending)                     |

The registry **Projects** column shows requested keys. Prefill intersects
requested keys with the reviewing admin’s accessible projects; inaccessible
requested keys are listed as omitted.

### Renew-before-grant (UI)

When the requester’s email domain matches an allowlist **domain** row that is
**inactive** or **display-expired** (`active` + past `expires_at`), the grant
dialog shows a **Renew domain allowlist** panel after the message and hides
project Grant/Member until renew succeeds:

1. Domain value is read-only; label, status, and expires on are editable
2. Client validation: status must be `active`, expires must be a calendar date
   **after today** (UTC)
3. Uses existing `PUT /api/access-allowlist/:id`
4. On success: toast, hide renew panel, show project grant (member-locked)

### Grant

`POST /api/access-requests/:id/grant` with:

```ts
{
  projects: Array<{ projectId: string; addMember: boolean }>;
}
```

Service rules (admin only):

1. Request must be `pending` or `denied` (else 409).
2. Every `projectId` must be in the actor’s accessible set (`listAccessibleProjectIds`).
3. **Covering domain** (`findActiveDomainByValue` on requester email domain,
   including display-expired active rows): do **not** create an email allowlist
   row; treat every selected project as `addMember: true`; create
   `project_members` when a `public.users` row exists for the email.
4. **No covering domain:** create or reactivate an email allowlist with
   `allowed_project_ids` = keys for Grant-selected projects + invite email when
   reactivating from inactive; create `project_members` only where
   `addMember: true`.
5. Resolve request → `granted` and archive linked notifications.

Standalone Allowlist create/reactivate still calls `markGrantedForEmail` as a
side effect (unchanged).

Invitees must open the invite (or use **Forgot password**) to set a password —
password failures on sign-in stay on `/login` with invalid credentials.

### Deny

`POST /api/access-requests/:id/deny` (admin only) for `pending` or `granted`:

1. **Pending:** set → `denied`, archive notifications (no membership changes)
2. **Granted:** remove `project_members` for the requester on projects the actor
   can access; deactivate active **email** allowlist for that address (domain
   rows untouched); set → `denied`; archive notifications

`GET /api/access-requests/:id/shared-memberships` returns the revoke-candidate
projects for the Edit dialog (requester membership ∩ actor accessible).

Grant accepts `pending` or `denied` (re-grant). Re-grant reactivates an existing
email allowlist row when present instead of creating a duplicate.

### Delete

Hard-delete from the Requests registry (aligned with Allowlist **Delete**):
`DELETE /api/access-requests/:id` (admin only). Archives linked notifications,
then removes the row. Available for pending, granted, and denied requests.

### Row actions

| Status    | Menu                           |
| --------- | ------------------------------ |
| `pending` | **Edit**, **Deny**, **Delete** |
| `granted` | **Edit**, **Delete**           |
| `denied`  | **Edit**, **Delete**           |

**Edit** opens from local state (no URL rewrite). Inbox deep links still use
`requestId` / `addEmail`; closing clears those query keys quietly via
`history.replaceState`.

## API

| Method | Path                                          | Auth   | Purpose                            |
| ------ | --------------------------------------------- | ------ | ---------------------------------- |
| POST   | `/api/notifications/contact`                  | Public | Submit contact / access request    |
| GET    | `/api/access-requests/:id/shared-memberships` | Admin  | Revoke-candidate projects for Edit |
| POST   | `/api/access-requests/:id/grant`              | Admin  | Grant pending or denied request    |
| POST   | `/api/access-requests/:id/deny`               | Admin  | Deny pending or revoke granted     |
| DELETE | `/api/access-requests/:id`                    | Admin  | Hard-delete request                |

Contact payload may include optional `requestedProjectKeys` (string or string[]).

List/read uses Supabase from the web RSC layer (`listAccessRequests`), same pattern as allowlist.

## Tests

| File                                                        | Covers                                                      |
| ----------------------------------------------------------- | ----------------------------------------------------------- |
| `apps/api/tests/access/access-requests.service.test.ts`     | Submission limits, deny, delete, grant domain/no-domain/ACL |
| `apps/web/tests/access/access-request-project-keys.test.ts` | Key parsing helpers                                         |
| `apps/web/tests/access/grant-project-selection.test.ts`     | Prefill, Grant/Member coupling, covering-domain helper      |
| `apps/web/tests/access/grant-domain-renew.test.ts`          | Renew gate helpers + client validation                      |
| `apps/web/tests/auth/login-error-message.test.ts`           | Invite / password login copy                                |
| `apps/web/tests/dashboard/dashboard-notifications.test.tsx` | Inbox → Requests deep link                                  |

## Rollout

1. Apply migration `add_access_requests` (includes `requested_project_keys`)
2. Deploy API + web
3. Legacy `comment` notifications without `related_item_id` still open the inline dialog; new requests use the Requests tab deep link
