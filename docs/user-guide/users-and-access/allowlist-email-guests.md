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

1. Go to **Users → Allowlist** (or **Review & allow** from
   [Access requests](./access-requests.md) — email and requested projects are
   prefilled when available).
2. Select **Add email** if you are not coming from a request.
3. Enter the full address (e.g. `alex@partner.com`).
4. Select at least one **project** the guest may open.
5. Set status to **active**.
6. Save.

Alice emails an invite (or magic link) for new addresses. Tell the person to
open that email or use [Forgot password](../sign-in-and-account/forgot-password.md)
to set a password before email sign-in. Optionally also
[invite them](./invite-users.md) from the Users directory if you want a separate
pending member record.

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
