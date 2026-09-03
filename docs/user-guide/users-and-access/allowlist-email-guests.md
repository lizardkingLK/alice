# Allow by email (guests)

Allow a single external email address to sign in without opening the whole domain.

**Audience:** Admin

---

## When to use email entries

Add an **email** (not domain) entry when:

- A contractor uses `@partner.com` and you don't want to allow all of `@partner.com`.
- A freelancer needs access with a personal Gmail or other one-off address.
- You approved someone from an [access request](./access-requests.md) and want
  to admit only that person.

---

## Steps

1. Go to **Users → Allowlist**.
2. Select **Add email**.
3. Enter the full address (e.g. `alex@partner.com`).
4. Set status to **active**.
5. Save.

Tell the person they can [sign in](../sign-in-and-account/README.md). Optionally
[invite them](./invite-users.md) so they receive a setup link.

---

## Domain vs email

| Approach | Risk profile                       |
| -------- | ---------------------------------- |
| Domain   | Broad — any mailbox on that domain |
| Email    | Narrow — exactly one address       |

Prefer email entries for guests; reserve domain entries for your organization.

---

## Related

- [Admission allowlist](./allowlist.md)
- [Invite users](./invite-users.md)
