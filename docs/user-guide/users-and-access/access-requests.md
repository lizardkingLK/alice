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
2. Open **Review & allow** on the row (or follow the inbox deep link).
3. The **Add allowlist entry** dialog opens with their **email** and any
   **requested project keys** already selected — adjust the guest project list
   if needed, then save. See [Admission allowlist](./allowlist.md) and
   [Allow by email (guests)](./allowlist-email-guests.md).
4. Optionally **invite** them with [Invite users](./invite-users.md) if you want
   a separate Users-directory invite (allowlist grant already emails an invite
   for new addresses).
5. Or **Deny** the request when they should not join.

---

## Spam protection

Each email address can submit at most **3** requests in a **30-day** window.
Repeated spam from the same address stops automatically.

---

## After approval

The requester must set a password via the invite or
[Forgot password](../sign-in-and-account/forgot-password.md) before email
sign-in works. You may still need to:

- Set their **role** under **Users**
- Add them as **project members** for operational access — see
  [Project members](../projects/project-members.md) (guest allowlist ACL is not
  the same as membership)

---

## Related

- [Request access](../sign-in-and-account/request-access.md)
- [Allow by email (guests)](./allowlist-email-guests.md)
