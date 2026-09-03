# Allow by email domain

Let everyone with a company email domain sign in automatically.

**Audience:** Admin

---

## When to use domain allowlisting

Use a **domain** entry when:

- All staff share one email domain (e.g. `@acme.com`).
- You don't want to add people one by one as they join HR.

One active domain entry covers every matching address at sign-in time.

---

## Steps

1. Go to **Users → Allowlist**.
2. Select **Add domain** (or equivalent).
3. Enter the domain only — e.g. `acme.com`, not `@acme.com`.
4. Ensure the entry is **active**.
5. Save.

Employees can now [sign in](../sign-in-and-account/email-sign-in.md) or use
[Google](../sign-in-and-account/google-sign-in.md) with that domain.

---

## Tips

- Add only domains you trust. Anyone who can receive mail at that domain can
  request an account if self-registration is enabled.
- For contractors on other domains, use
  [Allow by email (guests)](./allowlist-email-guests.md) instead.
- Deactivating the domain blocks new sign-ins for that domain until you
  reactivate it.

---

## Related

- [Admission allowlist](./allowlist.md)
