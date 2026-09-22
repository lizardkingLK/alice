# Access requests

Canonical admission requests from **`/access-denied`** (after sign-up / Google
denial) and the `/contact` form (subject **Access request**). Email/password
**sign-in** with an unknown address does **not** open the request form.
Admins review requests under **Users → Requests**; granting access creates an
email allowlist row (with requested projects prefilled when provided) and
resolves the request.

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

| Request status | Dialog                                                                   |
| -------------- | ------------------------------------------------------------------------ |
| `pending`      | Opens **Add allowlist entry** (email + requested project keys prefilled) |
| `granted`      | “Access already granted by another admin”                                |
| `denied`       | “This request was denied”                                                |

The registry **Projects** column shows requested keys. Admins can edit the
prefilled guest ACL before saving.

### Grant

Saving an active **email** allowlist row (create or reactivate) automatically:

1. Sets matching pending request → `granted`
2. Archives linked admin notifications
3. Sends the allowlist invite / magic-link email (see ACCESS_ALLOWLIST.md)

Invitees must open the invite (or use **Forgot password**) to set a password —
password failures on sign-in stay on `/login` with invalid credentials (Auth
cannot tell mistype vs unset invite password). Unknown emails also see that
generic error on `/login`.

### Deny

Explicit action: `POST /api/accessRequests/:id/deny` (admin only)

1. Sets request → `denied`
2. Archives linked notifications

## API

| Method | Path                           | Auth   | Purpose                         |
| ------ | ------------------------------ | ------ | ------------------------------- |
| POST   | `/api/notifications/contact`   | Public | Submit contact / access request |
| POST   | `/api/accessRequests/:id/deny` | Admin  | Deny pending request            |

Contact payload may include optional `requestedProjectKeys` (string or string[]).

List/read uses Supabase from the web RSC layer (`listAccessRequests`), same pattern as allowlist.

## Tests

| File                                                        | Covers                                            |
| ----------------------------------------------------------- | ------------------------------------------------- |
| `apps/api/tests/access/accessRequests.service.test.ts`      | Submission limits, deny, grant hook, project keys |
| `apps/web/tests/access/access-request-project-keys.test.ts` | Key parsing helpers                               |
| `apps/web/tests/auth/login-error-message.test.ts`           | Invite / password login copy                      |
| `apps/web/tests/dashboard/dashboard-notifications.test.tsx` | Inbox → Requests deep link                        |

## Rollout

1. Apply migration `add_access_requests` (includes `requested_project_keys`)
2. Deploy API + web
3. Legacy `comment` notifications without `related_item_id` still open the inline dialog; new requests use the Requests tab deep link
