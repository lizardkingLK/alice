# Access requests

Review and act on people who asked to join the workspace.

**Audience:** Admin

---

## Open requests

1. Sign in as an **admin**.
2. Go to **Users**.
3. Open the **Requests** tab.

You'll see submissions from the [Request access](../sign-in-and-account/request-access.md)
flow: name, email, message, **requested project keys**, and date.

---

## Typical workflow

1. **Verify** the person should have access (manager approval, ticket, etc.).
2. Open **Edit** on a row (or follow the inbox deep link). **View** is not used
   — Edit covers pending, granted, and denied requests.
3. The dialog shows their message first.
4. If their email domain has an **expired** or **inactive** domain allowlist
   row, renew that domain before projects appear: set **Status** to **Active**
   and **Expires on** to a date after today, then **Renew domain**. A toast
   confirms success and the project grant section opens.
5. For **pending** or **denied** requests, choose projects **you** can access.
   Requested keys are pre-checked when they overlap your list; keys you cannot
   access are noted and omitted.
6. For each project:
   - **Grant** — include the project in this approval.
   - **Member** — also add them to the project roster (defaults on with Grant).
7. **Save** to grant (or re-grant after a prior deny).
8. For a **pending** request you can also use row-menu **Deny** (no membership
   revoke). For a **granted** request, open **Edit** and use **Deny** there —
   Alice warns about shared project memberships, removes memberships on
   projects you can access, deactivates any **email** allowlist for that
   address, and sets the request to denied.
9. Use **Delete** to remove a request from the list (same idea as deleting an
   allowlist entry). If you delete a granted request instead of denying it,
   memberships are left as-is under Projects.

### Domain vs email allowlist

- If a domain allowlist covers their email but is **expired or inactive**, you
  must renew it in the grant dialog before selecting projects (admission stays
  blocked until the domain is effectively active again).
- If an **active** (non-expired) domain allowlist covers their email, Grant adds
  **project membership** only — Alice does not create a separate email
  allowlist row. Member stays locked on with Grant.
- If there is **no** covering domain, Grant creates an **email** allowlist entry
  with the selected projects as the guest ACL, and Member optionally adds
  project membership when an Alice user already exists for that email.

See [Admission allowlist](./allowlist.md) and
[Allow by email (guests)](./allowlist-email-guests.md).

---

## Spam protection

Each email address can submit at most **3** requests in a **30-day** window.
Repeated spam from the same address stops automatically.

---

## After approval

When an email allowlist row is created, Alice emails an invite / magic link.
The requester must set a password via that invite or
[Forgot password](../sign-in-and-account/forgot-password.md) before email
sign-in works. You may still need to:

- Set their **role** under **Users**
- Confirm **project members** for operational access — see
  [Project members](../projects/project-members.md) (guest allowlist ACL is not
  the same as membership)

---

## Related

- [Request access](../sign-in-and-account/request-access.md)
- [Allow by email (guests)](./allowlist-email-guests.md)
