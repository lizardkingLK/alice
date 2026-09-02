# Admission allowlist

Control which emails are allowed to sign in to Alice.

**Audience:** Admin

---

## Open the allowlist

1. Sign in as an **admin**.
2. Go to **Users** in the sidebar.
3. Open the **Allowlist** tab.

You'll see all domain and email entries with their status.

---

## Entry types

| Type       | Example                  | Use when                                         |
| ---------- | ------------------------ | ------------------------------------------------ |
| **Domain** | `company.com`            | All employees with `@company.com` should sign in |
| **Email**  | `contractor@partner.com` | One guest or external address needs access       |

Each entry can be **active** or **inactive**. Inactive entries do not grant
admission.

---

## Add an entry

1. On **Allowlist**, choose **Add domain** or **Add email**.
2. Enter the domain (without `@`) or the full email address.
3. Save.

New users matching an active entry can sign in after they register or accept an
invite.

---

## Edit or deactivate

- **Deactivate** an entry to block future sign-ins for that domain or email
  without deleting the row (useful for audit history).
- **Reactivate** when you want to allow sign-in again.

Exact steps may use toggle or edit actions on each row.

---

## Related

- [Allow by email domain](./allowlist-domain.md)
- [Allow by email (guests)](./allowlist-email-guests.md)
- [Access requests](./access-requests.md)
