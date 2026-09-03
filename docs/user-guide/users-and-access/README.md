# Users & access

Manage who can join Alice and how they appear in the workspace.

**Audience:** Admins (directory page: all members)

---

## In this topic

| Page                                                   | Who can use it |
| ------------------------------------------------------ | -------------- |
| [User directory](./user-directory.md)                  | Everyone       |
| [Admission allowlist](./allowlist.md)                  | Admin          |
| [Allow by email domain](./allowlist-domain.md)         | Admin          |
| [Allow by email (guests)](./allowlist-email-guests.md) | Admin          |
| [Access requests](./access-requests.md)                | Admin          |
| [Invite users](./invite-users.md)                      | Admin          |
| [Deactivate users](./deactivate-users.md)              | Admin          |

---

## How admission works

Alice uses an **admission allowlist**. Sign-in succeeds only when the user's
email matches an **active** allowlist entry (domain or exact email).

1. **Domain entry** — Anyone with `@yourcompany.com` can sign in (if active).
2. **Email entry** — One specific address (contractors, guests) can sign in.

People not on the list see access denied and can [request access](../sign-in-and-account/request-access.md).

After admission, an admin sets each user's **role** (member, manager, or admin)
and adds them to **projects** as needed.

---

## Admin workflow (quick reference)

| Goal                                   | Where to go                        |
| -------------------------------------- | ---------------------------------- |
| Let a whole company domain in          | **Users → Allowlist** → add domain |
| Let one external email in              | **Users → Allowlist** → add email  |
| Review someone who asked to join       | **Users → Requests**               |
| Send a password-setup link             | **Users → Invite**                 |
| Remove access without deleting history | **Users** → deactivate user        |
