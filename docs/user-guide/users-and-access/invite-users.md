# Invite users

Send someone a link to set their password and join Alice.

**Audience:** Admin

---

## Before inviting

The invitee's email must be **allowlisted** (domain or exact email). If not,
add an allowlist entry first — see [Admission allowlist](./allowlist.md).

Inviting does not replace the allowlist; it helps people who need a guided
first login.

---

## Steps

1. Go to **Users** (admin).
2. Stay on the **Users** tab (default).
3. Select **Add User**.
4. Enter **name**, **email**, and **role** (member, manager, or admin).
5. Submit the form.

They receive an email with a link to set a password, then land in the workspace.

---

## Invitation vs self-registration

| Method            | Best for                                           |
| ----------------- | -------------------------------------------------- |
| **Invite**        | You want a known email and role before first login |
| **Self-register** | Domain is allowlisted and users sign up themselves |

Both require an active allowlist match at sign-in.

---

## Troubleshooting

| Issue                     | Action                                                                                |
| ------------------------- | ------------------------------------------------------------------------------------- |
| Invite email not received | Check spam; confirm allowlist and email spelling                                      |
| Link expired              | Send a new invite or use [Forgot password](../sign-in-and-account/forgot-password.md) |
| Access denied after setup | Confirm allowlist entry is **active**                                                 |

---

## Related

- [Admission allowlist](./allowlist.md)
- [Deactivate users](./deactivate-users.md)
